/**
 * prompt-cog 核心类型定义。
 *
 * 这些类型是整条「检测 → 追问 → 优化输出」链路的公共契约，
 * CLI、SDK、以及未来的 VS Code 插件 / 中间件节点都依赖它们。
 */

/** 命题类型：实然 / 应然 / 定义 / 混合。用于标定命题，决定证据门槛。 */
export type PropositionType = "factual" | "normative" | "definitional" | "mixed";

/** 介入深度：L1 快速检查 / L2 标准引导 / L3 深度思辨。 */
export type Depth = "L1" | "L2" | "L3";

/** 发现严重度。 */
export type Severity = "info" | "warn" | "error";

/**
 * 单个检测发现。既用于「完整性缺失」，也用于「认知健康风险」与「偏向」。
 * kind 区分三者，便于下游聚合与过滤。
 */
export type FindingKind = "missing" | "risk" | "bias" | "overclaim";

export interface Question {
  /** 稳定 id，便于引用与去重。 */
  id: string;
  /** 指向的规则 id，如 "rule-2"；完整性/偏向类可为空。 */
  ruleId?: string;
  /** 追问正文。 */
  text: string;
  /** 为什么追问（指向哪条规则 / 哪个维度）。 */
  reason: string;
  /** 建议选项，CLI 向导中以列表形式展示。 */
  options?: string[];
  /** 是否允许跳过（本项目恒为 true，用户始终可控）。 */
  allowSkip: boolean;
  /** 默认值 / 占位提示。 */
  default?: string;
}

export interface Finding {
  /** 稳定 id。 */
  id: string;
  /** 关联规则 id（rule-1 .. rule-11）或维度名。 */
  ruleId?: string;
  /** 维度名，如 boundary / performance / single-sample。 */
  dimension: string;
  kind: FindingKind;
  severity: Severity;
  /** 短标题。 */
  title: string;
  /** 详细说明。 */
  detail: string;
  /** 命中的原文片段。 */
  evidence: string[];
  /** 可选的追问。 */
  question?: Question;
}

/** 偏向类别。 */
export type BiasKind = "cultural" | "temporal" | "disciplinary" | "certainty";

export interface BiasFinding {
  kind: BiasKind;
  severity: Severity;
  title: string;
  detail: string;
  evidence: string[];
}

/**
 * 结构完整度（离线可算）：命题/指令是否可检验、边界是否清晰、是否操作化。
 * 它衡量「这个命题是否可被检验」，不衡量「它是否可信」。
 */
export interface StructuralConfidence {
  /** 0 ~ 1。 */
  value: number;
  level: "high" | "medium" | "low";
  rationale: string[];
}

/**
 * 认知置信度（语义判断，主要来自 LLM 层）：命题在证据下是否可信。
 * 按「先验 × 有效独立证据 − 对抗性折扣 ± 机制项」更新。
 */
export interface EpistemicConfidence {
  /** 0 ~ 1 的最终置信度。 */
  value: number;
  level: "high" | "medium" | "low";
  /** 先验：由命题类型 + 操作化度决定。 */
  prior: number;
  /** 似然：由有效独立证据量决定。 */
  likelihood: number;
  /** 对抗性折扣：反例强度 + 是否主动寻找。 */
  adversarialDiscount: number;
  /** 机制项：可证伪预言加分 / 事后拟合减分。 */
  mechanismAdjustment: number;
  rationale: string[];
}

/** 完整检查结果（内部中间产物）。 */
export interface CheckResult {
  propositionType: PropositionType;
  /** 提取出的「最强、最无条件」的断言。 */
  strongClaim: string;
  findings: Finding[];
  bias: BiasFinding[];
  structural: StructuralConfidence;
  /** 证据不足时仍可保留的最小可存活版本。 */
  minimalSurvivableVersion: string;
  /** 被放弃的过强主张。 */
  droppedOverclaims: string[];
}

/** 单个完整性的维度的判定。 */
export interface CompletenessItem {
  dimension: string;
  label: string;
  present: boolean;
  /** 是否为硬性维度（缺失时提示 warn 及以上）。 */
  required: boolean;
  evidence: string[];
  question?: Question;
}

