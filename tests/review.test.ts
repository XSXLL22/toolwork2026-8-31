import { describe, expect, it } from "vitest";
import { analyze, appendOpenRisks, reviewAnswers } from "../src/index.js";

const report = analyze("写个排序算法", { depth: "L2" });

describe("弱回答反诘与开放风险", () => {
  it("未填写的硬性维度列为硬性缺失", () => {
    const { unansweredRequired, answerRisks } = reviewAnswers({}, report);
    expect(unansweredRequired).toContain("编程语言 / 环境");
    expect(answerRisks).toHaveLength(0);
  });

  it("干净答案不产生风险", () => {
    const { unansweredRequired, answerRisks } = reviewAnswers({ "completeness-environment": "Python 3.10" }, report);
    expect(unansweredRequired).toHaveLength(0);
    expect(answerRisks).toHaveLength(0);
  });

  it("含糊答案标为弱回答", () => {
    const { answerRisks } = reviewAnswers({ "completeness-boundary": "差不多就行" }, report);
    expect(answerRisks.some((r) => r.kind === "weak" && r.id === "completeness-boundary")).toBe(true);
  });

  it("绝对断言标为过强主张", () => {
    const { answerRisks } = reviewAnswers({ "completeness-boundary": "所有情况都必须处理" }, report);
    expect(answerRisks.some((r) => r.kind === "overclaim" && r.id === "completeness-boundary")).toBe(true);
  });

  it("appendOpenRisks 追加未决风险段，无风险则原样返回", () => {
    const withRisks = appendOpenRisks("正文", {}, report, true);
    expect(withRisks).toContain("## 未决风险（请复核）");
    expect(withRisks).toContain("编程语言 / 环境 未填写");

    const clean = appendOpenRisks("正文", { "completeness-environment": "Python 3.10" }, report, true);
    expect(clean).toBe("正文");
  });
});
