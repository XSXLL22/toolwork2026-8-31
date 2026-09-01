import { describe, expect, it } from "vitest";
import { checkCompleteness, hardMissingDimensions } from "../src/index.js";

describe("完整性检测", () => {
  it("识别缺失的语言/环境", () => {
    const items = checkCompleteness("写个排序算法");
    const env = items.find((i) => i.dimension === "environment");
    expect(env?.present).toBe(false);
    expect(env?.required).toBe(true);
  });

  it("识别声明的语言", () => {
    const items = checkCompleteness("用 Python 3.10 写个排序算法");
    const env = items.find((i) => i.dimension === "environment");
    expect(env?.present).toBe(true);
  });

  it("识别任务类型", () => {
    const items = checkCompleteness("修复登录页的 bug");
    const task = items.find((i) => i.dimension === "taskType");
    expect(task?.present).toBe(true);
    expect(task?.evidence).toContain("修复 Bug");
  });

  it("硬性缺失只返回必填维度", () => {
    const hard = hardMissingDimensions("写个排序算法");
    const keys = hard.map((h) => h.dimension);
    expect(keys).toContain("environment");
    expect(keys).not.toContain("performance");
  });
});
