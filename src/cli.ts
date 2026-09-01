#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readFileSync, writeFileSync } from "node:fs";
import {
  analyze,
  analyzeWithLlm,
  buildWorksheet,
  compileWorksheet,
  createHttpLlm,
  extractOriginal,
  filterResponse,
  loadProfile,
  loadRecipe,
  parseWorksheet,
  profileTemplate,
  recipeTemplate,
  recommend,
  renderRawConditions,
  renderReport,
  RULES,
  startUi,
  type Depth,
  type FilledAnswers,
} from "./index.js";
import type { LlmClient, RenderFormat } from "./index.js";

const VERSION = "0.3.0";

const HELP = `prompt-cog —— 认知增强型 AI 指示词过滤与完善工具

💡 想要图形化操作？运行：prompt-cog ui

用法：prompt-cog <命令> [参数] [选项]

命令：
  check <提示词>     对指令做完整性/认知健康/偏向检查，输出分级报告
  wizard [提示词]    交互式引导：逐条追问缺失维度，补充后翻译为精确指令
  worksheet [提示词] 生成可填写的补全工作表 txt（缺失维度表格 + 追问回答区）
  compile <工作表>   读取填写后的工作表，翻译为面向 AI 的指令
  filter <文本>      对 AI 响应做后处理检查（全称断言、无来源研究等）
  init              生成 context_profile.json 模板
  recipe            生成 prompt-cog.recipe.json 配方模板
  rules             打印十一条核心校验规则
  ui [提示词]       打开本地浏览器可视化窗口（别名 gui）

选项：
  --depth L1|L2|L3   介入深度（默认 L2）
  --profile <path>   上下文画像路径（默认 context_profile.json）
  --format md|text|json   输出格式（默认 md）
  --recipe <名称|路径>  翻译配方：内置预设名 / *.json 配方 / *.mjs JS 钩子
  --out <path>       将结果写入文件（默认打印到终端）
  --raw              编译时仅合并原始条件，不翻译为 AI 指令
  --port <n>         ui 命令的服务端口（默认 8787，占用自动回退随机）
  --no-open          ui 命令启动后不自动打开浏览器
  --llm <baseUrl>    启用 LLM 语义分析（OpenAI 兼容端点，默认离线不启用）
  --model <name>     模型名（配合 --llm 使用）
  --llm-key <key>    API Key（可选，本地模型可省略）
  -v, --version      打印版本
  -h, --help         打印帮助

示例：
  prompt-cog check "写个排序算法" --depth L2
  prompt-cog ui "写个排序算法"          # 打开浏览器窗口并预填提示词
  prompt-cog ui --no-open              # 启动服务但不自动打开浏览器
  prompt-cog worksheet "写个排序算法"
  prompt-cog compile prompt-cog-worksheet.txt --out 指令.txt
  prompt-cog compile prompt-cog-worksheet.txt --recipe concise
  prompt-cog wizard "帮我实现一个队列"
  echo "所有情况下都应该用单例" | prompt-cog filter

环境变量（等价于对应标志）：PROMPT_COG_LLM_URL / PROMPT_COG_LLM_MODEL / PROMPT_COG_LLM_KEY
`;

interface CliFlags {
  depth: Depth;
  profile?: string;
  format: RenderFormat;
  llm?: string;
  model?: string;
  llmKey?: string;
  recipe?: string;
  out?: string;
  raw?: boolean;
  port?: number;
  noOpen?: boolean;
}

function parseFlags(args: string[]): { flags: CliFlags; positionals: string[] } {
  const flags: CliFlags = { depth: "L2", format: "markdown" };
  const positionals: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--depth") {
      const v = args[++i];
      if (v === "L1" || v === "L2" || v === "L3") flags.depth = v;
    } else if (a === "--profile") {
      const v = args[++i];
      if (v) flags.profile = v;
    } else if (a === "--format") {
      const v = args[++i];
      if (v === "md" || v === "markdown") flags.format = "markdown";
      else if (v === "text") flags.format = "text";
      else if (v === "json") flags.format = "json";
    } else if (a === "--recipe") {
      const v = args[++i];
      if (v) flags.recipe = v;
    } else if (a === "--out") {
      const v = args[++i];
      if (v) flags.out = v;
    } else if (a === "--raw") {
      flags.raw = true;
    } else if (a === "--port") {
      const v = args[++i];
      if (v) flags.port = Number(v);
    } else if (a === "--no-open") {
      flags.noOpen = true;
    } else if (a === "--llm") {
      const v = args[++i];
      if (v) flags.llm = v;
    } else if (a === "--model") {
      const v = args[++i];
      if (v) flags.model = v;
    } else if (a === "--llm-key") {
      const v = args[++i];
      if (v) flags.llmKey = v;
    } else if (!a.startsWith("-")) {
      positionals.push(a);
    }
  }
  return { flags, positionals };
}

