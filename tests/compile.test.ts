import { describe, expect, it } from "vitest";
import {
  analyze,
  compileWorksheet,
  defaultProfile,
  defaultRecipe,
  RECIPES,
  renderRawConditions,
} from "../src/index.js";

const report = analyze("写个排序算法", { depth: "L2" });
const profile = defaultProfile();

describe("编译翻译", () => {
  it("默认翻译回填环境与边界答案", () => {
    const filled = { "completeness-environment": "Python 3.10", "completeness-boundary": "处理空数组" };
    const out = compileWorksheet("写个排序算法", filled, report, defaultRecipe(), profile);
    expect(out).toContain("优化后的指令");
    expect(out).toContain("Python 3.10");
    expect(out).toContain("处理空数组");
  });

  it("raw 模式仅合并原始条件", () => {
    const filled = { "completeness-environment": "Python 3.10" };
    const out = renderRawConditions(filled, report);
    expect(out).toContain("补全后的条件（未翻译）");
    expect(out).toContain("编程语言 / 环境：Python 3.10");
  });

  it("concise 配方切换分区与纯文本格式", () => {
    const filled = { "completeness-environment": "Python 3.10" };
    const out = compileWorksheet("写个排序算法", filled, report, RECIPES.concise!, profile);
    expect(out).toContain("【任务】");
    expect(out).toContain("Python 3.10");
    expect(out).not.toContain("证据基础");
  });

  it("JS 钩子 translate 彻底覆盖", () => {
    const recipe = { ...defaultRecipe(), hooks: { translate: (f) => "CUSTOM:" + Object.keys(f).sort().join(",") } };
    const out = compileWorksheet("x", { a: "1", b: "2" }, report, recipe, profile);
    expect(out).toBe("CUSTOM:a,b");
  });
});
