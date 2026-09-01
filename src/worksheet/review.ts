import type { FilledAnswers, Report } from "../types.js";
import { extractOverclaims } from "../checks/proposition.js";
import { hasAny, VAGUE_WORDS } from "../text.js";

/** 一条被反诘的答案风险。 */
export interface AnswerRisk {
  id: string;
  label: string;
  kind: "weak" | "overclaim";
  detail: string;
  snippet: string;
}

/** 编译收口的「未决风险」：未填硬性维度 + 可疑答案。 */
export interface OpenRisks {
  unansweredRequired: string[];
  answerRisks: AnswerRisk[];
}

/** id → 展示标签（问题正文优先，完整性维度用更简洁的 label 覆盖）。 */
function labelOf(report: Report): Map<string, string> {
  const m = new Map<string, string>();
  for (const q of report.questions) m.set(q.id, q.text);
  for (const c of report.completeness) {
    if (c.question) m.set(c.question.id, c.label);
  }
  return m;
}

/**
 * 反诘用户填写的答案：
 * - 未填写的硬性维度列为「硬性缺失」；
 * - 含绝对/全称断言的答案列为「过强主张」；
 * - 含含糊词的答案列为「弱回答」。
 */
export function reviewAnswers(filled: FilledAnswers, report: Report): OpenRisks {
  const labels = labelOf(report);

  const unansweredRequired = report.completeness
    .filter((c) => c.required && !c.present)
    .filter((c) => {
      const id = c.question?.id ?? `completeness-${c.dimension}`;
      const ans = filled[id];
      return !ans || ans.trim().length === 0;
    })
    .map((c) => c.label);

  const answerRisks: AnswerRisk[] = [];
  for (const [id, answer] of Object.entries(filled)) {
    if (!answer || answer.trim().length === 0) continue;
    const label = labels.get(id) ?? id;

    const overclaims = extractOverclaims(answer);
    if (overclaims.length) {
      answerRisks.push({
        id,
        label,
        kind: "overclaim",
        detail: "答案含绝对/全称断言，可能把条件依赖误写成无条件结论。",
        snippet: overclaims[0]!,
      });
      continue; // 同一答案只报最严重的一类
    }

    if (hasAny(answer, VAGUE_WORDS)) {
      answerRisks.push({
        id,
        label,
        kind: "weak",
        detail: "答案含含糊词，建议具体化到可检验的描述。",
        snippet: answer,
      });
    }
  }

  return { unansweredRequired, answerRisks };
}

/** 若无未决风险则原样返回；否则追加「未决风险（请复核）」段。 */
export function appendOpenRisks(
  text: string,
  filled: FilledAnswers,
  report: Report,
  md: boolean,
): string {
  const { unansweredRequired, answerRisks } = reviewAnswers(filled, report);
  if (!unansweredRequired.length && !answerRisks.length) return text;

  const L: string[] = [text, ""];
  L.push(md ? "## 未决风险（请复核）" : "【未决风险（请复核）】");
  for (const label of unansweredRequired) {
    L.push(`- [硬性缺失] ${label} 未填写`);
  }
  for (const r of answerRisks) {
    const tag = r.kind === "weak" ? "弱回答" : "过强主张";
    L.push(`- [${tag}] ${r.label}：${r.detail}（原文：${r.snippet}）`);
  }
  return L.join("\n");
}
