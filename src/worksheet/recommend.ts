import type { ContextProfile, WorksheetSlot } from "../types.js";

/**
 * 为一个插槽计算「推荐答案」，让用户审阅草案而非面对空白。
 * 优先级：画像默认（事实已可知）→ 首选项 options[0]（启发式草案）。
 */
export function recommend(
  id: string,
  options: string[] | undefined,
  profile: ContextProfile,
): string | undefined {
  // 画像已是「事实」，直接作为推荐。
  if (id === "completeness-environment" && profile.techStack.languages.length) {
    return profile.techStack.languages.join("、");
  }
  if (id === "completeness-confidence") {
    const map: Record<ContextProfile["cognitivePreferences"]["confidenceStyle"], string> = {
      deterministic: "确定性答案",
      comparative: "多方案对比",
      probabilistic: "概率性判断 / 附权衡",
    };
    return map[profile.cognitivePreferences.confidenceStyle];
  }
  // 其余维度回退到首选项（可被用户修正的草案）。
  return options?.[0];
}

/** 为每个插槽附上推荐答案（返回新数组，不改原插槽）。 */
export function recommendAnswers(slots: WorksheetSlot[], profile: ContextProfile): WorksheetSlot[] {
  return slots.map((s) => {
    const recommended = recommend(s.id, s.options, profile);
    return recommended === undefined ? s : { ...s, recommended };
  });
}
