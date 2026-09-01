import type { Report } from "../types.js";
import { PROPOSITION_LABEL } from "../engine/run.js";

export type RenderFormat = "markdown" | "text" | "json";

const SEV_ICON: Record<string, string> = {
  error: "🔴",
  warn: "🟡",
  info: "🔵",
};

const VERDICT_ICON: Record<string, string> = {
  ok: "✅",
  risk: "⚠️",
  uncertain: "❓",
};

/**
 * 将报告渲染为 Markdown / 纯文本 / JSON。
 */
export function renderReport(report: Report, format: RenderFormat = "markdown"): string {
  switch (format) {
    case "json":
      return JSON.stringify(report, null, 2);
    case "text":
      return renderText(report);
    case "markdown":
    default:
      return renderMarkdown(report);
  }
}

function renderMarkdown(r: Report): string {
  const L: string[] = [];
  L.push(`# prompt-cog 检查报告`);
  L.push("");
  L.push(`- 深度：${r.meta.depth}　版本：${r.meta.version}　时间：${r.meta.timestamp}`);
  L.push(`- 命题类型：**${PROPOSITION_LABEL[r.propositionType]}**　最强断言：${r.strongClaim}`);
  L.push(`- 结构完整度：**${(r.structural.value * 100).toFixed(0)}%（${r.structural.level}）**`);
  if (r.epistemic) {
    L.push(`- 认知置信度：**${(r.epistemic.value * 100).toFixed(0)}%（${r.epistemic.level}）**`);
  }
  L.push("");

  L.push(`## 完整性检测`);
  L.push("");
  L.push(`| 维度 | 状态 |`);
  L.push(`| --- | --- |`);
  for (const c of r.completeness) {
    L.push(`| ${c.label}${c.required ? "（硬）" : ""} | ${c.present ? "✅ 已声明" : "❌ 缺失"} |`);
  }
  L.push("");

  if (r.cognitive.length) {
    L.push(`## 认知健康检查（十一条规则）`);
    L.push("");
    for (const f of r.cognitive) {
      L.push(`- ${SEV_ICON[f.severity]} **[${f.ruleId}] ${f.title}**　_${f.severity}_`);
      L.push(`  - ${f.detail}`);
    }
    L.push("");
  }

  if (r.bias.length) {
    L.push(`## 偏向扫描`);
    L.push("");
    for (const b of r.bias) {
      L.push(`- ${SEV_ICON[b.severity]} **[${b.kind}]** ${b.title} — ${b.detail}`);
    }
    L.push("");
  }

  if (r.semantic) {
    L.push(`## 语义分析（LLM）`);
    L.push("");
    L.push(`- 命题类型：**${PROPOSITION_LABEL[r.semantic.propositionType]}**　最强断言：${r.semantic.strongClaim}`);
    if (r.semantic.effectiveIndependentEvidence !== undefined) {
      L.push(`- 有效独立证据量：${r.semantic.effectiveIndependentEvidence}`);
    }
    L.push("");
    for (const f of r.semantic.findings) {
      L.push(`- ${VERDICT_ICON[f.verdict]} **[规则${f.ruleIndex}]** _${f.verdict}_ — ${f.reasoning}`);
      if (f.suggestion) L.push(`  - 建议：${f.suggestion}`);
    }
    L.push("");
  }

  if (r.epistemic) {
    const e = r.epistemic;
    L.push(`## 认知置信度（LLM）`);
    L.push("");
    L.push(`- 最终：**${(e.value * 100).toFixed(0)}%（${e.level}）**`);
    L.push(`- 先验 ${e.prior.toFixed(2)} × 似然 ${e.likelihood.toFixed(2)} − 对抗性折扣 ${e.adversarialDiscount.toFixed(2)} ${e.mechanismAdjustment >= 0 ? "+" : ""}机制项 ${e.mechanismAdjustment.toFixed(2)}`);
    for (const rline of e.rationale) L.push(`  - ${rline}`);
    L.push("");
  }

  L.push(`## 最小可存活版本`);
  L.push("");
  L.push(r.minimalSurvivableVersion);
  if (!r.minimalVersionAssessment.valid) {
    L.push("");
    for (const issue of r.minimalVersionAssessment.issues) L.push(`- ⚠️ ${issue}`);
  }
  L.push("");

  if (r.droppedOverclaims.length) {
    L.push(`## 放弃的过强主张`);
    L.push("");
    for (const d of r.droppedOverclaims) L.push(`- ${d}`);
    L.push("");
  }

  if (r.questions.length) {
    L.push(`## 待补充（追问清单）`);
    L.push("");
    for (const q of r.questions) L.push(`- [${q.ruleId ?? "completeness"}] ${q.text}`);
    L.push("");
  }

  L.push("---");
  L.push("");
  L.push(r.optimizedPrompt.fullText);
  return L.join("\n");
}

function renderText(r: Report): string {
  const L: string[] = [];
  L.push(`prompt-cog 报告 [深度 ${r.meta.depth}]`);
  L.push(`命题类型: ${PROPOSITION_LABEL[r.propositionType]} | 结构完整度: ${(r.structural.value * 100).toFixed(0)}% (${r.structural.level})`);
  if (r.epistemic) L.push(`认知置信度: ${(r.epistemic.value * 100).toFixed(0)}% (${r.epistemic.level})`);
  L.push(`最强断言: ${r.strongClaim}`);
  L.push("");
  L.push("完整性:");
  for (const c of r.completeness) L.push(`  ${c.present ? "[x]" : "[ ]"} ${c.label}${c.required ? " (硬)" : ""}`);
  if (r.cognitive.length) {
    L.push("认知健康:");
    for (const f of r.cognitive) L.push(`  [${f.severity}] [${f.ruleId}] ${f.title}`);
  }
  if (r.bias.length) {
    L.push("偏向:");
    for (const b of r.bias) L.push(`  [${b.severity}] [${b.kind}] ${b.title}`);
  }
  if (r.semantic) {
    L.push(`语义分析(LLM): 命题类型 ${PROPOSITION_LABEL[r.semantic.propositionType]}`);
    for (const f of r.semantic.findings) L.push(`  [${f.verdict}] 规则${f.ruleIndex}: ${f.reasoning}`);
  }
  L.push("");
  L.push(`最小可存活版本: ${r.minimalSurvivableVersion}`);
  if (!r.minimalVersionAssessment.valid) {
    for (const issue of r.minimalVersionAssessment.issues) L.push(`  体检: ${issue}`);
  }
  return L.join("\n");
}
