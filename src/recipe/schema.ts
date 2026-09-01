import { z } from "zod";
import type { Recipe } from "./types.js";
import { defaultRecipe } from "./presets.js";

const SECTION_KEYS = [
  "task",
  "boundary",
  "evidence",
  "constraints",
  "output",
  "bias",
  "minimalVersion",
  "droppedOverclaims",
] as const;

/** prompt-cog.recipe.json 的 Zod 契约。所有字段均有默认值，允许部分填写。 */
export const RecipeSchema = z.object({
  name: z.string().default("custom"),
  style: z
    .object({
      tone: z.enum(["concise", "balanced", "strict"]).default("balanced"),
      sectionOrder: z.array(z.enum(SECTION_KEYS)).default([...SECTION_KEYS]),
      includeEvidence: z.boolean().default(true),
      includeBias: z.boolean().default(true),
      includeMinimalVersion: z.boolean().default(true),
      includeDroppedOverclaims: z.boolean().default(true),
    })
    .default({}),
  detection: z
    .object({
      disabledRules: z.array(z.string()).default([]),
      disabledDimensions: z.array(z.string()).default([]),
      minSeverity: z.enum(["info", "warn", "error"]).default("info"),
    })
    .default({}),
  translation: z
    .object({
      headerFormat: z.enum(["markdown", "plain"]).default("markdown"),
      taskTitle: z.string().default("任务描述"),
    })
    .default({}),
});

export type RecipeInput = z.input<typeof RecipeSchema>;

/** 解析 JSON 配方并填充默认值（缺失字段回落到 default 预设）。 */
export function parseRecipe(raw: unknown): Recipe {
  const base = defaultRecipe();
  const parsed = RecipeSchema.parse(raw ?? {}) as Recipe;
  return { ...base, ...parsed };
}

/** 生成可填写的 JSON 配方骨架（镜像 profileTemplate 的用法）。 */
export function recipeTemplate(): string {
  const template: RecipeInput = {
    name: "custom",
    style: {
      tone: "balanced",
      sectionOrder: [
        "task",
        "boundary",
        "evidence",
        "constraints",
        "output",
        "bias",
        "minimalVersion",
        "droppedOverclaims",
      ],
      includeEvidence: true,
      includeBias: true,
      includeMinimalVersion: true,
      includeDroppedOverclaims: true,
    },
    detection: {
      disabledRules: [],
      disabledDimensions: [],
      minSeverity: "info",
    },
    translation: {
      headerFormat: "markdown",
      taskTitle: "任务描述",
    },
  };
  return JSON.stringify(template, null, 2) + "\n";
}
