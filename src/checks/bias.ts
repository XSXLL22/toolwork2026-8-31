import type { BiasFinding } from "../types.js";
import {
  detectFrameworks,
  hasAny,
  hasFrameworkVersion,
  LOCALIZATION_WORDS,
  LOCALE_SENSITIVE_WORDS,
  UNIVERSAL_WORDS,
} from "../text.js";

/**
 * 偏向性扫描：文化 / 时效 / 学科 / 确定性 四类偏向的确定性启发式。
 * 均为提示级（info/warn），不阻断，供用户自主判断。
 */
export function scanBias(text: string): BiasFinding[] {
  const findings: BiasFinding[] = [];

  // 文化 / 本地化偏向
  if (hasAny(text, LOCALE_SENSITIVE_WORDS) && !hasAny(text, LOCALIZATION_WORDS)) {
    findings.push({
      kind: "cultural",
      severity: "info",
      title: "可能存在本地化/文化偏向",
      detail: "文本涉及时间、日期、货币、单位、排序等区域敏感内容，但未提及本地化/国际化/时区处理，可能默认了单一地区的假设。",
      evidence: [],
    });
  }

  // 时效偏向
  const frameworks = detectFrameworks(text);
  if (frameworks.length > 0 && !hasFrameworkVersion(text)) {
    findings.push({
      kind: "temporal",
      severity: "info",
      title: "引用框架/库但未锁定版本",
      detail: `检测到 ${frameworks.slice(0, 3).join("、")} 等框架/库，但未标注版本。API 与行为可能随版本漂移，结论存在时效偏向。`,
      evidence: frameworks,
    });
  }

  // 确定性偏向
  if (hasAny(text, UNIVERSAL_WORDS) || hasAny(text, ["唯一答案", "唯一", "最优", "绝对", "唯一解"])) {
    findings.push({
      kind: "certainty",
      severity: "warn",
      title: "可能存在确定性偏向",
      detail: "文本含全称/绝对断言，或追求唯一最优解，可能忽视工程实践中普遍存在的权衡与条件依赖。",
      evidence: [],
    });
  }

  // 学科偏向
  const isArch = /架构|设计|选型|系统|方案/.test(text);
  const algoOnly = /算法|时间复杂度|复杂度/.test(text);
  const noOps = !/成本|部署|维护|安全|可观测|运维|扩展性|可测试/.test(text);
  if (isArch && algoOnly && noOps) {
    findings.push({
      kind: "disciplinary",
      severity: "info",
      title: "可能仅从单一学科视角看问题",
      detail: "架构/选型类任务若只关注算法复杂度，忽略成本、部署、安全、运维等工程维度，会形成学科偏向。",
      evidence: [],
    });
  }

  return findings;
}
