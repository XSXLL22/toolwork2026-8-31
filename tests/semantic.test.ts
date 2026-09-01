import { describe, expect, it } from "vitest";
import {
  analyzeWithLlm,
  buildSemanticPrompt,
  extractJson,
  parseSemanticResult,
  type LlmClient,
} from "../src/index.js";

const fakeLlm = (response: string): LlmClient => ({ complete: async () => response });

const SAMPLE_JSON = JSON.stringify({
  propositionType: "mixed",
  strongClaim: "用 Redux 统一管理状态",
  effectiveIndependentEvidence: 1,
  findings: [
    { rule: 1, verdict: "risk", reasoning: "未声明语言与版本", suggestion: "请指定运行时" },
    { rule: 10, verdict: "risk", reasoning: "强制 Redux 未说明依据", suggestion: "确认是否为项目约束" },
  ],
  minimalSurvivableVersion: "在指定语言版本与边界前提下，用 Redux 重构，并以测试用例证伪",
  droppedOverclaims: ["必须用 Redux"],
});

describe("语义分析提示词", () => {
  it("包含十一条规则分层与指令原文", () => {
    const p = buildSemanticPrompt("写个排序算法");
    expect(p).toContain("十一条规则");
    expect(p).toContain("自洽—真实性分离");
    expect(p).toContain("范式自反原则");
    expect(p).toContain("写个排序算法");
    expect(p).toContain("JSON");
  });
});

describe("JSON 抽取", () => {
  it("剥离 markdown 围栏", () => {
    const raw = "```json\n{\"a\":1}\n```";
    expect(extractJson(raw)).toBe('{"a":1}');
  });

  it("容忍前后杂文", () => {
    const raw = "好的，结果如下：\n{\"a\":1}\n希望有帮助";
    expect(extractJson(raw)).toBe('{"a":1}');
  });
});

describe("语义结果解析", () => {
  it("解析合法 JSON", () => {
    const r = parseSemanticResult(SAMPLE_JSON, "写个排序算法");
    expect(r.propositionType).toBe("mixed");
    expect(r.findings.length).toBe(2);
    expect(r.findings[0]?.ruleId).toBe("rule-1");
    expect(r.findings[0]?.verdict).toBe("risk");
    expect(r.droppedOverclaims).toContain("必须用 Redux");
  });

  it("解析失败时返回空结果并保留 raw", () => {
    const r = parseSemanticResult("这不是 JSON", "写个排序算法");
    expect(r.findings).toEqual([]);
    expect(r.raw).toBe("这不是 JSON");
  });
});

describe("analyzeWithLlm 分层入口", () => {
  it("在离线报告之上叠加语义分析与认知置信度", async () => {
    const report = await analyzeWithLlm("重构登录模块，必须用 Redux", { depth: "L2", llm: fakeLlm(SAMPLE_JSON) });
    expect(report.semantic).toBeDefined();
    expect(report.semantic?.findings.length).toBe(2);
    expect(report.semantic?.effectiveIndependentEvidence).toBe(1);
    // 认知置信度已计算（分离于结构完整度）
    expect(report.epistemic).toBeDefined();
    expect(report.epistemic?.prior).toBeGreaterThan(0);
    expect(report.epistemic?.likelihood).toBeGreaterThan(0);
    // 离线部分仍然存在
    expect(report.structural).toBeDefined();
    expect(report.completeness.length).toBeGreaterThan(0);
    expect(report.optimizedPrompt.fullText).toContain("优化后的 Prompt");
  });
});
