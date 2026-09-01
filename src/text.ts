/**
 * 文本分析辅助函数。所有 L1/L2 检测都是基于这些启发式原语的确定性判断。
 * 刻意保持零网络、零 LLM 依赖，保证毫秒级响应与离线可用。
 */

/** 常用编程语言关键词（用于「语言/环境」维度检测）。 */
export const LANGUAGE_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "Python", re: /\bpython\b|\.py\b|pandas|django|flask|fastapi|pip\b/i },
  { name: "JavaScript", re: /\bjavascript\b|\bjs\b|node\.?js|react|vue|express|npm\b/i },
  { name: "TypeScript", re: /\btypescript\b|\bts\b|\.tsx?\b/i },
  { name: "Java", re: /\bjava\b|spring|maven|gradle|jvm/i },
  { name: "Go", re: /\bgolang\b|\bgo\b|goroutine/i },
  { name: "Rust", re: /\brust\b|cargo\b|\.rs\b/i },
  { name: "C++", re: /\bc\+\+\b|\bcpp\b|\.cpp\b|stl\b/i },
  { name: "C#", re: /\bc#\b|\.net\b|dotnet|asp\.net/i },
  { name: "Ruby", re: /\bruby\b|rails\b|\.rb\b/i },
  { name: "PHP", re: /\bphp\b|laravel|\.php\b/i },
  { name: "Swift", re: /\bswift\b|\.swift\b/i },
  { name: "Kotlin", re: /\bkotlin\b|\.kt\b/i },
  { name: "SQL", re: /\bsql\b|postgres|mysql|sqlite|\.sql\b/i },
  { name: "Shell", re: /\bshell\b|bash\b|\bsh\b|\.sh\b/i },
];

/** 常见框架/库（用于「时效偏向」：引用但未锁定版本）。 */
export const FRAMEWORK_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "React", re: /\breact\b/i },
  { name: "Vue", re: /\bvue\b/i },
  { name: "Angular", re: /\bangular\b/i },
  { name: "Next.js", re: /\bnext\.?js\b/i },
  { name: "Node", re: /\bnode\.?js\b|\bnode\b/i },
  { name: "Django", re: /\bdjango\b/i },
  { name: "Spring", re: /\bspring\b/i },
  { name: "Redux", re: /\bredux\b/i },
  { name: "Redis", re: /\bredis\b/i },
  { name: "Kafka", re: /\bkafka\b/i },
  { name: "Kubernetes", re: /\bk8s\b|kubernetes/i },
];

/** 版本号模式，如 Python 3.10、Node 18、v2.1.0。 */
export const VERSION_PATTERN = /\b(v?\d+(?:\.\d+){1,3}(?:[-.][0-9A-Za-z.-]+)?)\b/;

/** 代码块检测（``` 或缩进代码）。 */
export const CODE_FENCE_RE = /```[\s\S]*?```/g;

/** 主观/价值判断词（偏向扫描 + 命题类型）。 */
export const NORMATIVE_WORDS = [
  "应该", "必须", "最好", "最佳", "最优", "最优雅", "优雅", "推荐", "规范",
  "正确做法", "业界标准", "最佳实践", "should", "must", "best practice",
  "best", "always", "never", "proper", "elegant",
];

/** 全称断言词（输出侧过滤 + 偏向确定性）。 */
export const UNIVERSAL_WORDS = [
  "所有", "任何", "全部", "总是", "从不", "永远", "绝对", "毫无例外",
  "一律", "all", "every", "always", "never", "absolutely",
];

/** 表面修复信号（规则5：拟合 vs 机制）。 */
export const SURFACE_FIX_WORDS = [
  "绕过", "不报错", "先让它跑起来", "暂时", "临时", "hack", "workaround",
  "绕过问题", "屏蔽", "忽略这个错误", "try/catch 包住",
];

/** 根因分析信号（规则5 的正向信号）。 */
export const ROOT_CAUSE_WORDS = ["根因", "根本原因", "root cause", "为什么", "溯源", "定位原因"];

/** 强制指定信号（规则6：范式锁死）。 */
export const FORCED_CHOICE_WORDS = ["必须用", "必须使用", "一定要用", "只能用", "强制", "must use"];

/** 本地化处理信号词（偏向：文化/本地化——出现即视为已考虑本地化）。 */
export const LOCALIZATION_WORDS = ["本地化", "国际化", "i18n", "l10n", "locale", "多语言", "本地化处理"];

