import { z } from "zod";
import type { ContextProfile } from "../types.js";

/** context_profile.json 的 Zod 校验契约。所有字段均有默认值，允许部分填写。 */
export const ContextProfileSchema = z.object({
  techStack: z
    .object({
      languages: z.array(z.string()).default([]),
      frameworks: z.array(z.string()).default([]),
      databases: z.array(z.string()).default([]),
      deployment: z.array(z.string()).default([]),
    })
    .default({}),
  codeStyle: z
    .object({
      formatting: z.string().default(""),
      naming: z.string().default(""),
      comments: z.string().default(""),
      testFramework: z.string().default(""),
    })
    .default({}),
  boundaries: z
    .object({
      performance: z.string().default(""),
      security: z.string().default(""),
      compatibility: z.string().default(""),
    })
    .default({}),
  cognitivePreferences: z
    .object({
      confidenceStyle: z
        .enum(["deterministic", "comparative", "probabilistic"])
        .default("comparative"),
      preferMinimal: z.boolean().default(true),
      requireMechanism: z.boolean().default(false),
    })
    .default({}),
  outputPreferences: z
    .object({
      docFormat: z.enum(["markdown", "plain", "json"]).default("markdown"),
      commentLanguage: z.string().default("中文"),
      includeExamples: z.boolean().default(true),
    })
    .default({}),
});

export type ContextProfileInput = z.input<typeof ContextProfileSchema>;
export type ContextProfileOutput = z.output<typeof ContextProfileSchema>;

/** 解析并填充默认值。 */
export function parseProfile(raw: unknown): ContextProfile {
  return ContextProfileSchema.parse(raw ?? {}) as ContextProfile;
}
