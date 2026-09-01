/**
 * prompt-cog SDK 入口。
 *
 * 所有面向外部（CLI / 插件 / 中间件 / 第三方集成）的能力都从这里导出。
 */
export type {
  BiasFinding,
  BiasKind,
  CheckResult,
  CompletenessItem,
  ContextProfile,
  Depth,
  EpistemicConfidence,
  Finding,
  FindingKind,
  MinimalVersionAssessment,
  OptimizedPrompt,
  PropositionType,
  Question,
  Report,
  ResponseFilterResult,
  ResponseIssue,
  SemanticAnalysis,
  SemanticFinding,
  Severity,
  StructuralConfidence,
  WorksheetSlot,
  FilledAnswers,
} from "./types.js";

export { ContextProfileSchema, parseProfile } from "./profile/schema.js";
export { defaultProfile, loadProfile, saveProfile, profileTemplate } from "./profile/profile.js";

export { RULES, getRule, rulesByLayer } from "./rules/definitions.js";
export type { Detection, DetectionContext, DetectionPoint, RuleDefinition, RuleLayer } from "./rules/definitions.js";

export { checkCompleteness, hardMissingDimensions } from "./checks/completeness.js";
export { runCognitiveChecks } from "./checks/cognitive.js";
export { scanBias } from "./checks/bias.js";
export { classifyProposition, extractStrongClaim, extractOverclaims } from "./checks/proposition.js";
export { assessMinimalVersion } from "./checks/minimalVersion.js";

export { depthConfig } from "./engine/depth.js";
export type { DepthConfig } from "./engine/depth.js";
export { gradeStructural, computeEpistemic, countSeverities } from "./engine/confidence.js";
export { checkPrompt, analyze, analyzeWithLlm, PROPOSITION_LABEL } from "./engine/run.js";
export type { CheckOptions, AnalyzeLlmOptions } from "./engine/run.js";

export { buildOptimizedPrompt } from "./output/promptOptimizer.js";
export { filterResponse } from "./output/responseFilter.js";
export { renderReport } from "./output/render.js";
export type { RenderFormat } from "./output/render.js";

export { noopLlm, createHttpLlm } from "./llm/client.js";
export type { LlmClient, HttpLlmOptions } from "./llm/client.js";
export { buildSemanticPrompt, parseSemanticResult, extractJson, runSemanticAnalysis } from "./llm/semanticAnalysis.js";

export { RECIPES, defaultRecipe } from "./recipe/presets.js";
export { parseRecipe, recipeTemplate, RecipeSchema } from "./recipe/schema.js";
export { loadRecipe } from "./recipe/load.js";
export type { Recipe, RecipeStyle, DetectionTuning, TranslationTuning, RecipeHooks, RecipeCtx, TranslateCtx, SectionKey } from "./recipe/types.js";

export { buildWorksheet, collectSlots } from "./worksheet/generate.js";
export { parseWorksheet, extractOriginal } from "./worksheet/parse.js";
export { compileWorksheet, renderRawConditions } from "./worksheet/compile.js";
export { translateDefault } from "./worksheet/translate.js";
export { recommend, recommendAnswers } from "./worksheet/recommend.js";
export { reviewAnswers, appendOpenRisks } from "./worksheet/review.js";
export type { AnswerRisk, OpenRisks } from "./worksheet/review.js";

export { startUi, openBrowser } from "./ui/app.js";
export type { StartUiOptions, UiHandle } from "./ui/app.js";
export { dispatch } from "./ui/server.js";
export type { UiDispatchResult } from "./ui/server.js";
export { UI_HTML } from "./ui/html.js";
