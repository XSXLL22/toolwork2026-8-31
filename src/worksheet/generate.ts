import type { Report, WorksheetSlot } from "../types.js";
import type { Recipe } from "../recipe/types.js";
import { PROPOSITION_LABEL } from "../engine/run.js";

const FILL = "________";

/** 收集工作表插槽：缺失维度（第一节）+ 认知/规则追问（第二节）。 */
export function collectSlots(report: Report, recipe: Recipe): WorksheetSlot[] {
  const slots: WorksheetSlot[] = [];

  for (const c of report.completeness) {
    if (c.present) continue;
    if (recipe.detection.disabledDimensions.includes(c.dimension)) continue;
    // minSeverity 越高，越少纳入「软」维度（非硬性缺失）。
    if (!c.required && recipe.detection.minSeverity === "error") continue;
    slots.push({
      id: c.question?.id ?? `completeness-${c.dimension}`,
      group: "completeness",
      label: c.label + (c.required ? "（硬）" : ""),
      question: c.question?.text ?? c.label,
      options: c.question?.options,
      required: c.required,
    });
  }

  for (const q of report.questions) {
    if (!q.ruleId) continue; // 完整性维度已在第一节列出
    if (recipe.detection.disabledRules.includes(q.ruleId)) continue;
    slots.push({
      id: q.id,
      group: "question",
      label: q.text,
      question: q.text,
      options: q.options,
      required: false,
    });
  }

  return slots;
}

/** 生成可填写的 txt 工作表（嵌入原始指令，编译时可自包含地重建报告）。 */
export function buildWorksheet(report: Report, recipe: Recipe): string {
  const original = report.optimizedPrompt.taskDescription;
  const slots = collectSlots(report, recipe);
  const completeness = slots.filter((s) => s.group === "completeness");
  const questions = slots.filter((s) => s.group === "question");

  const L: string[] = [];
  L.push("============================================================");
  L.push(" prompt-cog 补全工作表");
  L.push("============================================================");
  L.push(`深度：${report.meta.depth}   命题类型：${PROPOSITION_LABEL[report.propositionType]}`);
  L.push("");
  L.push("<!-- ORIGINAL -->");
  L.push(original);
  L.push("<!-- /ORIGINAL -->");
  L.push("");

  if (completeness.length) {
    L.push("------------------------------------------------------------");
    L.push(" 一、缺失维度（在冒号后填写，可留空跳过）");
    L.push("------------------------------------------------------------");
    for (const s of completeness) {
      L.push(`[${s.id}] ${s.label}：${FILL}`);
      if (s.options?.length) L.push(`  选项：${s.options.join(" / ")}`);
    }
    L.push("");
  }

  if (questions.length) {
    L.push("------------------------------------------------------------");
    L.push(" 二、追问（在冒号后填写，可留空跳过）");
    L.push("------------------------------------------------------------");
    for (const s of questions) {
      L.push(`[${s.id}] ${s.question}：${FILL}`);
      if (s.options?.length) L.push(`  选项：${s.options.join(" / ")}`);
    }
    L.push("");
  }

  L.push("============================================================");
  L.push("填写完成后运行：prompt-cog compile 本文件.txt --out 指令.txt");
  L.push("默认翻译为面向 AI 的指令；加 --raw 仅合并原始条件。");
  L.push("============================================================");
  return L.join("\n");
}
