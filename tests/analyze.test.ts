import { describe, expect, it } from "vitest";
import { analyze, renderReport, filterResponse } from "../src/index.js";

describe("analyze 端到端", () => {
  it("生成完整报告并包含优化 Prompt", () => {
    const report = analyze("写个排序算法", { depth: "L2" });
    expect(report.propositionType).toBe("factual");
    expect(report.structural.value).toBeLessThan(1);
    expect(report.completeness.length).toBeGreaterThan(0);
    expect(report.questions.length).toBeGreaterThan(0);
    expect(report.optimizedPrompt.fullText).toContain("# 优化后的 Prompt");
    expect(report.minimalSurvivableVersion.length).toBeGreaterThan(0);
    expect(report.minimalVersionAssessment).toBeDefined();
  });

  it("Markdown 报告可渲染", () => {
    const md = renderReport(analyze("写个排序算法"), "markdown");
    expect(md).toContain("prompt-cog");
    expect(md).toContain("完整性检测");
  });

  it("JSON 报告可解析", () => {
    const json = renderReport(analyze("写个排序算法"), "json");
    const parsed = JSON.parse(json);
    expect(parsed.meta.tool).toBe("prompt-cog");
  });
});

describe("输出侧过滤", () => {
  it("检测全称断言", () => {
    const res = filterResponse("所有情况下都应该使用单例模式");
    expect(res.issues.some((i) => i.id === "resp-universal")).toBe(true);
  });

  it("检测无来源的研究断言", () => {
    const res = filterResponse("研究表明，这个方案总是更好");
    expect(res.issues.some((i) => i.id === "resp-unsourced")).toBe(true);
  });

  it("干净文本通过", () => {
    const res = filterResponse("该函数接收一个数字并返回其平方。");
    expect(res.passed).toBe(true);
  });
});
