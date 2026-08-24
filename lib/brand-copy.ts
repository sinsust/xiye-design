// 品牌包文案提取：从 tsx/ts 源码里安全地摘出「可翻译的英文文案节点」。
// 只摘两类天然属于展示文案的位置 —— ①JSX 文本节点 ②字符串字面量(JSX 属性 / 对象键值)，
// 并做强过滤，绝不把 import 路径、className、URL、代码标识等误当文案。
// 改写只发生在临时副本上，本模块只读源文本，不写盘。

/** 语义上属于「代码/样式/校验」的属性名，即便值是字符串也不当文案。 */
const CODE_ATTRS = new Set([
  "id", "name", "type", "href", "src", "srcSet", "className", "class",
  "style", "key", "ref", "variant", "size", "role", "tabIndex", "rel",
  "target", "method", "action", "as", "for", "htmlFor", "width", "height",
  "x", "y", "cx", "cy", "r", "d", "coords", "fill", "fillRule", "fillOpacity",
  "stroke", "strokeWidth", "strokeLinecap", "strokeLinejoin", "viewBox",
  "preserveAspectRatio", "xmlns", "xmlnsXlink", "xlinkHref", "clipPath",
  "clipRule", "opacity", "fontSize", "fontWeight", "fontFamily", "color",
  "bg", "border", "cursor", "flex", "grid", "zIndex", "maxWidth", "minWidth",
  "display", "whitespace", "overflow", "position", "transform", "theme",
  "layout", "data", "value", "defaultValue", "checked", "disabled", "hidden",
  "autoComplete", "autoCorrect", "spellCheck", "inputMode", "contentEditable",
  "accept", "multiple", "cols", "rows", "step", "min", "max", "pattern",
  "required", "readOnly", "selected", "open", "loading", "decoding", "draggable",
  "suppressHydrationWarning", "dangerouslySetInnerHTML", "crossOrigin",
  "unoptimized", "priority", "external", "solid", "editable", "shellColor",
  "sortKey", "columns", "rows", "dir", "colSpan", "rowSpan", "media",
]);

/** 即便不在 CODE_ATTRS，也一眼能看出是「对象字面量里的数据键」的键名。 */
const CODE_KEYS = new Set([
  "id", "name", "type", "key", "href", "src", "icon", "component", "node",
  "style", "className", "variant", "size", "as", "code", "language", "theme",
  "color", "srcSet", "sizes", "loading", "alt", "ariaLabel", "value",
  "position", "layout", "height", "width", "opacity", "transform", "transition",
  "display", "overflow", "margin", "padding", "font", "text", "align",
]);

/** 常见 CSS 取值 / 表单类型等「纯代码语义词」，单独成串时绝不当作文案。 */
const CODE_WORDS = new Set([
  "auto", "flex", "block", "inline", "absolute", "relative", "fixed", "sticky",
  "none", "hidden", "center", "left", "right", "top", "bottom", "transparent",
  "solid", "dashed", "uppercase", "lowercase", "capitalize", "normal", "bold",
  "italic", "medium", "small", "large", "primary", "secondary", "default",
  "outline", "ghost", "link", "text", "number", "date", "email", "password",
  "tel", "url", "search", "button", "submit", "reset", "checkbox", "radio",
  "range", "file", "image", "color", "number", "true", "false", "string",
  "object", "array", "function", "boolean", "pointer", "default",
]);

