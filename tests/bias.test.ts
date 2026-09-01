import { describe, expect, it } from "vitest";
import { scanBias } from "../src/index.js";

describe("偏向扫描", () => {
  it("检测时效偏向：框架未锁定版本", () => {
    const bias = scanBias("用 React 写个组件");
    expect(bias.some((b) => b.kind === "temporal")).toBe(true);
  });

  it("检测确定性偏向：全称断言", () => {
    const bias = scanBias("这是唯一正确的答案");
    expect(bias.some((b) => b.kind === "certainty")).toBe(true);
  });

  it("检测文化/本地化偏向：区域敏感内容缺本地化", () => {
    const bias = scanBias("处理不同地区的货币和时间");
    expect(bias.some((b) => b.kind === "cultural")).toBe(true);
  });

  it("锁定版本时不报时效偏向", () => {
    const bias = scanBias("用 React 18 写个组件");
    expect(bias.some((b) => b.kind === "temporal")).toBe(false);
  });
});
