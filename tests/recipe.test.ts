import { describe, expect, it } from "vitest";
import { defaultRecipe, parseRecipe, recipeTemplate, RECIPES } from "../src/index.js";

describe("内置预设", () => {
  it("提供 default / concise / strict / research", () => {
    expect(RECIPES.default).toBeDefined();
    expect(RECIPES.concise).toBeDefined();
    expect(RECIPES.strict).toBeDefined();
    expect(RECIPES.research).toBeDefined();
  });

  it("strict 预设裁剪低严重度", () => {
    expect(RECIPES.strict!.detection.minSeverity).toBe("warn");
  });
});

describe("JSON 配方", () => {
  it("parseRecipe 为缺失字段填充默认值", () => {
    const r = parseRecipe({ name: "x" });
    expect(r.name).toBe("x");
    expect(r.style.tone).toBe("balanced");
    expect(r.detection.minSeverity).toBe("info");
    expect(r.translation.headerFormat).toBe("markdown");
  });

  it("recipeTemplate 可被 parseRecipe 往返解析", () => {
    const r = parseRecipe(JSON.parse(recipeTemplate()));
    expect(r.name).toBe("custom");
    expect(r.style.sectionOrder).toContain("task");
  });

  it("defaultRecipe 返回默认预设", () => {
    expect(defaultRecipe().name).toBe("default");
  });
});
