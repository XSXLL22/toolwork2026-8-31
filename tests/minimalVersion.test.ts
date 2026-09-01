import { describe, expect, it } from "vitest";
import { assessMinimalVersion } from "../src/index.js";

describe("最小可存活版本体检（保留经验内容，不退化）", () => {
  it("退化为安全废话时判为无效", () => {
    const a = assessMinimalVersion("可能与某结果存在关联，具体情况不一定");
    expect(a.valid).toBe(false);
    expect(a.issues.length).toBeGreaterThan(0);
    // 命中「只含弱化词、无认知承诺」
    expect(a.issues.some((i) => i.includes("安全废话"))).toBe(true);
  });

  it("缺少区分性预测时判为无效", () => {
    const a = assessMinimalVersion("这个方案也许可行");
    expect(a.valid).toBe(false);
    expect(a.issues.some((i) => i.includes("区分性预测"))).toBe(true);
  });

  it("保留了方向、范围与证伪依据时判为有效", () => {
    const a = assessMinimalVersion("在≥20支/天、18-30岁男性人群中正相关（可被队列数据推翻）");
    expect(a.valid).toBe(true);
    expect(a.issues).toEqual([]);
  });

  it("实现类契约版本同样有效", () => {
    const a = assessMinimalVersion("在 Node.js 18 下实现满足输入→输出契约的队列，并以测试用例作为证伪依据");
    expect(a.valid).toBe(true);
  });
});
