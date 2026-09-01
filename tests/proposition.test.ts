import { describe, expect, it } from "vitest";
import { classifyProposition, extractStrongClaim, extractOverclaims } from "../src/index.js";

describe("命题类型标定", () => {
  it("识别实然命题", () => {
    expect(classifyProposition("实现一个用户登录接口")).toBe("factual");
  });

  it("识别应然命题", () => {
    expect(classifyProposition("代码应该尽量优雅")).toBe("normative");
  });

  it("识别定义命题", () => {
    expect(classifyProposition("什么是纯函数？解释一下概念")).toBe("definitional");
  });

  it("识别混合命题", () => {
    expect(classifyProposition("帮我写一个最好的排序实现")).toBe("mixed");
  });
});

describe("强版本断言提取", () => {
  it("提取含价值判断的首句", () => {
    const claim = extractStrongClaim("帮我写一个最好的排序实现\n要求可运行");
    expect(claim).toContain("最好");
  });

  it("无价值判断时取首行", () => {
    expect(extractStrongClaim("实现一个队列\n处理入队出队")).toBe("实现一个队列");
  });
});

describe("过强主张提取", () => {
  it("提取全称断言", () => {
    const over = extractOverclaims("所有情况下都应该用单例模式");
    expect(over.length).toBeGreaterThan(0);
    expect(over[0]).toContain("所有");
  });
});
