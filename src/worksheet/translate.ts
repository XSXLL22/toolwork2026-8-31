import type { ContextProfile, FilledAnswers, Report } from "../types.js";
import type { Recipe, SectionKey } from "../recipe/types.js";

const HEADERS: Record<SectionKey, string> = {
  task: "任务描述",
  boundary: "边界条件（生效前提）",
  evidence: "证据基础",
  constraints: "认知约束",
  output: "输出要求",
  bias: "偏向声明",
  minimalVersion: "最小可存活版本",
  droppedOverclaims: "放弃的过强主张",
};

function filledOf(filled: FilledAnswers, ...ids: string[]): string | undefined {
  for (const id of ids) if (filled[id]) return filled[id];
  return undefined;
}

function nonEmpty(items: Array<string | undefined>): string[] {
  return items.filter((s): s is string => !!s && s.trim().length > 0);
}

/** 把 id → 问题原文，供认知约束分区引用。 */
function questionTextMap(report: Report): Map<string, string> {
  const m = new Map<string, string>();
  for (const q of report.questions) m.set(q.id, q.text);
  return m;
}

/**
 * 默认翻译：把 filled 答案归位到结构化分区，生成面向 AI 的精确指令。
 * 回填优先级：用户答案 > 画像默认；尊重 recipe.style 的分区顺序与开关。
 */
export function translateDefault(
  original: string,
  filled: FilledAnswers,
  report: Report,
  recipe: Recipe,
  profile: ContextProfile,
): string {
  const qText = questionTextMap(report);
  const style = recipe.style;

  const taskType = filledOf(filled, "completeness-taskType");
  const environment = filledOf(filled, "completeness-environment");
  const boundary = filledOf(filled, "completeness-boundary");
  const evidence = filledOf(filled, "completeness-evidence");
  const inputOutput = filledOf(filled, "completeness-inputOutput");
  const performance = filledOf(filled, "completeness-performance");
  const outputFormat = filledOf(filled, "completeness-outputFormat");
  const confidence = filledOf(filled, "completeness-confidence");

  // 认知约束：来自规则追问的答案（规则类 id，如 r1-env）；完整性维度已单独归位。
  const ruleQuestionIds = new Set(report.questions.filter((q) => q.ruleId).map((q) => q.id));
  const constraints: string[] = [];
  for (const [id, answer] of Object.entries(filled)) {
    if (!ruleQuestionIds.has(id) || !answer) continue;
    const text = qText.get(id);
    if (text) constraints.push(`${text}：${answer}`);
  }

  const techStack = [
    profile.techStack.languages.length ? `语言/框架：${profile.techStack.languages.join("、")}` : undefined,
    profile.techStack.frameworks.length ? `框架：${profile.techStack.frameworks.join("、")}` : undefined,
    profile.techStack.databases.length ? `数据库：${profile.techStack.databases.join("、")}` : undefined,
    profile.techStack.deployment.length ? `部署：${profile.techStack.deployment.join("、")}` : undefined,
  ];

  const outputPrefs = [
    profile.outputPreferences.docFormat && profile.outputPreferences.docFormat !== "markdown"
      ? `输出格式偏好：${profile.outputPreferences.docFormat}`
      : undefined,
    profile.outputPreferences.commentLanguage ? `注释语言：${profile.outputPreferences.commentLanguage}` : undefined,
  ];

  const sectionLines: Record<SectionKey, string[]> = {
    task: nonEmpty([original, taskType ? `任务类型：${taskType}` : undefined]),
    boundary: nonEmpty([
      environment,
      boundary,
      profile.boundaries.performance,
      profile.boundaries.security,
      profile.boundaries.compatibility,
    ]),
    evidence: nonEmpty([evidence, ...techStack]),
    constraints,
    output: nonEmpty([inputOutput, performance, outputFormat, confidence, ...outputPrefs]),
    bias: report.bias.map((b) => `${b.title}：${b.detail}`),
    minimalVersion: nonEmpty([report.minimalSurvivableVersion]),
    droppedOverclaims: report.droppedOverclaims,
  };

  const includeFlags: Record<SectionKey, boolean> = {
    task: true,
    boundary: true,
    evidence: style.includeEvidence,
    constraints: true,
    output: true,
    bias: style.includeBias,
    minimalVersion: style.includeMinimalVersion,
    droppedOverclaims: style.includeDroppedOverclaims,
  };

  const md = recipe.translation.headerFormat === "markdown";
  const L: string[] = [];
  L.push(md ? "# 优化后的指令（已回填）" : "优化后的指令（已回填）");

  for (const key of style.sectionOrder) {
    const lines = sectionLines[key];
    if (!lines || lines.length === 0) continue;
    if (!includeFlags[key]) continue;

    if (key === "task") {
      L.push("");
      L.push(md ? `## ${recipe.translation.taskTitle}` : `【${recipe.translation.taskTitle}】`);
      for (const line of lines) L.push(line);
      continue;
    }

    L.push("");
    L.push(md ? `## ${HEADERS[key]}` : `【${HEADERS[key]}】`);
    for (const line of lines) L.push(`- ${line}`);
  }

  if (style.tone === "strict") {
    L.push("");
    L.push(md ? "> 请逐条自检：以上约束是否仍含过强主张或未操作化承诺。" : "（请逐条自检：以上约束是否仍含过强主张或未操作化承诺。）");
  }

  return L.join("\n");
}
