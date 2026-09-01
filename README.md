# prompt-cog

认知增强型 AI 指示词过滤与完善工具。在你向大模型 / Agent 下达指令**之前**，对指令做结构化判别、认知健康检查、偏向扫描与引导补充；对 AI 输出做**后处理检查**，规避训练数据或推理中可能携带的偏向。

> 认识论定位：这不是形式证明，而是一份**启发式排错清单**。它输出**分级置信度**，不做二元绝对对错判断；适合理论辨析、技术方案复盘、Prompt 打磨，不适合紧急临场决策。

## 核心理念（一句话总纲）

> 自洽不等于真实，拟合不等于机制正确；样本带有偏向，群体亦会盲从；先标定命题类型，再决定证据门槛；所有结论都受初始设定约束，并保留一个最小可存活判断。

十一条校验规则（分四层：基础 / 命题 / 证据 / 机制 / 自反）见 [`src/rules/definitions.ts`](src/rules/definitions.ts)，也可用 `prompt-cog rules` 查看。

## 安装与构建

```bash
npm install        # 安装依赖
npm run build      # 编译到 dist/
npm test           # 运行测试
```

### 启动脚本（免记命令）

项目根目录已备好两个入口脚本，首次运行会自动编译：

| 脚本 | 作用 |
| --- | --- |
| `prompt-cog.cmd` / `prompt-cog.sh` | 命令行入口（透传参数） |
| `prompt-cog-ui.cmd` / `prompt-cog-ui.sh` | 打开浏览器可视化窗口 |

`.cmd` 用于 cmd / PowerShell（可双击），`.sh` 用于 Git Bash / WSL。

```bash
./prompt-cog.sh check "写个排序算法" --depth L2   # 命令行
./prompt-cog-ui.sh "写个排序算法"                  # 可视化窗口（预填）
```

## 使用

```bash
# 快速检查（L1：仅硬性缺失 + 明显边界）
prompt-cog check "写个排序算法" --depth L1

# 标准检查（L2：完整十一条规则 + 偏向扫描，默认）
prompt-cog check "帮我写个最好的排序实现" --depth L2

# 深度思辨（L3）
prompt-cog check "设计一个分布式订单系统" --depth L3

# 交互式引导（逐条追问缺失维度，补充后翻译为精确指令）
prompt-cog wizard "实现一个队列"

# 打开浏览器可视化窗口（图形化输入/填写/编译/导出）
prompt-cog ui

# 生成补全工作表（缺失维度表格 + 追问回答区，编辑器里填写）
prompt-cog worksheet "写个排序算法"

# 编译工作表为面向 AI 的指令（默认翻译；--raw 仅合并原始条件）
prompt-cog compile prompt-cog-worksheet.txt --out 指令.txt

# 输出侧后处理过滤
echo "所有情况下都应该用单例模式" | prompt-cog filter

# 生成上下文画像模板 / 配方模板
prompt-cog init
prompt-cog recipe

# 查看十一条规则
prompt-cog rules
```

开发期无需编译即可运行：`npm run dev -- check "..."`（通过 tsx）。

## 三级介入力度

| 级别 | 名称 | 触发 | 内容 | 适用 |
| --- | --- | --- | --- | --- |
| L1 | 快速检查（Lint） | 默认后台 | 硬性缺失 + 明显边界（规则1、5） | 简单补全 / 脚本 |
| L2 | 标准引导（Wizard） | `--depth L2` | 完整十一条规则 + 编程域定制 + 偏向扫描 | 功能开发 / 重构 / 模块设计 |
| L3 | 深度思辨（Socratic） | `--depth L3` | 完整规则 + 偏向扫描 + 思辨模式 | 架构选型 / 关键算法 / 方案评审 |

## 语义分析（可选 LLM）

默认**纯离线**（确定性规则引擎，毫秒级、不联网）。加 `--llm` 启用真正的语义分析：

```bash
# 本地 Ollama
prompt-cog check "重构登录模块" --llm http://localhost:11434/v1 --model llama3.2

# 任意 OpenAI 兼容 API
prompt-cog check "重构登录模块" --llm https://api.example.com/v1 --model gpt-4o-mini --llm-key sk-xxx
```

等价环境变量：`PROMPT_COG_LLM_URL` / `PROMPT_COG_LLM_MODEL` / `PROMPT_COG_LLM_KEY`。LLM 失败时自动回退到离线报告。

## 可视化窗口（本地网页）

`prompt-cog ui` 启动一个**本地网页窗口**（Node 内置 HTTP，零新依赖、零外网、监听 `127.0.0.1`），把「输入 → 分析 → 填表 → 选配方 → 编译 → 导出」做成图形化操作：

```bash
prompt-cog ui                    # 启动并自动打开浏览器（默认 8787）
prompt-cog ui "写个排序算法"      # 预填提示词
prompt-cog ui --port 9000        # 指定端口（占用时自动回退随机）
prompt-cog ui --no-open          # 只启动服务，不自动打开浏览器
```

