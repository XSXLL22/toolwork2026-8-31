import { RULES } from "../rules/definitions.js";
import type { Depth } from "../types.js";

export interface DepthConfig {
  depth: Depth;
  /** 该深度下激活的规则 id。 */
  activeRules: string[];
  /** 是否运行偏向扫描。 */
  biasScan: boolean;
  /** 是否启用深度思辨（当前由更强的启发式近似，LLM 可选接入）。 */
  socratic: boolean;
}

const ALL_RULE_IDS = RULES.map((r) => r.id);

/**
 * 三级介入力度：
 * - L1 快速检查（Lint）：仅硬性缺失 + 明显边界与操作化（规则1、5）。
 * - L2 标准引导（Wizard）：完整十一条规则 + 编程域定制 + 偏向扫描。
 * - L3 深度思辨（Socratic）：完整规则 + 偏向扫描 + 思辨模式。
 */
export function depthConfig(depth: Depth): DepthConfig {
  switch (depth) {
    case "L1":
      return {
        depth,
        activeRules: ["rule-1", "rule-5"],
        biasScan: false,
        socratic: false,
      };
    case "L2":
      return {
        depth,
        activeRules: ALL_RULE_IDS,
        biasScan: true,
        socratic: false,
      };
    case "L3":
      return {
        depth,
        activeRules: ALL_RULE_IDS,
        biasScan: true,
        socratic: true,
      };
  }
}
