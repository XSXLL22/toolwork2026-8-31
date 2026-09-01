import { RULES, type DetectionContext } from "../rules/definitions.js";
import type { ContextProfile, Depth, Finding } from "../types.js";

/**
 * 认知健康检查：遍历规则库，对「当前深度激活的规则」逐个运行检测点，
 * 把命中的 Detection 统一包装为 Finding。
 */
export function runCognitiveChecks(
  text: string,
  profile: ContextProfile,
  depth: Depth,
  activeRules: readonly string[],
): Finding[] {
  const ctx: DetectionContext = { text, profile, depth };
  const findings: Finding[] = [];

  for (const rule of RULES) {
    if (!activeRules.includes(rule.id)) continue;
    for (const point of rule.points) {
      const d = point.detect(ctx);
      if (!d) continue;
      findings.push({
        id: point.id,
        ruleId: rule.id,
        dimension: d.dimension,
        kind: "risk",
        severity: d.severity,
        title: d.title,
        detail: d.detail,
        evidence: d.evidence,
        question: d.question,
      });
    }
  }
  return findings;
}
