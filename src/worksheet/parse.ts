import type { FilledAnswers } from "../types.js";

/** 抽取嵌入的原始指令（<!-- ORIGINAL --> … <!-- /ORIGINAL -->）。 */
export function extractOriginal(text: string): string {
  const m = /<!--\s*ORIGINAL\s*-->([\s\S]*?)<!--\s*\/ORIGINAL\s*-->/.exec(text);
  return (m ? m[1]! : "").trim();
}

/** 解析工作表，返回 id → 答案。跳过空值 / 纯下划线占位。 */
export function parseWorksheet(text: string): FilledAnswers {
  const out: FilledAnswers = {};
  const re = /^\[([^\]]+)\]\s*[^：:]*[：:]\s*(.+?)\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const id = m[1]!.trim();
    const value = m[2]!.trim();
    if (!value || /^_+$/.test(value)) continue;
    out[id] = value;
  }
  return out;
}
