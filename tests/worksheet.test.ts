import { describe, expect, it } from "vitest";
import { analyze, buildWorksheet, defaultRecipe, extractOriginal, parseWorksheet } from "../src/index.js";

const report = analyze("写个排序算法", { depth: "L2" });

describe("补全工作表生成", () => {
  it("生成含原始指令、缺失维度与追问插槽的工作表", () => {
    const sheet = buildWorksheet(report, defaultRecipe());
    expect(sheet).toContain("<!-- ORIGINAL -->");
    expect(sheet).toContain("写个排序算法");
    expect(sheet).toContain("[completeness-environment]");
    expect(sheet).toContain("[r1-env]");
    expect(sheet).toContain("________");
    expect(sheet).toContain("一、缺失维度");
    expect(sheet).toContain("二、追问");
  });
});

describe("工作表解析", () => {
  it("回填答案并跳过空占位", () => {
    const sheet = buildWorksheet(report, defaultRecipe());
    const filled = sheet.replace(
      "[completeness-environment] 编程语言 / 环境（硬）：________",
      "[completeness-environment] 编程语言 / 环境（硬）：Python 3.10",
    );
    const answers = parseWorksheet(filled);
    expect(answers["completeness-environment"]).toBe("Python 3.10");
    // 未填写的插槽不进入结果
    expect(answers["completeness-inputOutput"]).toBeUndefined();
  });

  it("extractOriginal 取回嵌入原文", () => {
    const sheet = buildWorksheet(report, defaultRecipe());
    expect(extractOriginal(sheet)).toBe("写个排序算法");
  });
});
