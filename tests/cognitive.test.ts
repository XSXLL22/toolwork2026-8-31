import { describe, expect, it } from "vitest";
import { checkPrompt, depthConfig } from "../src/index.js";
import { defaultProfile } from "../src/index.js";

function riskIds(text: string, depth: "L1" | "L2" | "L3" = "L2"): string[] {
  const result = checkPrompt(text, { depth, profile: defaultProfile() });
  return result.findings.filter((f) => f.kind === "risk").map((f) => f.id);
}

describe("认知健康检查（十一条规则）", () => {
  it("规则1：未指定运行环境触发", () => {
    expect(riskIds("写个排序算法")).toContain("r1-env");
    expect(riskIds("用 Python 3.10 写个排序算法")).not.toContain("r1-env");
  });

  it("规则2：单一参考样本触发", () => {
    const text = "照着这个示例写：\n```js\nfunction a(){}\n```";
    expect(riskIds(text)).toContain("r2-single-sample");
  });

  it("规则3：主观注释触发", () => {
    expect(riskIds("参考下面的最佳实践代码来写")).toContain("r3-subjective");
  });

  it("规则4：证据数量未折算为独立证据触发", () => {
    expect(riskIds("100家媒体都报道这个结论")).toContain("r4-common-source");
    expect(riskIds("100家媒体都报道，但来源互相独立，交叉验证过")).not.toContain("r4-common-source");
  });

  it("规则5：实现类任务未定义边界触发", () => {
    expect(riskIds("实现一个队列")).toContain("r5-boundary");
    expect(riskIds("实现一个支持并发和空值处理的队列")).not.toContain("r5-boundary");
  });

  it("规则5：命题未操作化触发", () => {
    expect(riskIds("社交媒体伤害年轻人")).toContain("r5-operational");
  });

  it("规则6：只修复表象触发", () => {
    expect(riskIds("让这段代码不报错")).toContain("r6-surface");
    expect(riskIds("让这段代码不报错，并定位根因")).not.toContain("r6-surface");
  });

  it("规则7：因果主张未说明时序与干预触发", () => {
    expect(riskIds("这个改动导致性能下降")).toContain("r7-causal");
    expect(riskIds("这个改动导致性能下降（通过对照实验验证）")).not.toContain("r7-causal");
  });

  it("规则8：未要求替代方案触发", () => {
    expect(riskIds("设计一个缓存方案")).toContain("r8-alternative");
    expect(riskIds("设计一个缓存方案，对比 Redis 和本地缓存")).not.toContain("r8-alternative");
  });

  it("规则9：只寻支持未寻反例触发", () => {
    expect(riskIds("论证一下为什么这个方案是对的")).toContain("r9-adversarial");
  });

  it("规则10：强制选型触发", () => {
    expect(riskIds("必须用 Redux 重构状态管理")).toContain("r10-forced");
  });

  it("规则11：结论绝对化触发", () => {
    expect(riskIds("这是唯一正确的做法")).toContain("r11-self");
  });

  it("L1 仅激活规则1与规则5", () => {
    expect(depthConfig("L1").activeRules).toEqual(["rule-1", "rule-5"]);
    const ids = riskIds("实现一个队列", "L1");
    expect(ids).toContain("r1-env");
    expect(ids).toContain("r5-boundary");
    expect(ids).not.toContain("r6-surface");
  });
});