页面流程：粘贴指令 → 选深度/配方 → ① 分析生成工作表（缺失维度+追问逐条渲染成输入框，已预填推荐）→ 填写 → 勾选「翻译 / 仅合并」→ ② 编译 → 复制 / 下载 `.txt`。SDK 侧可编程复用：`startUi` / `dispatch`（见 [`src/ui/`](src/ui/)）。

## 补全工作流（检测 → 填写 → 翻译）

```bash
prompt-cog worksheet "写个排序算法"        # 生成 prompt-cog-worksheet.txt
# ……在编辑器里把冒号后的 ________ 替换为答案……
prompt-cog compile prompt-cog-worksheet.txt --out 指令.txt
```

借鉴 grill-me 的两处增强（均离线、确定性）：

- **推荐答案（审阅草案）**：每个插槽附一条推荐（画像默认 → 首选项）。worksheet 显示 `建议：xxx`；wizard 打印 `推荐：xxx（回车接受）`；网页窗口预填输入框——用户是「修正草案」而非「面对空白」，不改即采纳（画像里的已知事实自动回填，对应 grill-me 的「事实 vs 决策」分离）。
- **弱回答反诘 + 未决风险收口**：`compile` 末尾追加「未决风险（请复核）」段——列出仍未填写的硬性维度，并对含含糊词（差不多/大概…）或绝对断言（所有/必须…）的答案标为「弱回答 / 过强主张」。`hooks.translate` 钩子分支不注入该段，尊重彻底自由。

### 可自定义的翻译/识别方式（三层 Recipe）

```bash
# 1) 内置预设：default / concise / strict / research
prompt-cog compile prompt-cog-worksheet.txt --recipe concise

# 2) JSON 配方：声明式微调（分区开关、语气、关闭规则/维度）
prompt-cog recipe                                   # 生成 prompt-cog.recipe.json
prompt-cog compile prompt-cog-worksheet.txt --recipe prompt-cog.recipe.json

# 3) JS 钩子：彻底替换判断与翻译逻辑（无需改源码）
prompt-cog compile prompt-cog-worksheet.txt --recipe ./my-recipe.mjs
```

## SDK

```ts
import { analyze, checkPrompt, filterResponse, renderReport, compileWorksheet } from "prompt-cog";

const report = analyze("写个排序算法", { depth: "L2" });
console.log(renderReport(report, "markdown"));

const res = filterResponse("所有情况下都应该……");
```

完整导出见 [`src/index.ts`](src/index.ts)。

## 架构

```
src/
├── types.ts            公共类型契约
├── text.ts             确定性文本分析原语（零网络）
├── profile/            上下文画像（context_profile.json，Zod 校验）
├── rules/              十一条规则（四层）的数据化定义 + 编程域检测点
├── checks/             完整性 / 认知健康 / 偏向 三个检测器
├── engine/             深度分级、置信度、编排入口（checkPrompt/analyze）
├── output/             Prompt 优化、输出侧过滤、报告渲染
├── recipe/             三层配方：预设 / JSON 配方 / JS 钩子
├── worksheet/          补全工作表：生成、解析、推荐、反诘、编译翻译
├── ui/                 本地网页可视化窗口（http 服务 + 内嵌单页应用）
├── llm/                可插拔 LLM 接口（默认离线 noop）
├── cli.ts              CLI 入口
└── index.ts            SDK 入口
```

### 关键设计

- **规则数据化**：十一条规则与检测点以「数据 + 函数」形式注册，引擎只遍历规则列表。新增领域规则无需改引擎。
- **确定性优先**：L1/L2 纯离线规则引擎，毫秒级、不联网；L3 可选用 `createHttpLlm` 接入本地/云端模型增强。
- **置信度分离**：结构完整度（离线，回答「能否被检验」）与认知置信度（语义，回答「是否可信」）分开计算。
- **三层配方**：翻译/识别方式用统一 `Recipe` 接口表达，内置预设、JSON 配方（声明式）、JS 钩子（彻底自由）共用同一管线。
- **输出三件套**：每个结论都给出「置信度（结构 + 认知）+ 最小可存活版本 + 放弃的过强主张」。

## 非功能特性

- **透明性**：每条追问都标注对应的规则或维度。
- **可跳过**：所有引导步骤可跳过，用户始终可控。
- **隐私**：默认不发送任何数据到外部服务器。
- **可扩展**：规则以插件形式注册，输出侧过滤可独立调用。

## 未来扩展

- 领域定制（法律 / 医疗 / 学术）
- 团队共享配置（统一偏见检查标准）
- 与 LangChain / Dify / Coze 集成（中间件节点）
- 输出侧从「标记」升级为「自动重写」
- VS Code 插件（作为本 SDK 的薄封装）