/** 区域敏感词（出现它们而缺失本地化考虑时提示）。 */
export const LOCALE_SENSITIVE_WORDS = ["时间", "日期", "货币", "单位", "时区", "语言", "金额", "价格", "排序规则"];

/** 因果主张词（规则7：因果识别）。 */
export const CAUSAL_WORDS = ["导致", "造成", "影响", "提高", "降低", "增加", "减少", "提升", "引起", "引发", "使", "会带来"];
/** 因果识别方法词（规则7 的正向信号：时序/干预/对照）。 */
export const CAUSAL_METHOD_WORDS = ["因果", "干预", "对照", "实验", "随机", "时序", "控制变量", "工具变量", "双重差分", "断点", "反事实", "机制"];

/** 替代方案词（规则8：替代模型）。 */
export const ALTERNATIVE_WORDS = ["对比", "替代", "备选", "其他方案", "多个方案", "权衡", "方案比较", "择优", "比较不同"];

/** 对抗性/反例词（规则9：对抗性证据）。 */
export const ADVERSARIAL_WORDS = ["反例", "失败场景", "缺点", "风险", "不利", "反驳", "边界失败", "极端情况", "反证", "最坏情况", "推翻", "证伪"];

/** 操作化信号词（规则5：操作化——什么观察算支持/反对）。 */
export const OPERATIONAL_WORDS = ["阈值", "指标", "单位", "范围", "时间窗", "对照组", "基准", "数量", "百分比", "延迟", "毫秒", "次数", "规模", "条件下", "边界值", "上限", "下限"];

/** 证据独立性信号词（规则4：证据独立性）。 */
export const INDEPENDENCE_WORDS = ["独立", "交叉验证", "不同来源", "独立样本", "互相独立", "独立证据", "多源"];

/** 绝对确定词（规则11：自我适用——把结论绝对化）。 */
export const ABSOLUTE_CERTAINTY_WORDS = ["绝对真理", "不容置疑", "唯一正确", "公认", "毋庸置疑", "放之四海", "恒真", "不证自明", "铁律"];

/** 含糊/弱回答信号（用于反诘用户填写的答案）。 */
export const VAGUE_WORDS = [
  "应该没问题", "差不多", "大概", "可能", "随便", "都行", "看情况",
  "不确定", "再说", "暂时", "先这样", "都差不多", "无所谓", "也许",
];

/**
 * 截取命中的原文片段，用于作为证据展示。
 * 取匹配点前后约 20 个字符，最多返回 `max` 条，去重。
 */
export function snippets(text: string, re: RegExp, max = 3): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const copy = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let m: RegExpExecArray | null;
  while ((m = copy.exec(text)) !== null && out.length < max) {
    const start = Math.max(0, m.index - 20);
    const end = Math.min(text.length, m.index + m[0].length + 20);
    const snip = text.slice(start, end).replace(/\s+/g, " ").trim();
    if (!seen.has(snip)) {
      seen.add(snip);
      out.push(snip);
    }
  }
  return out;
}

/** 是否包含任一关键词（大小写不敏感）。 */
export function hasAny(text: string, words: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return words.some((w) => lower.includes(w.toLowerCase()));
}

/** 检测文本中出现的语言名。 */
export function detectLanguages(text: string): string[] {
  return LANGUAGE_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.name);
}

/** 检测文本中出现的框架/库名。 */
export function detectFrameworks(text: string): string[] {
  return FRAMEWORK_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.name);
}

/** 统计代码块数量。 */
export function countCodeFences(text: string): number {
  return (text.match(CODE_FENCE_RE) ?? []).length;
}

/** 是否包含版本号。 */
export function hasVersion(text: string): boolean {
  return VERSION_PATTERN.test(text);
}

/**
 * 是否包含「框架/语言名后紧跟主版本号」的写法，如 "React 18"、"Python 3"。
 * 用于时效偏向检测：这类写法同样视为已（至少在大版本层面）锁定版本。
 */
export function hasFrameworkVersion(text: string): boolean {
  if (hasVersion(text)) return true;
  return /(?:react|vue|angular|next\.?js|node(?:\.js)?|django|spring|redux|redis|kafka|kubernetes|k8s|python|typescript|javascript|java|golang|rust|c\+\+|php|ruby|swift|kotlin|sql|express|laravel|dotnet)\s*\.?\s*\d{1,2}\b/i.test(
    text,
  );
}
