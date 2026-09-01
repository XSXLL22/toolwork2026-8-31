import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Recipe, RecipeHooks } from "./types.js";
import { defaultRecipe, RECIPES } from "./presets.js";
import { parseRecipe } from "./schema.js";

/**
 * 统一加载配方：
 * - undefined / 预设名 → 内置预设
 * - *.json → JSON 配方（parseRecipe 校验 + 默认值）
 * - *.js / *.mjs / *.cjs → JS 钩子（动态 import，可彻底替换 detect/translate）
 */
export async function loadRecipe(spec?: string): Promise<Recipe> {
  if (!spec) return defaultRecipe();
  if (RECIPES[spec]) return RECIPES[spec]!;

  if (spec.endsWith(".json")) {
    const raw = readFileSync(resolve(spec), "utf-8");
    return parseRecipe(JSON.parse(raw));
  }

  if (/\.(mjs|cjs|js)$/.test(spec)) {
    return loadHook(resolve(spec));
  }

  // 未知名称：回退默认
  return defaultRecipe();
}

/** 加载 JS 钩子文件，支持三种导出形态。 */
async function loadHook(path: string): Promise<Recipe> {
  const base = defaultRecipe();
  const url = pathToFileURL(path).href;
  const mod = (await import(url)) as Record<string, unknown>;

  const def = mod.default;

  // 形态 1：default 导出为函数 → 作为 translate 钩子
  if (typeof def === "function") {
    return { ...base, hooks: { ...base.hooks, translate: def as RecipeHooks["translate"] } };
  }

  // 形态 2：default 导出为配方对象 → 合并进默认
  if (def && typeof def === "object") {
    const asRecipe = def as Partial<Recipe>;
    if (asRecipe.style || asRecipe.detection || asRecipe.hooks) {
      return parseRecipe({ ...base, ...asRecipe });
    }
  }

  // 形态 3：具名导出 detect / translate
  const hooks: RecipeHooks = { ...base.hooks };
  if (typeof mod.detect === "function") hooks.detect = mod.detect as RecipeHooks["detect"];
  if (typeof mod.translate === "function") hooks.translate = mod.translate as RecipeHooks["translate"];
  return { ...base, hooks };
}
