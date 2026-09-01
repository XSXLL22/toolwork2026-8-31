import { describe, expect, it } from "vitest";
import {
  computeEpistemic,
  countSeverities,
  gradeStructural,
  type EpistemicInput,
} from "../src/index.js";
import type { SemanticFinding } from "../src/index.js";

function finding(ruleId: string, verdict: SemanticFinding["verdict"]): SemanticFinding {
  return { ruleId, ruleIndex: Number(ruleId.split("-")[1]), verdict, reasoning: "", suggestion: "" };
}

function epi(partial: Partial<EpistemicInput> & { propositionType: EpistemicInput["propositionType"] }) {
  return computeEpistemic({ findings: [], ...partial });
}

describe("结构完整度（离线）", () => {
  it("无问题时接近满分且为 high", () => {
    const c = gradeStructural({ errorCount: 0, warnCount: 0, infoCount: 0, missingHard: 0, missingSoft: 0, biasWarnCount: 0 });
    expect(c.value).toBeCloseTo(0.95); // 分值上限被钳制在 0.95
    expect(c.level).toBe("high");
  });

  it("问题越多分值越低，并被钳制在 [0.05, 0.95]", () => {
    const many = gradeStructural({ errorCount: 10, warnCount: 0, infoCount: 0, missingHard: 0, missingSoft: 0, biasWarnCount: 0 });
    expect(many.value).toBeCloseTo(0.05);
    const some = gradeStructural({ errorCount: 3, warnCount: 0, infoCount: 0, missingHard: 0, missingSoft: 0, biasWarnCount: 0 });
    expect(some.value).toBeCloseTo(0.55);
    expect(some.level).toBe("medium");
  });
});

describe("认知置信度（语义/LLM）", () => {
  it("应然命题且无证据 → 低置信度", () => {
    const e = epi({ propositionType: "normative" });
    expect(e.prior).toBeCloseTo(0.4);
    expect(e.likelihood).toBeCloseTo(0.5); // 证据量未知取中性
    expect(e.value).toBeCloseTo(0.2);
    expect(e.level).toBe("low");
  });

  it("操作化良好且有多份独立证据 → 置信度上升", () => {
    const e = epi({
      propositionType: "factual",
      effectiveIndependentEvidence: 3,
      findings: [finding("rule-5", "ok")],
    });
    expect(e.prior).toBeCloseTo(0.7); // 0.6 + 操作化 ok 0.1
    expect(e.likelihood).toBeCloseTo(0.8);
    expect(e.value).toBeCloseTo(0.56);
    expect(e.level).toBe("medium");
  });

  it("证据独立性存疑时似然被打折", () => {
    const e = epi({
      propositionType: "factual",
      effectiveIndependentEvidence: 2,
      findings: [finding("rule-4", "risk")],
    });
    expect(e.likelihood).toBeCloseTo(0.36); // 0.6 × 0.6
  });

  it("未寻反例时施加对抗性折扣", () => {
    const e = epi({
      propositionType: "factual",
      effectiveIndependentEvidence: 2,
      findings: [finding("rule-9", "risk")],
    });
    expect(e.adversarialDiscount).toBeCloseTo(0.15);
    expect(e.value).toBeLessThan(0.36); // 0.6×0.6 − 0.15
  });

  it("只拟合表象时机制项为负", () => {
    const e = epi({
      propositionType: "factual",
      findings: [finding("rule-6", "risk")],
    });
    expect(e.mechanismAdjustment).toBeCloseTo(-0.08);
  });

  it("各分量落在合理区间", () => {
    const e = epi({
      propositionType: "mixed",
      effectiveIndependentEvidence: 1,
      findings: [finding("rule-5", "risk"), finding("rule-9", "uncertain"), finding("rule-7", "ok")],
    });
    expect(e.prior).toBeGreaterThanOrEqual(0.2);
    expect(e.likelihood).toBeGreaterThan(0);
    expect(e.adversarialDiscount).toBeGreaterThanOrEqual(0);
    expect(e.value).toBeGreaterThanOrEqual(0.05);
    expect(e.value).toBeLessThanOrEqual(0.95);
    expect(e.rationale.length).toBeGreaterThan(0);
  });
});

describe("严重度统计", () => {
  it("按严重度分组计数", () => {
    const counts = countSeverities([
      { severity: "error" },
      { severity: "error" },
      { severity: "warn" },
      { severity: "info" },
      { severity: "info" },
      { severity: "info" },
    ]);
    expect(counts).toEqual({ error: 2, warn: 1, info: 3 });
  });
});
