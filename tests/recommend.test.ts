import { describe, expect, it } from "vitest";
import {
  analyze,
  buildWorksheet,
  defaultProfile,
  defaultRecipe,
  recommend,
  recommendAnswers,
} from "../src/index.js";
import type { ContextProfile, WorksheetSlot } from "../src/index.js";

const report = analyze("写个排序算法", { depth: "L2" });

function profileWithLangs(langs: string[]): ContextProfile {
  const p = defaultProfile();
  return { ...p, techStack: { ...p.techStack, languages: langs } };
}

describe("推荐答案", () => {
  it("environment 从画像语言回填，无画像时回退首选项", () => {
    expect(recommend("completeness-environment", ["Python 3.10+", "Node.js 18+"], defaultProfile())).toBe("Python 3.10+");
    expect(recommend("completeness-environment", ["Python 3.10+", "Node.js 18+"], profileWithLangs(["TypeScript", "Python"]))).toBe("TypeScript、Python");
  });

  it("confidence 按 confidenceStyle 映射", () => {
    expect(recommend("completeness-confidence", ["确定性答案", "多方案对比"], defaultProfile())).toBe("多方案对比");
  });

  it("其余维度回退首选项", () => {
    expect(recommend("completeness-boundary", ["空值/null 处理", "异常与错误处理"], defaultProfile())).toBe("空值/null 处理");
  });

  it("recommendAnswers 为每个插槽附上推荐", () => {
    const slots: WorksheetSlot[] = [
      { id: "completeness-environment", group: "completeness", label: "环境", question: "语言？", options: ["Python 3.10+", "Node.js 18+"], required: true },
      { id: "completeness-inputOutput", group: "completeness", label: "输入输出", question: "签名？", required: false },
    ];
    const out = recommendAnswers(slots, profileWithLangs(["TypeScript"]));
    expect(out[0]!.recommended).toBe("TypeScript");
    expect(out[1]!.recommended).toBeUndefined();
  });

  it("worksheet 输出含「建议：」行", () => {
    const sheet = buildWorksheet(report, defaultRecipe(), profileWithLangs(["TypeScript", "Python"]));
    expect(sheet).toContain("建议：TypeScript、Python");
  });
});