/** 由标志 + 环境变量构建 LLM 客户端；未配置则返回 undefined（默认离线）。 */
function llmFromFlags(flags: CliFlags): LlmClient | undefined {
  const baseUrl = flags.llm ?? process.env.PROMPT_COG_LLM_URL;
  if (!baseUrl) return undefined;
  const model = flags.model ?? process.env.PROMPT_COG_LLM_MODEL;
  if (!model) {
    console.error("使用 --llm 时需同时提供 --model <模型名>（或环境变量 PROMPT_COG_LLM_MODEL）");
    process.exit(1);
  }
  const apiKey = flags.llmKey ?? process.env.PROMPT_COG_LLM_KEY;
  return createHttpLlm({ baseUrl, model, apiKey });
}

/** 分层分析：配置了 LLM 则叠加语义分析，失败自动回退离线报告。 */
async function runAnalysis(text: string, flags: CliFlags) {
  const profile = loadProfile(flags.profile);
  const base = { depth: flags.depth, profile, profilePath: flags.profile };
  const llm = llmFromFlags(flags);
  if (!llm) return analyze(text, base);
  try {
    return await analyzeWithLlm(text, { ...base, llm });
  } catch (err) {
    console.error(`⚠️ LLM 语义分析失败，回退到离线报告：${(err as Error).message}`);
    return analyze(text, base);
  }
}

async function readStdin(): Promise<string> {
  let buf = "";
  for await (const chunk of input) buf += chunk;
  return buf.trim();
}

function getPrompt(positionals: string[]): string {
  return positionals.join(" ").trim();
}

async function cmdCheck(positionals: string[], flags: CliFlags): Promise<void> {
  const text = getPrompt(positionals) || (await readStdin());
  if (!text) {
    console.error("错误：未提供提示词。用法：prompt-cog check \"<提示词>\"");
    process.exit(1);
  }
  const report = await runAnalysis(text, flags);
  console.log(renderReport(report, flags.format));
}

async function cmdFilter(positionals: string[], flags: CliFlags): Promise<void> {
  const text = getPrompt(positionals) || (await readStdin());
  if (!text) {
    console.error("错误：未提供待检查文本。用法：prompt-cog filter \"<文本>\"");
    process.exit(1);
  }
  const res = filterResponse(text);
  if (res.passed) {
    console.log("✅ 未发现明显偏向或认知问题。");
    return;
  }
  console.log(`发现 ${res.issues.length} 处问题：\n`);
  for (const it of res.issues) {
    console.log(`- [${it.severity}] ${it.title}`);
    console.log(`  ${it.detail}`);
  }
}

async function cmdWizard(positionals: string[], flags: CliFlags): Promise<void> {
  let text = getPrompt(positionals);
  if (!text) {
    if (!input.isTTY) {
      text = await readStdin();
    } else {
      console.log("请粘贴你的原始指令（粘贴完成后回车，输入空行结束）：");
      const rl = createInterface({ input, output });
      const lines: string[] = [];
      for (;;) {
        const line = await rl.question("> ");
        if (line.trim() === "") break;
        lines.push(line);
      }
      rl.close();
      text = lines.join("\n").trim();
    }
  }
  if (!text) {
    console.error("错误：未提供指令内容。");
    process.exit(1);
  }

  const report = await runAnalysis(text, flags);

  console.log(renderReport(report, flags.format));
  console.log("\n======================== 引导补充 ========================");

  const profile = loadProfile(flags.profile);
  const rl = createInterface({ input, output });
  const answers: Array<{ id: string; text: string; answer: string }> = [];
  const questions = report.questions;
  for (const q of questions) {
    console.log(`\n【${q.ruleId ?? "完整性"}】${q.text}`);
    if (q.options?.length) {
      q.options.forEach((o, i) => console.log(`  ${i + 1}. ${o}`));
      const rec = recommend(q.id, q.options, profile);
      console.log(`  推荐：${rec ?? "（无）"}（回车直接接受推荐，或输入修改）`);
    } else {
      console.log("  (直接输入答案，回车跳过)");
    }
    const ans = (await rl.question("> ")).trim();
    if (ans === "") {
      const rec = recommend(q.id, q.options, profile);
      if (rec) answers.push({ id: q.id, text: q.text, answer: rec });
      continue;
    }
    let finalAns = ans;
    if (q.options?.length && /^\d+$/.test(ans)) {
      const idx = Number(ans) - 1;
      const opt = q.options[idx];
      if (opt) finalAns = opt;
    }
    answers.push({ id: q.id, text: q.text, answer: finalAns });
  }
  rl.close();

  if (!answers.length) {
    console.log("\n未补充任何条件。");
    return;
  }

  const filled: FilledAnswers = {};
  for (const a of answers) filled[a.id] = a.answer;

  const recipe = await loadRecipe(flags.recipe);

  let doTranslate = !flags.raw;
  if (!flags.raw && input.isTTY) {
    const rl2 = createInterface({ input, output });
    const ans = (await rl2.question("\n是否翻译为面向 AI 的指令？(y/n，默认 y) ")).trim().toLowerCase();
    rl2.close();
    if (ans === "n" || ans === "no") doTranslate = false;
  }

  const result = doTranslate
    ? compileWorksheet(text, filled, report, recipe, profile)
    : renderRawConditions(filled, report);

  emit(result, flags);
}

