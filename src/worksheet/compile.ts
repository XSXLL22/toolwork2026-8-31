import type { ContextProfile, FilledAnswers, Report } from "../types.js";
import type { Recipe } from "../recipe/types.js";
import { translateDefault } from "./translate.js";

/**
 * 把填写结果编译为面向 AI 的指令：
 * - 若 recipe 带 translate 钩子 → 完全交给钩子（彻底自由）。
 * - 否则走默认翻译（回填到结构化分区）。
 */
export function compileWorksheet(
  original: string,
  filled: FilledAnswers,
  report: Report,
  recipe: Recipe,
  profile: ContextProfile,
): string {
  if (recipe.hooks?.translate) {
    return recipe.hooks.translate(filled, { original, report });
  }
  return translateDefault(original, filled, report, recipe, profile);
}

/** 仅合并原始条件（--raw 模式）：不翻译，按「缺失维度 / 追问」分组列出。 */
export function renderRawConditions(filled: FilledAnswers, report: Report): string {
  const labelOf = new Map<string, string>();
  for (const q of report.questions) labelOf.set(q.id, q.text);
  // 完整性维度用更简洁的维度名覆盖问题正文
  for (const c of report.completeness) {
    if (c.question) labelOf.set(c.question.id, c.label);
  }

  const completeness: string[] = [];
  const questions: string[] = [];
  for (const [id, answer] of Object.entries(filled)) {
    if (!answer) continue;
    const label = labelOf.get(id) ?? id;
    if (id.startsWith("completeness-")) completeness.push(`${label}：${answer}`);
    else questions.push(`${label}：${answer}`);
  }

  const L: string[] = ["# 补全后的条件（未翻译）"];
  if (completeness.length) {
    L.push("");
    L.push("## 缺失维度");
    for (const line of completeness) L.push(`- ${line}`);
  }
  if (questions.length) {
    L.push("");
    L.push("## 追问");
    for (const line of questions) L.push(`- ${line}`);
  }
  return L.join("\n");
}
