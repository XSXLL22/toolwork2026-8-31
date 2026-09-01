import type { Depth, FilledAnswers } from "../types.js";
import type { Recipe } from "../recipe/types.js";
import { defaultRecipe, RECIPES } from "../recipe/presets.js";
import { parseRecipe } from "../recipe/schema.js";
import { loadRecipe } from "../recipe/load.js";
import { analyze } from "../engine/run.js";
import { collectSlots } from "../worksheet/generate.js";
import { recommendAnswers } from "../worksheet/recommend.js";
import { compileWorksheet, renderRawConditions } from "../worksheet/compile.js";
import { loadProfile } from "../profile/profile.js";
import { UI_HTML } from "./html.js";

export interface UiDispatchResult {
  status: number;
  contentType: string;
  body: string;
}

function json(obj: unknown, status = 200): UiDispatchResult {
  return { status, contentType: "application/json; charset=utf-8", body: JSON.stringify(obj) };
}

/** 配方来源（由前端三种输入归一而来）。 */
interface RecipeSpec {
  kind: "preset" | "json" | "path";
  value: string;
}

/** 解析前端传来的配方规格。 */
async function resolveRecipe(spec: unknown): Promise<Recipe> {
  if (!spec) return defaultRecipe();
  const s = spec as Partial<RecipeSpec>;
  if (s.kind === "json" && s.value) {
    return parseRecipe(JSON.parse(s.value));
  }
  if (s.kind === "path" && s.value) {
    return loadRecipe(s.value);
  }
  if (s.value) {
    return loadRecipe(s.value); // 预设名
  }
  return defaultRecipe();
}

function normalizeDepth(depth: unknown): Depth {
  return depth === "L1" || depth === "L3" ? depth : "L2";
}

async function handleAnalyze(body: string): Promise<UiDispatchResult> {
  try {
    const { text, depth, recipe } = JSON.parse(body || "{}") as {
      text?: string;
      depth?: Depth;
      recipe?: RecipeSpec;
    };
    if (!text) return json({ error: "缺少 text" }, 400);
    const profile = loadProfile(undefined);
    const recipeObj = await resolveRecipe(recipe);
    const report = analyze(text, { depth: normalizeDepth(depth), profile });
    const slots = recommendAnswers(collectSlots(report, recipeObj), profile);
    return json({
      slots,
      meta: {
        propositionType: report.propositionType,
        strongClaim: report.strongClaim,
        structural: report.structural,
        minimalSurvivableVersion: report.minimalSurvivableVersion,
      },
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 400);
  }
}

async function handleCompile(body: string): Promise<UiDispatchResult> {
  try {
    const { text, depth, recipe, filled, raw } = JSON.parse(body || "{}") as {
      text?: string;
      depth?: Depth;
      recipe?: RecipeSpec;
      filled?: FilledAnswers;
      raw?: boolean;
    };
    if (!text) return json({ error: "缺少 text" }, 400);
    const profile = loadProfile(undefined);
    const recipeObj = await resolveRecipe(recipe);
    const report = analyze(text, { depth: normalizeDepth(depth), profile });
    const result = raw
      ? renderRawConditions(filled ?? {}, report)
      : compileWorksheet(text, filled ?? {}, report, recipeObj, profile);
    return json({ result });
  } catch (err) {
    return json({ error: (err as Error).message }, 400);
  }
}

/**
 * 路由分发（纯函数，便于单测）：不持有 http 连接，直接返回响应。
 */
export async function dispatch(method: string, pathname: string, body: string): Promise<UiDispatchResult> {
  if (method === "GET" && (pathname === "/" || pathname === "/index.html")) {
    return { status: 200, contentType: "text/html; charset=utf-8", body: UI_HTML };
  }
  if (method === "GET" && pathname === "/api/recipes") {
    return json(Object.keys(RECIPES));
  }
  if (method === "POST" && pathname === "/api/analyze") {
    return handleAnalyze(body);
  }
  if (method === "POST" && pathname === "/api/compile") {
    return handleCompile(body);
  }
  return json({ error: "not found" }, 404);
}