/** 优化后的结构化 Prompt。 */
export interface OptimizedPrompt {
  taskDescription: string;
  propositionType: PropositionType;
  boundaryConditions: string[];
  evidenceBasis: string[];
  cognitiveConstraints: string[];
  outputRequirements: string[];
  biasDeclaration: string[];
  /** 拼装好的 Markdown 全文。 */
  fullText: string;
}

/** LLM 语义分析给出的单条规则判定。 */
export interface SemanticFinding {
  ruleId: string;
  ruleIndex: number;
  verdict: "ok" | "risk" | "uncertain";
  reasoning: string;
  suggestion: string;
}

/** LLM 语义分析的完整结果（对规则做真正的语义判断）。 */
export interface SemanticAnalysis {
  propositionType: PropositionType;
  strongClaim: string;
  findings: SemanticFinding[];
  minimalSurvivableVersion: string;
  droppedOverclaims: string[];
  /** 认知置信度（由模型给出，或由结果推导）。 */
  epistemic?: EpistemicConfidence;
  /** 有效独立证据量（同源证据已折算）。 */
  effectiveIndependentEvidence?: number;
  /** 模型原始返回文本（解析失败时保留，便于排错）。 */
  raw?: string;
}

/** 最小可存活版本的体检结果。 */
export interface MinimalVersionAssessment {
  valid: boolean;
  issues: string[];
}

/** 输出侧后处理过滤结果。 */
export interface ResponseFilterResult {
  passed: boolean;
  issues: ResponseIssue[];
  /** 可选的自动改写建议（当前版本仅给出提示，不做自动改写）。 */
  suggestions: string[];
}

export interface ResponseIssue {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  evidence: string[];
}

/** 顶层报告：面向人（Markdown）与机器（JSON）的共同载体。 */
export interface Report {
  meta: {
    tool: string;
    version: string;
    depth: Depth;
    timestamp: string;
    profilePath?: string;
  };
  propositionType: PropositionType;
  strongClaim: string;
  completeness: CompletenessItem[];
  cognitive: Finding[];
  bias: BiasFinding[];
  /** 结构完整度（离线，始终存在）。 */
  structural: StructuralConfidence;
  /** 认知置信度（语义/LLM，仅启用 --llm 时存在）。 */
  epistemic?: EpistemicConfidence;
  minimalSurvivableVersion: string;
  /** 最小可存活版本的体检结果（是否保留经验内容 / 可证伪）。 */
  minimalVersionAssessment: MinimalVersionAssessment;
  droppedOverclaims: string[];
  questions: Question[];
  optimizedPrompt: OptimizedPrompt;
  /** 可选的 LLM 语义分析结果（仅当启用 --llm 时存在）。 */
  semantic?: SemanticAnalysis;
}

/** 工作表中的一个可填插槽（缺失维度或追问）。 */
export interface WorksheetSlot {
  /** 稳定键，如 "completeness-environment" 或 "r1-env"。 */
  id: string;
  group: "completeness" | "question";
  /** 短标签（表格/回答区左侧的说明）。 */
  label: string;
  /** 引导问题正文。 */
  question: string;
  options?: string[];
  required: boolean;
}

/** 填写完毕后的答案：id → 答案文本。 */
export type FilledAnswers = Record<string, string>;

/** 上下文画像（context_profile.json）。 */
export interface ContextProfile {
  techStack: {
    languages: string[];
    frameworks: string[];
    databases: string[];
    deployment: string[];
  };
  codeStyle: {
    formatting: string;
    naming: string;
    comments: string;
    testFramework: string;
  };
  boundaries: {
    performance: string;
    security: string;
    compatibility: string;
  };
  cognitivePreferences: {
    /** 对置信度的要求：确定 / 对比 / 概率。 */
    confidenceStyle: "deterministic" | "comparative" | "probabilistic";
    preferMinimal: boolean;
    requireMechanism: boolean;
  };
  outputPreferences: {
    docFormat: "markdown" | "plain" | "json";
    commentLanguage: string;
    includeExamples: boolean;
  };
}
