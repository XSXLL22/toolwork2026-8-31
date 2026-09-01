import type { ResponseFilterResult, ResponseIssue } from "../types.js";
import { hasAny, UNIVERSAL_WORDS } from "../text.js";

/**
 * 输出侧后处理过滤：检测 AI 响应中可能携带的偏向与认知问题。
 * 当前版本仅做标记与提示，不自动改写（自动重写列为未来扩展方向）。
 */
export function filterResponse(text: string): ResponseFilterResult {
  const issues: ResponseIssue[] = [];

  // 1. 未声明的全称断言
  if (hasAny(text, UNIVERSAL_WORDS)) {
    issues.push({
      id: "resp-universal",
      severity: "warn",
      title: "未声明的全称断言",
      detail: "文本含「所有/任何/总是/从不/绝对」等全称断言，若无适用范围限定，可能过度外推。",
      evidence: [],
    });
  }

  // 2. 未引用来源的「研究表明」
  if (/研究表明|研究显示|有研究表明|据研究|数据显示|statistics show|studies show|research shows/i.test(text)) {
    issues.push({
      id: "resp-unsourced",
      severity: "warn",
      title: "未引用来源的研究断言",
      detail: "出现「研究表明/数据显示」类断言但未见来源引用，需补充出处或降级为待证假设。",
      evidence: [],
    });
  }

  // 3. 混淆实然与应然
  const normative = hasAny(text, ["应该", "必须", "最好", "最佳", "推荐", "应当"]);
  const factual = /能跑|运行|输出|结果|实现|通过|正确|可执行/.test(text);
  if (normative && factual) {
    issues.push({
      id: "resp-is-ought",
      severity: "info",
      title: "可能混淆实然与应然",
      detail: "文本同时陈述「能运行/正确」（实然）与「应该/最好」（应然），两者证据门槛不同，需区分。",
      evidence: [],
    });
  }

  // 4. 证据不足却给出确定性结论
  const certainty = hasAny(text, ["确定", "肯定", "必然", "无疑", "一定是", "绝对", "唯一", "毫无疑问"]);
  const hasEvidence = /证据|来源|文档|实验|测试|基准|benchmark|示例|引用|源码/.test(text);
  if (certainty && !hasEvidence) {
    issues.push({
      id: "resp-overconfident",
      severity: "warn",
      title: "证据不足却给出确定性结论",
      detail: "文本使用确定性措辞但未见证据/来源/基准支撑，建议降级置信度。",
      evidence: [],
    });
  }

  return {
    passed: issues.length === 0,
    issues,
    suggestions: issues.map((i) => i.title),
  };
}
