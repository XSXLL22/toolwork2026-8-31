import type { ContextProfile, Depth, Question, Severity } from "../types.js";
import {
  ABSOLUTE_CERTAINTY_WORDS,
  ADVERSARIAL_WORDS,
  ALTERNATIVE_WORDS,
  CAUSAL_METHOD_WORDS,
  CAUSAL_WORDS,
  countCodeFences,
  detectLanguages,
  FORCED_CHOICE_WORDS,
  hasAny,
  INDEPENDENCE_WORDS,
  NORMATIVE_WORDS,
  OPERATIONAL_WORDS,
  ROOT_CAUSE_WORDS,
  SURFACE_FIX_WORDS,
} from "../text.js";

/**
 * 十一级核心校验规则的数据化定义（四层）。
 *
 * 层：基础 / 命题 / 证据 / 机制 / 自反
 * 设计要点：规则以「数据 + 检测点函数」形式注册，引擎只遍历列表。
 * 新增领域规则（法律/医疗/…）只需向列表追加，无需改引擎。
 */

/** 规则所属层。 */
export type RuleLayer = "基础" | "命题" | "证据" | "机制" | "自反";

export interface DetectionContext {
  text: string;
  profile: ContextProfile;
  depth: Depth;
}

export interface Detection {
  dimension: string;
  severity: Severity;
  title: string;
  detail: string;
  evidence: string[];
  question?: Question;
}

export interface DetectionPoint {
  id: string;
  label: string;
  triggerExample: string;
  detect: (ctx: DetectionContext) => Detection | null;
}

export interface RuleDefinition {
  id: string;
  index: number;
  name: string;
  principle: string;
  statement: string;
  layer: RuleLayer;
  points: DetectionPoint[];
}

/** 追问构造辅助。 */
function q(ruleId: string, id: string, text: string, reason: string, options?: string[]): Question {
  return { id, ruleId, text, reason, options, allowSkip: true };
}

/** 实现类任务信号词。 */
const IMPLEMENT_WORDS = ["实现", "写个", "写一个", "开发", "新建", "搭建", "创建一个", "implement", "build"];
const BOUNDARY_WORDS = [
  "异常", "边界", "空值", "null", "并发", "线程", "容量", "错误处理",
  "兜底", "edge case", "边界值", "超时", "重试",
];
const FACTUAL_WORDS = ["实现", "修复", "运行", "能跑", "输出", "结果", "不报错", "通过", "实现功能"];
const REFERENCE_WORDS = ["照这个", "照着", "参考这个", "仿照", "参考下面", "这个例子", "按这个", "如下"];
const MULTI_EVIDENCE_WORDS = ["多个", "许多", "大量", "各家", "100家", "10篇", "若干", "很多", "众多"];

