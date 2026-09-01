import type { CompletenessItem, Question } from "../types.js";
import { countCodeFences, detectLanguages, hasAny, hasVersion } from "../text.js";

/** 任务类型信号词，映射到任务类型名。 */
const TASK_TYPE_PATTERNS: Array<{ type: string; re: RegExp }> = [
  { type: "实现功能", re: /实现|开发|新建|搭建|创建|加一个|写个|写一个|implement|build|add|create/i },
  { type: "修复 Bug", re: /修复|bug|报错|出错|不报错|排查|解决|debug|fix/i },
  { type: "重构", re: /重构|重写|整理|拆分|refactor|clean\s*up/i },
  { type: "性能优化", re: /优化|性能|提速|加速|复杂度|perf|optimize/i },
  { type: "测试", re: /测试|单测|单元测试|用例|test|覆盖率/i },
  { type: "文档", re: /文档|注释|readme|说明|写文档|doc/i },
];

interface Dimension {
  key: string;
  label: string;
  /** 是否为硬性缺失（缺失时报 warn 及以上）。 */
  required: boolean;
  detect: (text: string) => { present: boolean; evidence: string[] };
  question: Question;
}

function q(key: string, text: string, reason: string, options?: string[]): Question {
  return { id: `completeness-${key}`, text, reason, options, allowSkip: true };
}

const DIMENSIONS: Dimension[] = [
  {
    key: "taskType",
    label: "任务类型",
    required: true,
    detect: (text) => {
      const hits = TASK_TYPE_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.type);
      return { present: hits.length > 0, evidence: hits };
    },
    question: q(
      "taskType",
      "这次任务属于哪类？",
      "缺少任务动词，无法判断是实现、修复、重构、优化、测试还是文档",
      ["实现功能", "修复 Bug", "重构", "性能优化", "测试", "文档"],
    ),
  },
  {
    key: "environment",
    label: "编程语言 / 环境",
    required: true,
    detect: (text) => {
      const langs = detectLanguages(text);
      const versioned = hasVersion(text);
      return {
        present: langs.length > 0,
        evidence: versioned ? langs : langs.map((l) => `${l}（未标注版本）`),
      };
    },
    question: q(
      "environment",
      "目标语言与运行时是什么（含版本）？",
      "未指定语言/版本，伪代码可能被当作可运行代码",
      ["Python 3.10+", "Node.js 18+", "浏览器（前端）", "其他 / 不适用"],
    ),
  },
  {
    key: "inputOutput",
    label: "输入输出定义",
    required: false,
    detect: (text) => ({
      present: /输入|输出|入参|出参|返回值|函数签名|签名|参数|数据结构|类型定义|接口|API|返回类型/i.test(text),
      evidence: [],
    }),
    question: q("inputOutput", "输入输出如何定义（函数签名/数据结构/返回类型）？", "未定义输入输出，实现边界不清晰"),
  },
  {
    key: "boundary",
    label: "边界条件",
    required: false,
    detect: (text) => ({
      present: /异常|边界|空值|null|并发|线程|容量|错误处理|兜底|边界值|超时|重试|edge\s*case/i.test(text),
      evidence: [],
    }),
    question: q("boundary", "需要覆盖哪些边界/异常场景？", "未声明异常、空值、边界值或并发约束", ["空值/null 处理", "异常与错误处理", "并发/线程安全", "容量/规模上限", "暂不关心边界"]),
  },
  {
    key: "performance",
    label: "性能要求",
    required: false,
    detect: (text) => ({
      present: /复杂度|O\(|性能|内存|吞吐|延迟|毫秒|并发|速度|效率|qps|耗时/i.test(text),
      evidence: [],
    }),
    question: q("performance", "是否有性能/资源约束（时间/空间复杂度、内存、吞吐）？", "未声明性能约束", ["有明确复杂度要求", "有大致性能目标", "无性能要求"]),
  },
  {
    key: "evidence",
    label: "证据 / 参考样本",
    required: false,
    detect: (text) => ({
      present: countCodeFences(text) > 0 || /参考|示例|文档|链接|报错|日志|traceback|stack\s*trace|错误信息|错误堆栈|附上/i.test(text),
      evidence: [],
    }),
    question: q("evidence", "是否有参考代码 / 文档 / 报错日志可提供？", "缺少证据样本，判断只能依赖模型先验"),
  },
  {
    key: "outputFormat",
    label: "输出格式",
    required: false,
    detect: (text) => ({
      present: /仅代码|只要代码|注释|测试|解释|原理|示例|markdown|文档|报告|说明|给出理由/i.test(text),
      evidence: [],
    }),
    question: q("outputFormat", "期望输出什么格式？", "未指定输出形态，可能偏离预期", ["仅代码", "代码 + 注释", "代码 + 测试", "代码 + 原理解释"]),
  },
  {
    key: "confidence",
    label: "置信度要求",
    required: false,
    detect: (text) => ({
      present: /确定|唯一|最佳|最好|对比|方案|概率|可能|权衡|取舍|多个方案/i.test(text),
      evidence: [],
    }),
    question: q("confidence", "期望确定性回答还是多方案对比？", "未声明置信度期望", ["确定性答案", "多方案对比", "概率性判断 / 附权衡"]),
  },
];

/** 硬性维度 key 集合。 */
export const REQUIRED_DIMENSIONS = new Set(
  DIMENSIONS.filter((d) => d.required).map((d) => d.key),
);

/** 对指令文本做完整性检测，返回每个维度的判定。 */
export function checkCompleteness(text: string): CompletenessItem[] {
  return DIMENSIONS.map((d) => {
    const { present, evidence } = d.detect(text);
    return {
      dimension: d.key,
      label: d.label,
      present,
      required: d.required,
      evidence,
      question: present ? undefined : d.question,
    };
  });
}

/** 仅返回缺失的硬性维度（供 L1 快速检查）。 */
export function hardMissingDimensions(text: string): CompletenessItem[] {
  return checkCompleteness(text).filter((i) => !i.present && i.required);
}
