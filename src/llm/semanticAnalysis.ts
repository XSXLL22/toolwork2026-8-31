import type { LlmClient } from "./client.js";
import type { PropositionType, SemanticAnalysis, SemanticFinding } from "../types.js";
import { RULES, rulesByLayer } from "../rules/definitions.js";

const PROPOSITION_TYPES = new Set(["factual", "normative", "definitional", "mixed"]);
const VERDICTS = new Set(["ok", "risk", "uncertain"]);

/**
 * 构建发给 LLM 的语义分析提示词。
 * 让模型对指令做十一条规则的真正语义判断（而非关键词匹配），
 * 并评估「有效独立证据量」（同源证据已折算）。
 */
export function buildSemanticPrompt(text: string): string {
  const rulesText = rulesByLayer()
    .map((g) => `【${g.layer}】` + g.rules.map((r) => `${r.index}.${r.name}`).join("；"))
    .join("\n");
  const rulesDetail = RULES.map((r) => `${r.index}. ${r.name} —— ${r.principle}`).join("\n");

  return [
    "你是一个认识论排错助手。请对下面这条「待下达给编程 Agent 的指令」做认知健康检查，逐条对照十一条规则给出语义层面的判断。",
    "",
    "规则分层：",
    rulesText,
    "",
    "各规则一句话要义：",
    rulesDetail,
    "",
    "输出要求：",
    "1. 只输出一个 JSON 对象，不要输出任何解释文字、不要用 markdown 代码块包裹。",
    '2. JSON 结构：{"propositionType":"factual|normative|definitional|mixed","strongClaim":"一句话最强断言","effectiveIndependentEvidence":<整数,同源证据折算后>,"findings":[{"rule":1,"verdict":"ok|risk|uncertain","reasoning":"针对本条指令的具体判断，不要套话","suggestion":"可操作的一句话追问或建议"}],"minimalSurvivableVersion":"弱化后仍保留方向/范围/证伪依据的可存活判断","droppedOverclaims":["被放弃的过强主张"]}',
    "3. 对十一条规则逐条输出一个 findings 元素，verdict 取值：ok=无明显问题，risk=存在该问题，uncertain=信息不足无法判断。",
    "4. reasoning 必须落到这条指令的具体内容上，禁止通用模板话术。",
    "5. minimalSurvivableVersion 只能「窄化」（收窄人群/范围/条件），不能「去内容」——必须保留方向或可证伪依据，禁止退化成「可能与某结果存在关联」这类不可证伪的安全废话。",
    "",
    "待检查的指令：",
    text,
  ].join("\n");
}

/** 从模型输出中稳健地抽取 JSON 子串（容忍 ```json 围栏与前后杂文）。 */
export function extractJson(raw: string): string | null {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return cleaned.slice(start, end + 1);
}

/** 解析并归一化模型输出；解析失败时返回空结果（保留 raw 供排错）。 */
export function parseSemanticResult(raw: string, fallbackText: string): SemanticAnalysis {
  const empty = (): SemanticAnalysis => ({
    propositionType: "factual",
    strongClaim: fallbackText.slice(0, 200),
    findings: [],
    minimalSurvivableVersion: "",
    droppedOverclaims: [],
    raw,
  });

  const json = extractJson(raw);
  if (!json) return empty();

  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch {
    return empty();
  }

  const o = obj as Record<string, unknown>;
  const propositionType: PropositionType = PROPOSITION_TYPES.has(o.propositionType as string)
    ? (o.propositionType as PropositionType)
    : "factual";
  const strongClaim = typeof o.strongClaim === "string" ? o.strongClaim : fallbackText.slice(0, 200);

  const findings: SemanticFinding[] = Array.isArray(o.findings)
    ? (o.findings as Array<Record<string, unknown>>)
        .filter((f) => typeof f.rule === "number")
        .map((f) => ({
          ruleId: `rule-${f.rule}`,
          ruleIndex: f.rule as number,
          verdict: (VERDICTS.has(f.verdict as string) ? (f.verdict as SemanticFinding["verdict"]) : "uncertain"),
          reasoning: typeof f.reasoning === "string" ? f.reasoning : "",
          suggestion: typeof f.suggestion === "string" ? f.suggestion : "",
        }))
    : [];

  const minimalSurvivableVersion =
    typeof o.minimalSurvivableVersion === "string" ? o.minimalSurvivableVersion : "";
  const droppedOverclaims = Array.isArray(o.droppedOverclaims)
    ? (o.droppedOverclaims as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

  const effectiveIndependentEvidence =
    typeof o.effectiveIndependentEvidence === "number" ? o.effectiveIndependentEvidence : undefined;

  return {
    propositionType,
    strongClaim,
    findings,
    minimalSurvivableVersion,
    droppedOverclaims,
    effectiveIndependentEvidence,
    raw,
  };
}

/** 运行语义分析。LLM 抛错时向上传播，由调用方决定回退到离线报告。 */
export async function runSemanticAnalysis(text: string, llm: LlmClient): Promise<SemanticAnalysis> {
  const raw = await llm.complete(buildSemanticPrompt(text));
  return parseSemanticResult(raw, text);
}
