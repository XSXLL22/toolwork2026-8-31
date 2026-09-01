import type {
  CheckResult,
  ContextProfile,
  Depth,
  Finding,
  PropositionType,
  Report,
} from "../types.js";
import { defaultProfile } from "../profile/profile.js";
import { checkCompleteness } from "../checks/completeness.js";
import { runCognitiveChecks } from "../checks/cognitive.js";
import { scanBias } from "../checks/bias.js";
import { classifyProposition, extractStrongClaim, extractOverclaims } from "../checks/proposition.js";
import { assessMinimalVersion } from "../checks/minimalVersion.js";
import { depthConfig } from "./depth.js";
import { countSeverities, gradeStructural, computeEpistemic } from "./confidence.js";
import { buildOptimizedPrompt } from "../output/promptOptimizer.js";
import { runSemanticAnalysis } from "../llm/semanticAnalysis.js";
import type { LlmClient } from "../llm/client.js";

export interface CheckOptions {
  depth?: Depth;
  profile?: ContextProfile;
}

const VERSION = "0.3.0";

/** 命题类型 → 中文标签。 */
export const PROPOSITION_LABEL: Record<PropositionType, string> = {
  factual: "实然",
  normative: "应然",
  definitional: "定义",
  mixed: "混合",
};

/**
 * 构造「最小可存活版本」（离线模板）。
 * 刻意保留操作化 + 证伪依据，避免退化成不可证伪的安全废话。
 * 启用 LLM 时会被模型的语义版本覆盖。
 */
function buildMinimalVersion(propositionType: PropositionType): string {
  switch (propositionType) {
    case "factual":
      return "在【已声明的语言/版本】与【已声明的边界：空值/异常/并发】前提下，实现满足【输入→输出契约】的功能，并以【可执行的测试用例】作为证伪依据；超出声明范围的行为不成立。";
    case "normative":
      return "在【已声明的前提：目标/约束/取舍权重】一致的前提下，给出满足该前提的方案，并注明其成立所依赖的假设与可被证伪的取舍代价；不宣称唯一正确。";
    case "definitional":
      return "在【约定清晰、边界明确】的前提下给出可用的定义，并注明与相近概念的区分标准；不要求经验证实。";
    case "mixed":
      return "拆分处理：实然部分按【可执行测试】给置信度，应然部分仅检验【前提一致性与边界清晰度】，两者不互相污染。";
  }
}

/**
 * 核心入口（离线）：对一段指令做完整检查，返回中间结果 CheckResult。
 */
export function checkPrompt(text: string, options: CheckOptions = {}): CheckResult {
  const depth = options.depth ?? "L2";
  const profile = options.profile ?? defaultProfile();
  const cfg = depthConfig(depth);

  const propositionType = classifyProposition(text);
  const strongClaim = extractStrongClaim(text);

  const completeness = checkCompleteness(text);
  const cognitive = runCognitiveChecks(text, profile, depth, cfg.activeRules);
  const bias = cfg.biasScan ? scanBias(text) : [];

  // 将缺失的完整性维度也纳入 findings（kind=missing），供追问统一处理。
  const missingFindings: Finding[] = completeness
    .filter((c) => !c.present)
    .map((c) => ({
      id: `completeness-${c.dimension}`,
      dimension: c.dimension,
      kind: "missing",
      severity: c.required ? "warn" : "info",
      title: `缺少：${c.label}`,
      detail: c.question?.reason ?? `未声明「${c.label}」。`,
      evidence: c.evidence,
      question: c.question,
    }));

  const findings: Finding[] = [...missingFindings, ...cognitive];

  const sev = countSeverities(cognitive);
  const biasWarns = bias.filter((b) => b.severity === "warn").length;
  const missingHard = completeness.filter((c) => !c.present && c.required).length;
  const missingSoft = completeness.filter((c) => !c.present && !c.required).length;

  const structural = gradeStructural({
    errorCount: sev.error,
    warnCount: sev.warn,
    infoCount: sev.info,
    missingHard,
    missingSoft,
    biasWarnCount: biasWarns,
  });

  const minimalSurvivableVersion = buildMinimalVersion(propositionType);
  const droppedOverclaims = extractOverclaims(text);

  return {
    propositionType,
    strongClaim,
    findings,
    bias,
    structural,
    minimalSurvivableVersion,
    droppedOverclaims,
  };
}

/** 组装顶层报告（离线）。 */
export function analyze(text: string, options: CheckOptions & { profilePath?: string } = {}): Report {
  const result = checkPrompt(text, options);
  const profile = options.profile ?? defaultProfile();
  const completeness = checkCompleteness(text);

  return {
    meta: {
      tool: "prompt-cog",
      version: VERSION,
      depth: options.depth ?? "L2",
      timestamp: new Date().toISOString(),
      profilePath: options.profilePath,
    },
    propositionType: result.propositionType,
    strongClaim: result.strongClaim,
    completeness,
    cognitive: result.findings.filter((f) => f.kind === "risk"),
    bias: result.bias,
    structural: result.structural,
    minimalSurvivableVersion: result.minimalSurvivableVersion,
    minimalVersionAssessment: assessMinimalVersion(result.minimalSurvivableVersion),
    droppedOverclaims: result.droppedOverclaims,
    questions: result.findings.map((f) => f.question).filter((q): q is NonNullable<typeof q> => Boolean(q)),
    optimizedPrompt: buildOptimizedPrompt(text, result, profile),
  };
}

export interface AnalyzeLlmOptions extends CheckOptions {
  profilePath?: string;
  /** 语义分析所用的 LLM 客户端。 */
  llm: LlmClient;
}

/**
 * 分层入口：在离线报告之上叠加 LLM 语义分析，并据此计算认知置信度。
 * LLM 调用失败时抛错，由调用方回退到离线报告（保持「默认离线」的健壮性）。
 */
export async function analyzeWithLlm(text: string, options: AnalyzeLlmOptions): Promise<Report> {
  const report = analyze(text, {
    depth: options.depth,
    profile: options.profile,
    profilePath: options.profilePath,
  });

  const semantic = await runSemanticAnalysis(text, options.llm);
  report.semantic = semantic;

  if (semantic) {
    // 模型给出的最小可存活版本优先，并重新体检。
    if (semantic.minimalSurvivableVersion) {
      report.minimalSurvivableVersion = semantic.minimalSurvivableVersion;
      report.minimalVersionAssessment = assessMinimalVersion(semantic.minimalSurvivableVersion);
    }
    // 认知置信度（先验 × 似然 − 对抗性折扣 ± 机制项）。
    const epistemic = computeEpistemic({
      propositionType: semantic.propositionType,
      findings: semantic.findings,
      effectiveIndependentEvidence: semantic.effectiveIndependentEvidence,
    });
    report.epistemic = epistemic;
    semantic.epistemic = epistemic;
  }

  return report;
}
