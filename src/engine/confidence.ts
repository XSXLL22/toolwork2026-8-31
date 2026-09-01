import type {
  EpistemicConfidence,
  PropositionType,
  SemanticFinding,
  Severity,
  StructuralConfidence,
} from "../types.js";

export interface StructuralInput {
  errorCount: number;
  warnCount: number;
  infoCount: number;
  missingHard: number;
  missingSoft: number;
  biasWarnCount: number;
}

/**
 * 结构完整度（离线可算）：衡量「这个命题/指令是否可检验、边界是否清晰」。
 * 注意：这是形式分，不是真伪置信度——它只回答「能否被检验」，不回答「是否可信」。
 */
export function gradeStructural(input: StructuralInput): StructuralConfidence {
  let value = 1.0;
  value -= input.errorCount * 0.15;
  value -= input.warnCount * 0.08;
  value -= input.infoCount * 0.02;
  value -= input.missingHard * 0.12;
  value -= input.missingSoft * 0.03;
  value -= input.biasWarnCount * 0.03;

  value = Math.max(0.05, Math.min(0.95, value));

  const level: StructuralConfidence["level"] = value >= 0.7 ? "high" : value >= 0.4 ? "medium" : "low";

  const rationale: string[] = [];
  if (input.missingHard > 0) rationale.push(`缺失 ${input.missingHard} 个硬性维度（语言/环境、任务类型等），命题难以检验。`);
  if (input.warnCount > 0) rationale.push(`存在 ${input.warnCount} 处未操作化/边界/证据独立性问题。`);
  if (input.errorCount > 0) rationale.push(`存在 ${input.errorCount} 处严重问题。`);
  if (input.biasWarnCount > 0) rationale.push(`存在 ${input.biasWarnCount} 处确定性/全称偏向。`);
  if (rationale.length === 0) rationale.push("命题已基本操作化、边界清晰，可检验性良好。");

  return { value, level, rationale };
}

export interface EpistemicInput {
  propositionType: PropositionType;
  findings: SemanticFinding[];
  effectiveIndependentEvidence?: number;
}

/** 命题类型 → 先验基值（可证伪性越高、越具体，先验越高；应然命题无经验真值，先验最低）。 */
const PRIOR_BASE: Record<PropositionType, number> = {
  factual: 0.6,
  mixed: 0.55,
  definitional: 0.5,
  normative: 0.4,
};

function clamp(v: number, lo = 0.05, hi = 0.95): number {
  return Math.max(lo, Math.min(hi, v));
}

function verdictOf(findings: SemanticFinding[], ruleId: string): SemanticFinding["verdict"] | undefined {
  return findings.find((f) => f.ruleId === ruleId)?.verdict;
}

/**
 * 认知置信度（语义判断，来自 LLM 层）：
 * 先验（命题类型 + 操作化）× 似然（有效独立证据）− 对抗性折扣 ± 机制项。
 * 这是透明的评分规则，不是形式贝叶斯后验；各分量单独暴露，便于追责。
 */
export function computeEpistemic(input: EpistemicInput): EpistemicConfidence {
  const rationale: string[] = [];

  // 1) 先验
  let prior = PRIOR_BASE[input.propositionType];
  const opVerdict = verdictOf(input.findings, "rule-5");
  if (opVerdict === "risk") prior -= 0.2;
  else if (opVerdict === "uncertain") prior -= 0.1;
  else if (opVerdict === "ok") prior += 0.1;
  prior = clamp(prior, 0.2, 0.85);
  rationale.push(`先验 ${prior.toFixed(2)}（命题类型 ${input.propositionType} + 操作化 ${opVerdict ?? "未评估"}）。`);

  // 2) 似然（有效独立证据量，同源已折算）
  let likelihood: number;
  const n = input.effectiveIndependentEvidence;
  if (n === undefined) {
    likelihood = 0.5;
    rationale.push("有效独立证据量未知，似然取中性 0.50。");
  } else {
    likelihood = n <= 0 ? 0.1 : n === 1 ? 0.4 : n === 2 ? 0.6 : n >= 3 ? 0.8 : 0.5;
    if (verdictOf(input.findings, "rule-4") === "risk") {
      likelihood *= 0.6; // 证据不独立，降权
      rationale.push(`似然 ${likelihood.toFixed(2)}（${n} 个有效独立证据，且因证据独立性存疑打折）。`);
    } else {
      rationale.push(`似然 ${likelihood.toFixed(2)}（${n} 个有效独立证据）。`);
    }
  }

  // 3) 对抗性折扣
  let adversarialDiscount = 0;
  const adv = verdictOf(input.findings, "rule-9");
  if (adv === "risk") adversarialDiscount = 0.15;
  else if (adv === "uncertain") adversarialDiscount = 0.05;
  if (adversarialDiscount > 0) rationale.push(`对抗性折扣 −${adversarialDiscount.toFixed(2)}（未主动寻找反例/不利证据）。`);

  // 4) 机制项
  let mechanismAdjustment = 0;
  for (const ruleId of ["rule-6", "rule-7"]) {
    const v = verdictOf(input.findings, ruleId);
    if (v === "risk") mechanismAdjustment -= 0.08;
    else if (v === "ok") mechanismAdjustment += 0.03;
  }
  mechanismAdjustment = Math.max(-0.16, Math.min(0.06, mechanismAdjustment));
  if (mechanismAdjustment > 0) rationale.push(`机制项 +${mechanismAdjustment.toFixed(2)}（有根因/因果识别）。`);
  else if (mechanismAdjustment < 0) rationale.push(`机制项 ${mechanismAdjustment.toFixed(2)}（只拟合表象/混淆因果）。`);

  const value = clamp(prior * likelihood - adversarialDiscount + mechanismAdjustment);
  const level: EpistemicConfidence["level"] = value >= 0.6 ? "high" : value >= 0.35 ? "medium" : "low";

  return { value, level, prior, likelihood, adversarialDiscount, mechanismAdjustment, rationale };
}

/** 统计 Finding 列表中的严重度分布。 */
export function countSeverities(items: Array<{ severity: Severity }>): {
  error: number;
  warn: number;
  info: number;
} {
  let error = 0;
  let warn = 0;
  let info = 0;
  for (const it of items) {
    if (it.severity === "error") error++;
    else if (it.severity === "warn") warn++;
    else info++;
  }
  return { error, warn, info };
}