function cmdInit(): void {
  const path = "context_profile.json";
  writeFileSync(path, profileTemplate(), "utf-8");
  console.log(`已生成 ${path}，请按需填写后使用 --profile ${path} 引用。`);
}

function cmdRules(): void {
  console.log("十一条核心校验规则：\n");
  for (const r of RULES) {
    console.log(`${r.index}. ${r.name}`);
    console.log(`   ${r.principle}`);
    console.log("");
  }
}

function cmdRecipe(): void {
  const path = "prompt-cog.recipe.json";
  writeFileSync(path, recipeTemplate(), "utf-8");
  console.log(`已生成 ${path}，填写后使用 --recipe ${path} 引用。`);
}

/** 将结果写入 --out 文件，否则打印到终端。 */
function emit(text: string, flags: CliFlags): void {
  if (flags.out) {
    writeFileSync(flags.out, text + "\n", "utf-8");
    console.log(`已写入 ${flags.out}`);
  } else {
    console.log(text);
  }
}

async function cmdWorksheet(positionals: string[], flags: CliFlags): Promise<void> {
  const text = getPrompt(positionals) || (await readStdin());
  if (!text) {
    console.error('错误：未提供提示词。用法：prompt-cog worksheet "<提示词>"');
    process.exit(1);
  }
  const report = await runAnalysis(text, flags);
  const recipe = await loadRecipe(flags.recipe);
  const sheet = buildWorksheet(report, recipe);
  const out = flags.out ?? "prompt-cog-worksheet.txt";
  writeFileSync(out, sheet + "\n", "utf-8");
  console.log(`已生成 ${out}。填写后运行：prompt-cog compile ${out} --out 指令.txt`);
}

async function cmdCompile(positionals: string[], flags: CliFlags): Promise<void> {
  const path = getPrompt(positionals);
  if (!path) {
    console.error("错误：未提供工作表路径。用法：prompt-cog compile <worksheet.txt> [--out 指令.txt]");
    process.exit(1);
  }
  const raw = readFileSync(path, "utf-8");
  const original = extractOriginal(raw);
  if (!original) {
    console.error("错误：工作表缺少 <!-- ORIGINAL --> 段，无法重建分析。");
    process.exit(1);
  }
  const filled: FilledAnswers = parseWorksheet(raw);
  const report = await runAnalysis(original, flags);
  const profile = loadProfile(flags.profile);
  const recipe = await loadRecipe(flags.recipe);
  const result = flags.raw
    ? renderRawConditions(filled, report)
    : compileWorksheet(original, filled, report, recipe, profile);
  emit(result, flags);
}

async function cmdUi(positionals: string[], flags: CliFlags): Promise<void> {
  const prompt = getPrompt(positionals);
  const handle = await startUi({
    port: flags.port ?? 8787,
    open: !flags.noOpen,
    prompt: prompt || undefined,
  });
  console.log(`prompt-cog 可视化窗口已启动：${handle.url}`);
  console.log("按 Ctrl+C 退出服务。");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
    console.log(HELP);
    return;
  }
  if (argv[0] === "-v" || argv[0] === "--version") {
    console.log(VERSION);
    return;
  }

  const cmd = argv[0]!;
  const { flags, positionals } = parseFlags(argv.slice(1));

  switch (cmd) {
    case "check":
      return cmdCheck(positionals, flags);
    case "wizard":
      return cmdWizard(positionals, flags);
    case "worksheet":
      return cmdWorksheet(positionals, flags);
    case "compile":
      return cmdCompile(positionals, flags);
    case "filter":
      return cmdFilter(positionals, flags);
    case "init":
      return cmdInit();
    case "recipe":
      return cmdRecipe();
    case "rules":
      return cmdRules();
    case "ui":
    case "gui":
      return cmdUi(positionals, flags);
    default:
      console.error(`未知命令：${cmd}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("运行出错：", err);
  process.exit(1);
});
