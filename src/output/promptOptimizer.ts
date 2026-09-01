import type { CheckResult, ContextProfile, OptimizedPrompt } from "../types.js";
import { PROPOSITION_LABEL } from "../engine/run.js";

/**
 * 将原始指令 + 检查结果 + 上下文画像，组装为结构化的优化 Prompt。
 * 输出包含任务描述、命题类型、边界条件、证据基础、认知约束、输出要求、偏向声明。
 */
export function buildOptimizedPrompt(
  original: string,
  result: CheckResult,
  profile: ContextProfile,
): OptimizedPrompt {
  const taskDescription = original.trim();

  const boundaryConditions = collectBoundaries(result, profile);
  const evidenceBasis = collectEvidence(result, profile);
  const cognitiveConstraints = collectConstraints(result);
  const outputRequirements = collectOutputRequirements(profile);
  const biasDeclaration = collectBiasDeclaration(result);

  const fullText = renderMarkdown({
    taskDescription,
    propositionType: result.propositionType,
    strongClaim: result.strongClaim,
    boundaryConditions,
    evidenceBasis,
    cognitiveConstraints,
    outputRequirements,
    biasDeclaration,
    minimalSurvivableVersion: result.minimalSurvivableVersion,
    droppedOverclaims: result.droppedOverclaims,
    structural: result.structural,
  });

  return {
    taskDescription,
    propositionType: result.propositionType,
    boundaryConditions,
    evidenceBasis,
    cognitiveConstraints,
    outputRequirements,
    biasDeclaration,
    fullText,
  };
}

function collectBoundaries(result: CheckResult, profile: ContextProfile): string[] {
  const out: string[] = [];
  const p = profile.boundaries;
  if (p.performance) out.push(`性能：${p.performance}`);
  if (p.security) out.push(`安全：${p.security}`);
  if (p.compatibility) out.push(`兼容性：${p.compatibility}`);
  // 把认知检查中未声明的边界约束作为待补项列出
  for (const f of result.findings) {
    if (f.dimension === "boundary") out.push("【待补】异常 / 空值 / 边界值 / 并发约束（当前未声明）");
    if (f.dimension === "environment") out.push("【待补】目标语言与运行时版本（当前未声明）");
  }
  return dedupe(out);
}

function collectEvidence(result: CheckResult, profile: ContextProfile): string[] {
  const out: string[] = [];
  const ts = profile.techStack;
  if (ts.languages.length) out.push(`语言：${ts.languages.join("、")}`);
  if (ts.frameworks.length) out.push(`框架：${ts.frameworks.join("、")}`);
  if (ts.databases.length) out.push(`数据库：${ts.databases.join("、")}`);
  if (ts.deployment.length) out.push(`部署：${ts.deployment.join("、")}`);
  const hasRef = result.findings.some((f) => f.dimension === "single-sample" || f.dimension === "sample-bias");
  if (hasRef) out.push("【提示】当前参考样本单一或含主观注释，建议补充独立来源交叉验证。");
  return dedupe(out);
}

function collectConstraints(result: CheckResult): string[] {
  return dedupe(result.findings.filter((f) => f.kind === "risk").map((f) => f.title));
}

function collectOutputRequirements(profile: ContextProfile): string[] {
  const out: string[] = [];
  const op = profile.outputPreferences;
  out.push(`格式：${op.docFormat}`);
  out.push(`注释语言：${op.commentLanguage}`);
  if (op.includeExamples) out.push("附示例");
  const cs = profile.cognitivePreferences;
  out.push(`置信度风格：${cs.confidenceStyle === "deterministic" ? "确定性" : cs.confidenceStyle === "comparative" ? "多方案对比" : "概率性"}`);
  if (cs.requireMechanism) out.push("要求解释机制/根因");
  if (cs.preferMinimal) out.push("偏好最简实现");
  // 通用要求：分级置信度 + 最小可存活版本 + 放弃的过强主张
  out.push("输出分级置信度，并给出「最小可存活版本」与「放弃的过强主张」");
  return dedupe(out);
}

function collectBiasDeclaration(result: CheckResult): string[] {
  return dedupe(result.bias.map((b) => `${b.title}：${b.detail}`));
}

interface RenderInput {
  taskDescription: string;
  propositionType: CheckResult["propositionType"];
  strongClaim: string;
  boundaryConditions: string[];
  evidenceBasis: string[];
  cognitiveConstraints: string[];
  outputRequirements: string[];
  biasDeclaration: string[];
  minimalSurvivableVersion: string;
  droppedOverclaims: string[];
  structural: CheckResult["structural"];
}

function renderMarkdown(i: RenderInput): string {
  const lines: string[] = [];
  lines.push("# 优化后的 Prompt");
  lines.push("");
  lines.push("## 任务描述");
  lines.push("");
  lines.push(i.taskDescription);
  lines.push("");
  lines.push(`## 命题类型：${PROPOSITION_LABEL[i.propositionType]}`);
  lines.push("");
  lines.push(`- 最强断言：${i.strongClaim}`);
  lines.push(`- 结构完整度：${(i.structural.value * 100).toFixed(0)}%（${i.structural.level}）`);
  lines.push("");
  if (i.boundaryConditions.length) {
    lines.push("## 边界条件（生效前提）");
    lines.push("");
    for (const b of i.boundaryConditions) lines.push(`- ${b}`);
    lines.push("");
  }
  if (i.evidenceBasis.length) {
    lines.push("## 证据基础");
    lines.push("");
    for (const e of i.evidenceBasis) lines.push(`- ${e}`);
    lines.push("");
  }
  if (i.cognitiveConstraints.length) {
    lines.push("## 认知约束（十一条规则提示）");
    lines.push("");
    for (const c of i.cognitiveConstraints) lines.push(`- ${c}`);
    lines.push("");
  }
  lines.push("## 输出要求");
  lines.push("");
  for (const o of i.outputRequirements) lines.push(`- ${o}`);
  lines.push("");
  if (i.biasDeclaration.length) {
    lines.push("## 偏向声明");
    lines.push("");
    for (const b of i.biasDeclaration) lines.push(`- ${b}`);
    lines.push("");
  }
  lines.push("## 最小可存活版本");
  lines.push("");
  lines.push(i.minimalSurvivableVersion);
  lines.push("");
  if (i.droppedOverclaims.length) {
    lines.push("## 放弃的过强主张");
    lines.push("");
    for (const d of i.droppedOverclaims) lines.push(`- ${d}`);
    lines.push("");
  }
  return lines.join("\n");
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}
