import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseProfile } from "./schema.js";
import type { ContextProfile } from "../types.js";

/** 默认画像：空偏好，作为没有配置时的基线。 */
export function defaultProfile(): ContextProfile {
  return parseProfile({});
}

/** 生成一份可手填的模板 JSON 文本。 */
export function profileTemplate(): string {
  const template = {
    techStack: {
      languages: ["TypeScript", "Python"],
      frameworks: ["React"],
      databases: ["PostgreSQL"],
      deployment: ["Docker"],
    },
    codeStyle: {
      formatting: "prettier",
      naming: "camelCase",
      comments: "关键逻辑必写注释",
      testFramework: "vitest",
    },
    boundaries: {
      performance: "常规 Web 应用，无硬实时要求",
      security: "默认无敏感数据",
      compatibility: "Node >= 18",
    },
    cognitivePreferences: {
      confidenceStyle: "comparative",
      preferMinimal: true,
      requireMechanism: false,
    },
    outputPreferences: {
      docFormat: "markdown",
      commentLanguage: "中文",
      includeExamples: true,
    },
  };
  return JSON.stringify(template, null, 2) + "\n";
}

/**
 * 加载上下文画像。按优先级：
 * 1. 显式传入的路径；
 * 2. 当前目录的 context_profile.json；
 * 3. 默认画像。
 */
export function loadProfile(profilePath?: string): ContextProfile {
  const candidates = [
    profilePath ? resolve(profilePath) : undefined,
    resolve(process.cwd(), "context_profile.json"),
  ].filter((p): p is string => Boolean(p));

  for (const path of candidates) {
    if (existsSync(path)) {
      const raw = JSON.parse(readFileSync(path, "utf-8"));
      return parseProfile(raw);
    }
  }
  return defaultProfile();
}

/** 将画像写回磁盘。 */
export function saveProfile(profile: ContextProfile, path: string): void {
  writeFileSync(resolve(path), JSON.stringify(profile, null, 2) + "\n", "utf-8");
}
