import type { ContextProfile, Depth, FilledAnswers, Report, WorksheetSlot } from "../types.js";

/** 翻译分区键。sectionOrder 据此决定分区出现顺序与取舍。 */
export type SectionKey =
  | "task"
  | "boundary"
  | "evidence"
  | "constraints"
  | "output"
  | "bias"
  | "minimalVersion"
  | "droppedOverclaims";

/** 语气与分区控制。 */
export interface RecipeStyle {
  tone: "concise" | "balanced" | "strict";
  /** 分区出现顺序（未列出的分区默认被裁剪，但 task 与 output 始终保留）。 */
  sectionOrder: SectionKey[];
  includeEvidence: boolean;
  includeBias: boolean;
  includeMinimalVersion: boolean;
  includeDroppedOverclaims: boolean;
}

/** 识别微调（简易修改途径）。 */
export interface DetectionTuning {
  /** 关闭的规则 id，如 ["rule-10"]。 */
  disabledRules: string[];
  /** 关闭的完整性维度 key，如 ["performance"]。 */
  disabledDimensions: string[];
  /** 低于该严重度的发现不进入工作表。 */
  minSeverity: "info" | "warn" | "error";
}

/** 翻译微调（简易修改途径）。 */
export interface TranslationTuning {
  headerFormat: "markdown" | "plain";
  /** 任务描述分区标题（可自定义措辞）。 */
  taskTitle: string;
}

/** JS 钩子上下文。 */
export interface RecipeCtx {
  profile: ContextProfile;
  depth: Depth;
}

/** 翻译钩子上下文。 */
export interface TranslateCtx {
  original: string;
  report: Report;
}

/** JS 钩子专属：彻底替换识别与翻译逻辑（无需改源码）。 */
export interface RecipeHooks {
  detect?: (text: string, ctx: RecipeCtx) => WorksheetSlot[];
  translate?: (filled: FilledAnswers, ctx: TranslateCtx) => string;
}

/** 统一配方接口：内置预设 / JSON 配方 / JS 钩子 三者共用。 */
export interface Recipe {
  name: string;
  style: RecipeStyle;
  detection: DetectionTuning;
  translation: TranslationTuning;
  hooks?: RecipeHooks;
}