export const RULES: RuleDefinition[] = [
  {
    id: "rule-1",
    index: 1,
    name: "自洽—真实性分离",
    principle: "逻辑一致 ≠ 现实正确。",
    statement: "逻辑通顺、叙事合理，只代表可以想象成立，不等于符合客观现实。不可把“道理说得通”直接当作事实。",
    layer: "基础",
    points: [
      {
        id: "r1-env",
        label: "未指定运行环境",
        triggerExample: "“写个排序算法”未说明语言和版本",
        detect: (ctx) => {
          if (detectLanguages(ctx.text).length > 0) return null;
          return {
            dimension: "environment",
            severity: "warn",
            title: "未指定运行时环境",
            detail: "未声明语言/版本/平台。逻辑通顺的伪代码可能被误当作可运行代码，脱离具体运行时无法判定「现实适配」。",
            evidence: [],
            question: q("rule-1", "r1-env", "请指定目标运行时环境", "规则1：逻辑自洽不等于可在现实中运行", ["Python 3.10+", "Node.js 18+", "浏览器（前端）", "不适用（仅需伪代码/思路）"]),
          };
        },
      },
      {
        id: "r1-pseudo",
        label: "伪代码信号未被显式声明",
        triggerExample: "“给个大致逻辑”但期望可运行代码",
        detect: (ctx) => {
          const isPseudo = /伪代码|伪码|pseudocode|大致逻辑|思路示意/.test(ctx.text);
          const declaresPseudo = /真实代码|可运行|runnable|直接运行/.test(ctx.text);
          if (!isPseudo || declaresPseudo) return null;
          return {
            dimension: "environment",
            severity: "info",
            title: "存在伪代码信号但未声明交付形态",
            detail: "文本含「伪代码/大致逻辑」信号，但未说明期望交付是思路还是可运行代码，存在形式与现实的错位风险。",
            evidence: [],
            question: q("rule-1", "r1-pseudo", "期望交付是可运行代码还是思路/伪代码？", "规则1：先厘清「能想象成立」与「能实际运行」的区别", ["可运行代码", "伪代码/思路即可", "两者都要"]),
          };
        },
      },
    ],
  },
  {
    id: "rule-5",
    index: 5,
    name: "边界与操作化原则",
    principle: "没有无条件的全称结论；不可操作化则不可检验。",
    statement: "结论必须标注生效前提；实然命题必须能指明：什么观察算支持、什么观察算反对（对象、变量、范围、方向）。",
    layer: "命题",
    points: [
      {
        id: "r5-boundary",
        label: "实现类任务未定义边界",
        triggerExample: "“实现一个队列”未说明容量/并发",
        detect: (ctx) => {
          const isImplement = hasAny(ctx.text, IMPLEMENT_WORDS);
          const hasBoundary = hasAny(ctx.text, BOUNDARY_WORDS);
          if (!isImplement || hasBoundary) return null;
          return {
            dimension: "boundary",
            severity: "warn",
            title: "未定义边界条件",
            detail: "实现类任务未声明异常处理、空值、边界值或并发约束。缺失边界预设会使「实现」退化为仅在理想输入下成立的伪全称结论。",
            evidence: [],
            question: q("rule-5", "r5-boundary", "需要覆盖哪些边界与异常场景？", "规则5：结论必须标注生效前提", ["空值/null 处理", "异常与错误处理", "并发/线程安全", "容量/规模上限", "暂不关心边界"]),
          };
        },
      },
      {
        id: "r5-operational",
        label: "命题未操作化",
        triggerExample: "“社交媒体伤害年轻人”未拆清变量/范围/方向",
        detect: (ctx) => {
          const hasOperational = hasAny(ctx.text, OPERATIONAL_WORDS);
          const isNormative = hasAny(ctx.text, NORMATIVE_WORDS);
          // 实然/实现类指令若无任何操作化信号，视为不可检验。
          if (hasOperational || isNormative) return null;
          return {
            dimension: "operationalization",
            severity: "warn",
            title: "命题未操作化",
            detail: "未明确观察对象、变量、范围、阈值或方向——无法界定「什么观察算支持、什么算反对」。不可操作化的命题不应获得高置信度。",
            evidence: [],
            question: q("rule-5", "r5-operational", "什么可观察结果会支持/反对该命题（阈值、指标、范围、方向）？", "规则5：不可操作化的命题不可检验", ["给出指标/阈值", "给出范围/人群", "给出方向（增/减/无关）", "不适用"]),
          };
        },
      },
    ],
  },
  {
    id: "rule-2",
    index: 2,
    name: "有限样本原则",
    principle: "有限观察不能自动推出普遍规律。",
    statement: "单一来源证据不足以确立因果；尽量寻找不同维度、互不依赖的样本交叉核验。",
    layer: "证据",
    points: [
      {
        id: "r2-single-sample",
        label: "仅提供单一参考实现",
        triggerExample: "“照着这个写”但只有一个示例",
        detect: (ctx) => {
          const fences = countCodeFences(ctx.text);
          const singleRef = hasAny(ctx.text, REFERENCE_WORDS) && fences <= 1;
          if (!singleRef && fences !== 1) return null;
          return {
            dimension: "single-sample",
            severity: "warn",
            title: "仅存在单一参考样本",
            detail: "检测到只有一份参考实现/示例。有限样本无法区分「正确做法」与「恰好能跑的个例」，易过拟合到该样本的偶然特征。",
            evidence: [],
            question: q("rule-2", "r2-single-sample", "能否提供第二份独立参考（文档/官方示例/另一实现）？", "规则2：有限样本不能推出普遍规律", ["可以提供另一份参考", "只有这一份，请保守实现", "不需要参考"]),
          };
        },
      },
    ],
  },
  {
    id: "rule-3",
    index: 3,
    name: "样本生成机制原则",
    principle: "样本不是裸数据，必须查选择、测量、记录与遗漏机制。",
    statement: "观测、记录、回忆、留存都会带来筛选偏差；要审视样本如何获取、被怎样加工。",
    layer: "证据",
    points: [
      {
        id: "r3-subjective",
        label: "参考样本含主观断言",
        triggerExample: "用户提供带“最佳实践”注释的示例库",
        detect: (ctx) => {
          const subjective = hasAny(ctx.text, ["最佳实践", "best practice", "业界标准", "推荐写法", "权威做法"]);
          if (!subjective) return null;
          return {
            dimension: "sample-bias",
            severity: "warn",
            title: "样本含未隔离的主观断言",
            detail: "参考文本中出现「最佳实践 / 业界标准」等主观注释。这类标注本身就是一种筛选与价值判断，不应被当作中立事实直接采纳。",
            evidence: [],
            question: q("rule-3", "r3-subjective", "该「最佳实践」是否有官方文档或可验证来源支撑？", "规则3：样本自带偏向，主观注释需隔离核验", ["有官方来源", "仅个人经验", "不确定"]),
          };
        },
      },
    ],
  },
  {
    id: "rule-4",
    index: 4,
    name: "证据独立性原则",
    principle: "多个证据只有在误差来源相对独立时，才构成真正的交叉验证。",
    statement: "证据不仅要多，还必须检查其共同来源、生成机制与误差相关性；同源证据折算为单个有效证据。",
    layer: "证据",
    points: [
      {
        id: "r4-common-source",
        label: "证据数量未折算为有效独立证据",
        triggerExample: "“100家媒体都报道”但同源",
        detect: (ctx) => {
          const many = hasAny(ctx.text, MULTI_EVIDENCE_WORDS);
          const independent = hasAny(ctx.text, INDEPENDENCE_WORDS);
          if (!many || independent) return null;
          return {
            dimension: "evidence-independence",
            severity: "warn",
            title: "证据数量未折算为有效独立证据量",
            detail: "文本提及「多个/大量/各家」证据，但未检查其共同来源与误差相关性。100 份同源报道 ≠ 100 个独立证据，可能只是 1 个错误样本被复制 100 次。",
            evidence: [],
            question: q("rule-4", "r4-common-source", "这些证据是否共享同一来源/生成机制？有效独立证据量是多少？", "规则4：证据独立性——同源证据折算为单个", ["来源互相独立", "部分同源（需折算）", "全部同源", "不确定"]),
          };
        },
      },
    ],
  },
  {
    id: "rule-8",
    index: 8,
    name: "替代模型原则",
    principle: "不能只问“我的模型能否解释”，必须问“还有别的模型也能解释吗”。",
    statement: "一组现象可被多种互斥模型解释；只有排除替代解释，才构成对该模型的真正支持。",
    layer: "证据",
    points: [
      {
        id: "r8-alternative",
        label: "未要求替代方案",
        triggerExample: "只求单一技术方案，未要求对比",
        detect: (ctx) => {
          const isDesign = hasAny(ctx.text, ["设计", "架构", "选型", "方案", "实现", "重构", "优化", "推荐"]);
          const hasAlt = hasAny(ctx.text, ALTERNATIVE_WORDS);
          if (!isDesign || hasAlt) return null;
          return {
            dimension: "alternative-model",
            severity: "info",
            title: "未要求替代方案",
            detail: "设计/选型/方案类指令只求单一方案，未要求对比替代模型。单一模型能解释现象，不代表没有更好的替代解释。",
            evidence: [],
            question: q("rule-8", "r8-alternative", "是否需要给出 2~3 个替代方案并比较取舍？", "规则8：需排除替代解释才构成真正支持", ["需要多方案对比", "只要一个方案即可", "给出推荐 + 备选"]),
          };
        },
      },
    ],
  },
  {
    id: "rule-9",
    index: 9,
    name: "对抗性证据原则",
    principle: "主动寻找最强反例和最不利证据。",
    statement: "真正好的认识论应问：什么证据最可能杀死我的模型？而不是只寻找支持性证据。",
    layer: "证据",
    points: [
      {
        id: "r9-adversarial",
        label: "只寻支持、未寻反例",
        triggerExample: "要求“证明/论证”某观点，未要求找反例",
        detect: (ctx) => {
          const isValidation = hasAny(ctx.text, ["证明", "论证", "验证", "推荐", "说明为什么", "论证一下", "证明一下"]);
          const hasAdversarial = hasAny(ctx.text, ADVERSARIAL_WORDS);
          if (!isValidation || hasAdversarial) return null;
          return {
            dimension: "adversarial-evidence",
            severity: "warn",
            title: "只寻支持、未寻反例",
            detail: "指令要求证明/论证/推荐，但未要求主动寻找反例、失败场景或不利证据，存在确认偏误风险。",
            evidence: [],
            question: q("rule-9", "r9-adversarial", "什么证据最可能推翻这个结论？是否需要主动列出反例与失败场景？", "规则9：对抗性证据——主动寻找最不利证据", ["需要列出反例/失败场景", "不需要", "给出风险与边界即可"]),
          };
        },
      },
    ],
  },
  {
    id: "rule-6",
    index: 6,
    name: "机制—拟合分离",
    principle: "解释过去 ≠ 找到机制。",
    statement: "模型能够解释已发生现象，不代表抓住真实因果；优先看重对尚未观测的新现象的可证伪预言。",
    layer: "机制",
    points: [
      {
        id: "r6-surface",
        label: "只修复表象，未要求根因",
        triggerExample: "“让这段代码不报错”",
        detect: (ctx) => {
          const surface = hasAny(ctx.text, SURFACE_FIX_WORDS);
          const rootCause = hasAny(ctx.text, ROOT_CAUSE_WORDS);
          if (!surface || rootCause) return null;
          return {
            dimension: "mechanism",
            severity: "warn",
            title: "仅要求表象修复，未要求根因分析",
            detail: "指令聚焦「让它不报错/绕过」，但未要求定位根因。表面拟合可能掩盖真实缺陷，导致问题在新输入下复发。",
            evidence: [],
            question: q("rule-6", "r6-surface", "是否需要同时定位并说明根因，而非仅压制表象？", "规则6：拟合正确不等于机制正确", ["需要根因分析", "仅需快速止血", "都要"]),
          };
        },
      },
    ],
  },
  {
    id: "rule-7",
    index: 7,
    name: "因果识别原则",
    principle: "相关 ≠ 因果；需区分反向因果、共同原因与干预效应。",
    statement: "因果命题必须尽可能区分相关、反向因果、共同原因与真正的干预效应（时序 + 干预）。",
    layer: "机制",
    points: [
      {
        id: "r7-causal",
        label: "因果主张未说明时序与干预",
        triggerExample: "“A 导致 B”未说明是否相关/反向因果/共同原因",
        detect: (ctx) => {
          const causal = hasAny(ctx.text, CAUSAL_WORDS);
          const hasMethod = hasAny(ctx.text, CAUSAL_METHOD_WORDS);
          if (!causal || hasMethod) return null;
          return {
            dimension: "causality",
            severity: "warn",
            title: "因果主张未区分相关、反向因果与共同原因",
            detail: "文本使用「导致/影响/提高」等因果措辞，但未说明时序与干预依据，无法区分 A→B、B→A 或共同原因 C→A、C→B。",
            evidence: [],
            question: q("rule-7", "r7-causal", "这是相关还是因果？有何时序/干预/对照依据？", "规则7：因果识别——区分相关与干预效应", ["有干预/对照依据", "仅观察相关，请谨慎措辞", "不适用"]),
          };
        },
      },
    ],
  },
  {
    id: "rule-10",
    index: 10,
    name: "范式自反原则",
    principle: "群体共识 ≠ 真理。",
    statement: "个人和共同体都会共享先验预设，共识不是证明；强制选型需说明其作为约束的正当性。",
    layer: "自反",
    points: [
      {
        id: "r10-forced",
        label: "强制技术选型未说明依据",
        triggerExample: "“必须用 Redux”",
        detect: (ctx) => {
          const forced = hasAny(ctx.text, FORCED_CHOICE_WORDS) || /必须(用|使用|采用|基于)/.test(ctx.text);
          if (!forced) return null;
          return {
            dimension: "paradigm",
            severity: "warn",
            title: "强制技术选型未说明是项目约束",
            detail: "检测到「必须用 X」类强制限定，但未说明是硬性项目约束还是个人偏好。未经说明的强制选型可能是范式锁死信号。",
            evidence: [],
            question: q("rule-10", "r10-forced", "该技术选型是硬性项目约束，还是可协商的偏好？", "规则10：群体共识不等于真理", ["硬性项目约束", "可协商，欢迎替代方案", "偏好但可接受异议"]),
          };
        },
      },
    ],
  },
  {
    id: "rule-11",
    index: 11,
    name: "自我适用原则",
    principle: "上述规则本身也必须接受同样的检验。",
    statement: "任何判断体系（含本工具）都可能是新的范式；结论绝对化时，须提醒自检。",
    layer: "自反",
    points: [
      {
        id: "r11-self",
        label: "结论被绝对化",
        triggerExample: "“这是唯一正确的做法/公认真理”",
        detect: (ctx) => {
          const absolute = hasAny(ctx.text, ABSOLUTE_CERTAINTY_WORDS);
          if (!absolute) return null;
          return {
            dimension: "self-application",
            severity: "info",
            title: "结论被绝对化，缺少自我适用自检",
            detail: "文本使用「绝对真理/唯一正确/公认」等绝对化措辞。任何判断体系（包括产生该结论的框架本身）都需接受同样的可证伪检验。",
            evidence: [],
            question: q("rule-11", "r11-self", "该结论的框架/预设本身是否也可能被推翻？", "规则11：自我适用——规则自身也要被检验", ["会自检预设", "这是既定约束，无需自检", "不适用"]),
          };
        },
      },
    ],
  },
];

/** 按 id 查找规则。 */
export function getRule(id: string): RuleDefinition | undefined {
  return RULES.find((r) => r.id === id);
}

/** 按层分组返回规则（保持声明顺序）。 */
export function rulesByLayer(): Array<{ layer: RuleLayer; rules: RuleDefinition[] }> {
  const order: RuleLayer[] = ["基础", "命题", "证据", "机制", "自反"];
  return order
    .map((layer) => ({ layer, rules: RULES.filter((r) => r.layer === layer) }))
    .filter((g) => g.rules.length > 0);
}
