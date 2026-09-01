import type { Recipe } from "./types.js";

const ALL_SECTIONS = [
  "task",
  "boundary",
  "evidence",
  "constraints",
  "output",
  "bias",
  "minimalVersion",
  "droppedOverclaims",
] as const;

const baseDetection = {
  disabledRules: [] as string[],
  disabledDimensions: [] as string[],
  minSeverity: "info" as const,
};

/** 内置预设配方：`--recipe <name>` 一键切换翻译风格。 */
export const RECIPES: Record<string, Recipe> = {
  default: {
    name: "default",
    style: {
      tone: "balanced",
      sectionOrder: [...ALL_SECTIONS],
      includeEvidence: true,
      includeBias: true,
      includeMinimalVersion: true,
      includeDroppedOverclaims: true,
    },
    detection: { ...baseDetection },
    translation: { headerFormat: "markdown", taskTitle: "任务描述" },
  },
  concise: {
    name: "concise",
    style: {
      tone: "concise",
      sectionOrder: ["task", "boundary", "output", "minimalVersion"],
      includeEvidence: false,
      includeBias: false,
      includeMinimalVersion: true,
      includeDroppedOverclaims: false,
    },
    detection: { ...baseDetection },
    translation: { headerFormat: "plain", taskTitle: "任务" },
  },
  strict: {
    name: "strict",
    style: {
      tone: "strict",
      sectionOrder: [...ALL_SECTIONS],
      includeEvidence: true,
      includeBias: true,
      includeMinimalVersion: true,
      includeDroppedOverclaims: true,
    },
    detection: { ...baseDetection, minSeverity: "warn" },
    translation: { headerFormat: "markdown", taskTitle: "任务描述（需逐条自检）" },
  },
  research: {
    name: "research",
    style: {
      tone: "strict",
      sectionOrder: [...ALL_SECTIONS],
      includeEvidence: true,
      includeBias: true,
      includeMinimalVersion: true,
      includeDroppedOverclaims: true,
    },
    detection: { ...baseDetection },
    translation: { headerFormat: "markdown", taskTitle: "研究问题" },
  },
};

export function defaultRecipe(): Recipe {
  return RECIPES.default!;
}