/** 值是否像「可展示的英文文案」（强过滤，宁可漏译也不误伤代码）。 */
function looksLikeCopy(raw: string): boolean {
  const t = raw.trim();
  if (t.length < 3 || t.length > 300) return false;
  // 含插值/模板/括号/分隔符/除法 → 跳过，避免拆代码、拆 media 查询
  if (/[{}[\]$`\\<>\/()%:=]/.test(t)) return false;
  // 显然是 URL / 锚点 / 字体名 / 纯符号
  if (t.startsWith("#") || t.startsWith(".") || t.includes("://") || t.includes("@")) return false;
  // 纯数字/百分比/货币/时间戳
  if (/^[\d\s%\.:+,+\-−–—·]+$/.test(t)) return false;
  const letters = (t.match(/[A-Za-z]/g) || []).length;
  const camel = (t.match(/[a-z][A-Z]/g) || []).length;
  if (letters < 2) return false;
  if (letters / t.length < 0.4) return false; // 符号/数字占比过高
  if (camel >= 2) return false; // 驼峰如 className/component → 代码标识
  if (CODE_WORDS.has(t.toLowerCase())) return false; // 单纯代码语义词
  return true;
}

/** 对象字面量值偏保守：必须是「多词」或足够长，避免把 'auto'/'flex' 等当文案。 */
function looksLikeObjectValue(raw: string): boolean {
  const t = raw.trim();
  if (!looksLikeCopy(t)) return false;
  return t.includes(" ") || t.length > 8;
}

/**
 * JS 字符串字面量里「句子样」的文案（FAQ 提问/答案、段落等包在 {}、===、数组里的文字）。
 * 要求像散文：有小写结尾带标点，或含大写首字母，长句同样满足；工具类/类名等纯小写短串被排除。
 */
function looksLikeSentenceLiteral(raw: string): boolean {
  const t = raw.trim();
  if (t.length < 8 || t.length > 400) return false;
  if (!/\s/.test(t)) return false; // 必须含空格，排除单词/标识
  if (/[{}[\]$`\\<>\/@=#]/.test(t)) return false;
  const letters = (t.match(/[A-Za-z]/g) || []).length;
  if (letters / t.length < 0.5) return false;
  const hasUpper = /[A-Z]/.test(t);
  const hasSentenceEnd = /[.!?，。？]$/.test(t);
  if (!hasUpper && !hasSentenceEnd && t.length < 30) return false;
  return true;
}

/** 一处可翻译文案在源码里的原始片段（value 为去空白后的值，start/end 指向该值文本）。 */
export interface CopyOccurrence {
  value: string;
  start: number;
  end: number;
}

/** 扫描一段源码中的所有可翻译文案原文片段（含精确位置）。 */
export function extractCopyOccurrences(source: string): CopyOccurrence[] {
  const out: CopyOccurrence[] = [];
  const usedStarts = new Set<number>();
  const pushSpan = (rawStart: number, rawEnd: number) => {
    const raw = source.slice(rawStart, rawEnd);
    const t = raw.trim();
    if (!looksLikeCopy(t)) return;
    const lead = raw.indexOf(t);
    const start = rawStart + lead;
    if (usedStarts.has(start)) return;
    usedStarts.add(start);
    out.push({ value: t, start, end: start + t.length });
  };

  // ① JSX 文本节点：>文字</...>，只在单行内匹配，避免跨标签误吞
  const textRe = />([^<>{}\n]+)</g;
  let m: RegExpExecArray | null;
  while ((m = textRe.exec(source))) {
    pushSpan(m.index + 1, m.index + 1 + m[1].length);
  }

  // ② JSX 属性字符串：attr="value"（跳过 CODE_ATTRS 与 aria-*/data-*）
  const attrRe = /[A-Za-z][\w-]*\s*=\s*(['"`])(.*?)\1/g;
  while ((m = attrRe.exec(source))) {
    const before = source.slice(0, m.index);
    const nameMatch = /([A-Za-z][\w-]*)\s*=\s*$/.exec(before);
    const attr = nameMatch ? nameMatch[1] : "";
    if (!attr || CODE_ATTRS.has(attr)) continue;
    if (attr.startsWith("aria-") || attr.startsWith("data-")) continue;
    const valStart = m[0].indexOf(m[2]);
    pushSpan(m.index + valStart, m.index + valStart + m[2].length);
  }

  // ③ 对象字面量字符串值：key: "value"（跳过 CODE_KEYS 与单字母键，值须偏「文案」）
  const objRe = /([\w.$-]+)\s*:\s*(['"`])(.*?)\2/g;
  while ((m = objRe.exec(source))) {
    const keyRaw = m[1].trim();
    const key = keyRaw.split(".").pop() ?? keyRaw;
    if (key.length <= 1 || CODE_KEYS.has(key)) continue;
    if (looksLikeObjectValue(m[3])) {
      const valStart = m[0].indexOf(m[3]);
      pushSpan(m.index + valStart, m.index + valStart + m[3].length);
    }
  }

  // ④ JS 字符串字面量（一致性兜底）：===、三元、{'text'}、数组元素里的整句/段落。
  // 用 start 去重，避免与 ②③ 重复；只命中「句子样」散文。
  const litRe = /(['"`])((?:\\.|[^\\\n])*?)\1/g;
  while ((m = litRe.exec(source))) {
    const v = m[2];
    if (!looksLikeSentenceLiteral(v)) continue;
    const t = v.trim();
    const lead = v.indexOf(t);
    const start = m.index + 1 + lead;
    if (usedStarts.has(start)) continue;
    usedStarts.add(start);
    out.push({ value: t, start, end: start + t.length });
  }

  // 按原文长度降序，保证外层长串先处理
  return out.sort((a, b) => b.value.length - a.value.length);
}

/** 提取去重后的文案值（按出现次数排序），供 LLM 批次翻译。 */
export function extractCopyStrings(source: string): string[] {
  const seen = new Map<string, number>();
  for (const o of extractCopyOccurrences(source)) {
    seen.set(o.value, (seen.get(o.value) || 0) + 1);
  }
  return [...seen.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([s]) => s);
}

/**
 * 原位替换：只改动 extractCopyOccurrences 扫出的原文片段（JSX 文本/属性值/对象值），
 * 绝不触碰 import 路径、组件标识符、className、URL 等。按 start 从后往前回填，偏移不受影响。
 */
export function applyCopyToOccurrences(
  source: string,
  occurrences: CopyOccurrence[],
  map: Map<string, string>,
): string {
  const targets = occurrences
    .filter((o) => {
      const next = map.get(o.value);
      return next && next.trim() && next !== o.value;
    })
    .sort((a, b) => b.start - a.start);
  if (targets.length === 0) return source;
  let out = source;
  for (const o of targets) {
    const next = map.get(o.value) as string;
    out = out.slice(0, o.start) + next + out.slice(o.end);
  }
  return out;
}