/**
 * 最小可存活版本体检。
 *
 * 约束（来自用户对「最小可存活版本可能被滥用」的修正）：
 * 弱化必须走「窄化」（收窄范围/人群/条件），不许走「去内容」（删掉方向、退化成不可证伪的安全废话）。
 * 最小可存活版本必须保留经验内容——能产生区分性预测或实际解释价值。
 */

export interface MinimalVersionAssessment {
  valid: boolean;
  issues: string[];
}

/** 不可证伪的弱化词：只含它们而没有认知承诺时，即为「安全废话」。 */
const HEDGE_WORDS = ["可能", "也许", "或许", "不一定", "相关", "关联", "似乎", "大概", "某种程度", "倾向", "或存在"];

/** 认知承诺词：方向 / 范围 / 证伪依据。出现任一即视为保留了经验内容。 */
const COMMITMENT_WORDS = [
  // 方向性
  "正相关", "负相关", "增加", "减少", "上升", "下降", "导致", "提高", "降低",
  "无关", "无影响", "显著", "低于", "高于", "更快", "更慢",
  // 范围 / 边界
  "条件下", "范围内", "前提下", "人群", "场景", "约束", "版本", "时间窗", "规模", "边界",
  // 证伪依据
  "证伪", "检验", "验证", "反例", "推翻", "测试", "用例", "基准", "对照组", "观察",
];

/**
 * 体检最小可存活版本：是否退化成不可证伪的安全废话，或失去区分性预测。
 */
export function assessMinimalVersion(mv: string): MinimalVersionAssessment {
  const issues: string[] = [];
  const hasHedge = HEDGE_WORDS.some((w) => mv.includes(w));
  const hasCommitment = COMMITMENT_WORDS.some((w) => mv.includes(w));

  if (hasHedge && !hasCommitment) {
    issues.push("退化为不可证伪的安全废话：只含「可能/也许/相关」等弱化词，未保留任何经验承诺。");
  }
  if (!hasCommitment) {
    issues.push("缺少区分性预测：应保留方向（增/减/无关）、范围（人群/时间/条件）或证伪依据（什么观察会推翻它）。");
  }

  return { valid: issues.length === 0, issues };
}
