import type { PropositionType } from "../types.js";
import { hasAny, NORMATIVE_WORDS, UNIVERSAL_WORDS, snippets } from "../text.js";

/** 实然信号词。 */
const FACTUAL_WORDS = ["实现", "修复", "运行", "能跑", "输出", "结果", "不报错", "通过", "开发", "写", "排查", "implement", "fix", "run"];
/** 定义命题信号词。 */
const DEFINITIONAL_WORDS = ["什么是", "定义", "解释一下", "名词解释", "术语", "区别", "概念", "define", "what is", "是什么意思", "讲清楚"];

/**
 * 标定命题类型（规则7 的第一步）。
 * 混合命题当实然与应然同时出现时判为 mixed。
 */
export function classifyProposition(text: string): PropositionType {
  const factual = hasAny(text, FACTUAL_WORDS);
  const normative = hasAny(text, NORMATIVE_WORDS);
  const definitional = hasAny(text, DEFINITIONAL_WORDS);

  if (definitional && !factual && !normative) return "definitional";
  if (normative && factual) return "mixed";
  if (normative) return "normative";
  return "factual";
}

/**
 * 提取「最强、最无条件」的断言。
 * 优先取含全称/价值判断词的句子，否则取首行。
 */
export function extractStrongClaim(text: string): string {
  const sentences = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const universal = sentences.find((s) => hasAny(s, UNIVERSAL_WORDS) || hasAny(s, NORMATIVE_WORDS));
  if (universal) return universal.slice(0, 200);
  return (sentences[0] ?? text).slice(0, 200);
}

/** 提取全称/绝对断言片段，作为「放弃的过强主张」的候选。 */
export function extractOverclaims(text: string): string[] {
  const re = /[^。\n]*(?:所有|任何|全部|总是|从不|永远|绝对|毫无例外|一律|最好|最佳|最优|唯一|必须|every|always|never|absolutely)[^。\n]*/gi;
  return snippets(text, re, 5);
}
