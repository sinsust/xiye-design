// 第二大脑 AI 整理管线：把用户"随手扔进来"的任意原始文本，
// 自动组织成结构化笔记 —— 分类 / 摘要 / 标签 / 关联建议。
// 优先 Qwen（OpenAI 兼容），失败/未配置时回退本地启发式，保证总能返回可用结构。
// 关联建议：若能匹配到用户已有笔记（按标题/内容相似），返回其 id，否则返回标题占位。

import type { BrainNote } from "./brain-db";

/** 输入类型：决定走哪套转译 prompt 与哪种可视化卡片 */
export type NoteType =
  | "meeting"    // 会议手记（杂乱）
  | "clip"       // 复制粘贴 / 网页文章
  | "jotting"    // 日常碎片 / 灵感
  | "markdown"   // 已有格式的 Markdown（规范化重排）
  | "snippet"    // 代码片段
  | "task";      // 待办清单

export interface ActionItem {
  text: string;
  // 负责人：从参会人/正文中指派的具体人名或称呼（如"老张""小李""我"），无则空字符串
  owner: string;
  dueDate: string | null;
  priority: "high" | "medium" | "low";
  // 关联到返回的 strategies 数组下标（0 起）；无关联则不填
  strategyIndex?: number;
}

/** 量化指标：从原文抽取的关键数字（ROI、曝光增幅、预算、GMV 目标、库存、退货率…） */
export interface MetricItem {
  label: string;
  value: string;
}

/** 问题域归类：把内容按主题聚合，呈现"现状/痛点 → 结论/待决策"逻辑链 */
export interface ProblemDomain {
  domain: string;
  status: string;
  conclusion: string;
}

/** 策略规划建议：跨问题域的主动推导（渠道侧/货品侧/组织侧/风险侧/长期建设…） */
export interface StrategyAngle {
  angle: string;
  logic: string;
}

export interface OrganizedNote {
  title: string;
  category: string;
  // 输入类型判别：meeting/clip/jotting/markdown/snippet/task
  type: NoteType;
  summary: string;
  tags: string[];
  // 关联建议（可能为空）；值为已有笔记 id 或未匹配到的标题
  related: string[];
  // 关联建议的理由（供 UI 展示"为什么相关"）
  relatedReason: string;
  // 从原文中识别出的待办任务
  actionItems: ActionItem[];
  // 会议纪要中拆解出的策略（如"Q3主攻东南亚市场"）
  strategies: { title: string; description: string }[];
  // 会议决议（纯文本），落库后并入笔记 summary 的扩展字段
  decisions: string[];
  // 参会人（从"参会人/参会"行识别的姓名或称呼）
  attendees: string[];
  // 关键量化指标（ROI、曝光、预算、GMV、库存、退货率…），保留数字作证据
  metrics: MetricItem[];
  // 问题域归类：现状/痛点 → 结论/待决策
  problemDomains: ProblemDomain[];
  // 待决策 / 待澄清的开放问题
  openQuestions: string[];
  // 策略规划建议：跨问题域的主动推导（渠道侧/货品侧/组织侧/风险侧/长期建设…）
  strategy: StrategyAngle[];
  // 原始内容是否被识别为会议纪要
  isMeeting: boolean;
  // 是否为代码片段
  isSnippet: boolean;
  // 编程语言（python/js/ts/sql/shell 等），从代码块标记或内容特征推断
  language: string;
  // 原始代码（不含解释说明），供高亮与一键复制
  codeContent: string;
  // 复制粘贴/网页类：出处或来源链接
  source?: string;
  // 核心观点 / 要点（clip 与 jotting 用）：每项一句话
  keyPoints?: { point: string }[];
  // 我的批注 / 启发 / 灵感（clip 与 jotting 用）
  insights?: string[];
  // 深度重写后的规范正文（Markdown）；空字符串表示未重写（如代码片段 / 启发式兜底）
  rewritten: string;
}

// 代码片段识别：命中足够多代码特征则判定为代码片段
const CODE_PATTERNS = [
  "```",
  "import ", "from ", "def ", "class ", "const ", "let ", "function ", "=>",
  "return ", "#include", "public ", "private ", "select ", "insert into ", "create table ",
  "var ", "await ", "async ", "console.", "print(", "if __name__",
];

/** 粗略推断编程语言（从代码块记号或内容特征） */
export function detectSnippetLanguage(content: string): string {
  const fence = content.match(/```\s*([a-zA-Z0-9]+)\s*\n/);
  if (fence) {
    const lang = fence[1].toLowerCase();
    const map: Record<string, string> = {
      py: "python", js: "javascript", ts: "typescript", "jsx": "javascript",
      "node": "javascript", sh: "shell", bash: "shell", shell: "shell",
      "mssql": "sql", psql: "sql", postgres: "sql",
    };
    return map[lang] ?? lang;
  }
  const s = content.toLowerCase();
  if (/def\s+\w|import\s+\w|print\(|__name__|#\s*include/.test(s)) {
    if (/#\s*include|#define/.test(s)) return "c";
    return "python";
  }
  if (/console\.(log|error)|const\s+\w+\s*=\s*(\(|\w)|function\s+\w+\s*\(|=>/.test(s)) {
    if (/:\s*(string|number|boolean|any)\b|\binterface\s+\w|\btype\s+\w+\s*=/.test(s)) return "typescript";
    return "javascript";
  }
  if (/\bselect\b.+\bfrom\b|insert\s+into|\border\s+by|\bcreate\s+table\b/.test(s)) return "sql";
  if (/\becho\b|\bcurl\b|#!\/bin|\bsudo\b|\bxargs\b|\b&>|\| grep\b/.test(s)) return "shell";
  return "text";
}

/** 启发式提取代码片段：完整抽取围栏代码块；无围栏则按代码特征行收敛 */
function heuristicSnippet(content: string): { codeContent: string; language: string } | null {
  const fence = content.match(/```[\s\S]*?```/);
  if (fence) {
    const raw = fence[0];
    const inner = raw.replace(/^```[a-zA-Z0-9]*\s*\n?/, "").replace(/\n?```$/, "").trim();
    if (inner) return { codeContent: inner, language: detectSnippetLanguage(raw) };
  }
  // 无围栏：挑代码特征行串成片段（最多 60 行）
  const lines = content.split("\n").map((l) => l.trimEnd());
  const sig = lines.filter(
    (l) =>
      /^\s*(import|from|def|class|const|let|var|function|return|#include|public|private|select|insert|create\s+table|async|await|[a-zA-Z_]\w*\s*=)/.test(l) ||
      l.includes("=>") ||
      l.includes("```"),
  );
  if (sig.length >= 2) {
    const codeContent = sig.slice(0, 60).join("\n");
    return { codeContent, language: detectSnippetLanguage(codeContent) };
  }
  return null;
}

/** 启发式检测是否代码片段 */
export function isSnippetNote(content: string): boolean {
  let score = 0;
  for (const p of CODE_PATTERNS) if (content.includes(p)) score++;
  // 有围栏代码块 → 视为片段
  if (content.includes("```") && /```[a-zA-Z0-9]*\s*\n[\s\S]*?```/.test(content)) return true;
  if (score >= 2) return true;
  // 大量代码特征行也算
  const lines = content.split("\n");
  const codeish = lines.filter(
    (l) =>
      /^\s*(import|from|def|class|const|let|var|function|return|#include|select|insert)/.test(l) ||
      l.trim().includes("=>"),
  ).length;
  return codeish >= 3;
}

/** 会议纪要识别关键词：命中足够多则走"纪要专用 Prompt" */
const MEETING_KEYWORDS = [
  "会议", "参会", "出席", "讨论", "决议", "纪要", "议题", "汇报",
  "主持人", "议程", "达成共识", "头脑风暴", "周会", "评审",
];

export function isMeetingNote(content: string): boolean {
  let score = 0;
  for (const k of MEETING_KEYWORDS) if (content.includes(k)) score++;
  if (score >= 2) return true;
  // 带动词性结论（决定/方向/拍板）+ 任一场合词，也算纪要
  return (
    (content.includes("纪要") || content.includes("会议") || content.includes("议题")) &&
    /决定|决议|方向|拍板|下一步|后续安排|目标/.test(content)
  );
}

/** 输入类型分类：启发式路由（snippet > meeting > markdown > task > clip > jotting） */
export function classifyInput(content: string): NoteType {
  const c = content.trim();
  if (isSnippetNote(c)) return "snippet";
  if (isMeetingNote(c)) return "meeting";

  const lines = c.split("\n");
  const headings = lines.filter((l) => /^\s*#{1,6}\s+/.test(l)).length;
  const lists = lines.filter((l) => /^\s*([-*+]|\d+[.)])\s+/.test(l)).length;
  const tables = (c.match(/\|.+\|/g) || []).length;
  const hasUrl = /https?:\/\//.test(c);
  const hasSource = /(来源|出处|原文|转载|读到|看到一篇|原文链接)/i.test(c);
  const longProse = lines.filter((l) => l.trim().length > 40).length >= 4;

  // 格式化 Markdown：明显结构化（多标题 + 列表/表格），且无网页来源特征
  if (headings >= 2 && (lists >= 2 || tables >= 1) && !hasUrl && !hasSource) return "markdown";
  // 纯待办：清单标记行占比高
  const nonEmpty = lines.filter((l) => l.trim()).length;
  const todoLines = lines.filter((l) => /^\s*([-*+]\s*\[[ xX]\]|(待办|TODO|todo)[:：]|^\s*\d+[.)]\s)/.test(l)).length;
  if (nonEmpty >= 2 && todoLines >= Math.max(2, nonEmpty * 0.6)) return "task";
  // 复制粘贴 / 网页：带链接、来源词或长段落散文
  if (hasUrl || hasSource || (longProse && headings === 0)) return "clip";
  // 默认：日常碎片
  return "jotting";
}

/** 按类型给默认分类（启发式兜底用） */
export function categoryForType(type: NoteType): string {
  switch (type) {
    case "meeting": return "工作";
    case "clip": return "阅读";
    case "jotting": return "随手记";
    case "markdown": return "文档";
    case "snippet": return "技术";
    case "task": return "待办";
  }
}

/** 启发式提取要点：短句收敛为 keyPoints（jotting/clip 兜底） */
function heuristicKeyPoints(content: string): { point: string }[] {
  return content
    .split(/\n|；|。/)
    .map((l) => l.trim().replace(/^[-*+•]\s*/, ""))
    .filter((l) => l.length >= 6 && l.length <= 60)
    .slice(0, 6)
    .map((point) => ({ point }));
}

/** 启发式提取任务：按"待办/需要/记得/下周/周五前"等关键词切分 */
function heuristicActionItems(content: string): OrganizedNote["actionItems"] {
  const lines = content
    .split(/\n|；|。/)
    .map((l) => l.trim())
    .filter(Boolean);
  const markers = ["待办", "todo", "TODO", "需要", "记得", "别忘了", "务必", "下周", "明天", "周五前", "尽快", "安排"];
  const items: OrganizedNote["actionItems"] = [];
  for (const line of lines) {
    if (line.length > 60) continue;
    if (!markers.some((m) => line.includes(m))) continue;
    const text = line.replace(/^(待办|TODO|todo|To-do|需要|记得|别忘了|务必)[:：\s]*/, "").slice(0, 40);
    if (!text) continue;
    // 尝试提取截止日期（复用 parseRelativeDate：本地时区、无 UTC 差一天问题）
    const dueMatch = line.match(/(\d{1,2}\s*月\s*\d{1,2}\s*日|下周[一二三四五六日天]*|明天|后天|周五|本周末|月底|\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
    const today = new Date();
    const dueDate = dueMatch ? parseRelativeDate(dueMatch[0], today) : null;
    items.push({ text, owner: "", dueDate, priority: line.includes("紧急") || line.includes("尽快") ? "high" : "medium" });
  }
  return items.slice(0, 6);
}

/** 把文本里的相对时间（明天/后天/本周五/下周三前/月底/X月Y日/YYYY-M-D）按今天换算成 ISO 日期；无法推断返回 null */
export function parseRelativeDate(text: string, today: Date = new Date()): string | null {
  const s = text.trim();
  const day = 86400_000;
  // 用本地时区格式化（toISOString 是 UTC，中国时区会差一天）
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayMs = today.getTime();

  const iso = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    return fmt(new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  }
  const md = s.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (md) {
    const d = new Date(today.getFullYear(), Number(md[1]) - 1, Number(md[2]));
    if (d.getTime() < todayMs - 30 * day) d.setFullYear(today.getFullYear() + 1);
    return fmt(d);
  }
  if (/后天/.test(s)) return fmt(new Date(todayMs + 2 * day));
  if (/明天/.test(s)) return fmt(new Date(todayMs + 1 * day));
  if (/本周末|这周末/.test(s)) {
    const off = (6 - today.getDay() + 7) % 7 || 7;
    return fmt(new Date(todayMs + off * day));
  }
  if (/月底|月末/.test(s)) {
    return fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0));
  }
  const weekdayOf = (m: RegExpMatchArray | null): number | null => {
    if (!m) return null;
    const map: Record<string, number> = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "日": 7, "天": 7 };
    return map[m[1]] ?? null;
  };
  const nextWeek = weekdayOf(s.match(/下周([一二三四五六日天])/));
  if (nextWeek !== null) {
    // 下周 X：先到本周日，再 +X 天（周一=1 … 周日=7）
    const days = 7 - today.getDay() + nextWeek;
    return fmt(new Date(todayMs + days * day));
  }
  const thisWeek = weekdayOf(s.match(/周([一二三四五六日天])/));
  if (thisWeek !== null) {
    let diff = (thisWeek - today.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    return fmt(new Date(todayMs + diff * day));
  }
  if (/下周/.test(s)) return fmt(new Date(todayMs + 7 * day));
  if (/本周/.test(s)) return fmt(new Date(todayMs + ((5 - today.getDay() + 7) % 7 || 7) * day));
  if (/这周|这礼拜/.test(s)) return fmt(new Date(todayMs + 2 * day));
  return null;
}

/** 规范化行动项日期：优先按 text 里的相对时间重算；AI 给的错年份/过去过久的日期清空 */
export function normalizeActionDates(actions: ActionItem[], today: Date = new Date()): ActionItem[] {
  const nowMs = today.getTime();
  const day = 86400_000;
  return actions.map((a) => {
    const rel = parseRelativeDate(a.text, today);
    if (rel) {
      const t = new Date(rel + "T00:00:00").getTime();
      return { ...a, dueDate: t >= nowMs - day ? rel : null };
    }
    if (!a.dueDate) return a;
    const t = new Date(a.dueDate + "T00:00:00").getTime();
    if (Number.isNaN(t)) return { ...a, dueDate: null };
    // 已过 14 天以上 → 大概率模型错年份，清空
    if (t < nowMs - 14 * day) return { ...a, dueDate: null };
    return a;
  });
}

/** 启发式提取策略：命中"决议/方向/策略/主攻"等词的行收敛为策略标题 */
function heuristicStrategies(content: string): OrganizedNote["strategies"] {
  const lines = content
    .split(/\n|。|；/)
    .map((l) => l.trim())
    .filter((l) => l && l.length <= 80);
  const markers = ["决议", "决定", "方向", "策略", "主打", "主攻", "重点推进", "目标", "未来半年", "下季度", "本季度", "市场"];
  const out: OrganizedNote["strategies"] = [];
  for (const line of lines) {
    if (!markers.some((m) => line.includes(m))) continue;
    let title = line
      .replace(/^(会议)?(决议|决定|方向|策略)[:：\s]*(一致同意|通过)?[:：\s]*/, "")
      .replace(/[。；]/g, "")
      .trim();
    if (!title) title = line.slice(0, 24);
    if (!title) continue;
    out.push({ title: title.slice(0, 30), description: line.slice(0, 120) });
    if (out.length >= 5) break;
  }
  return out;
}

/** 启发式提取会议决议：命中"决议/决定/拍板/定于/取消"等词的行 */
function heuristicDecisions(content: string): string[] {
  const lines = content
    .split(/\n|。|；/)
    .map((l) => l.trim())
    .filter((l) => l && l.length <= 120);
  const out: string[] = [];
  for (const line of lines) {
    if (!/决议|决定|拍板|通过|采纳|取消|改为|定于|明确|确定/.test(line)) continue;
    const text = line
      .replace(/^(会议)?(决议|决定)[:：\s]*(一致同意|通过)?[:：\s]*/, "")
      .replace(/[。；]$/, "")
      .trim()
      .slice(0, 80);
    if (text) out.push(text);
    if (out.length >= 8) break;
  }
  return out;
}

/** 启发式提取参会人：从"参会人/参会"行识别姓名或称呼 */
function heuristicAttendees(content: string): string[] {
  const line =
    content
      .split(/\n|；|;|。/)
      .find((l) => /参会|出席|参加/.test(l)) ?? "";
  if (!line) return [];
  const body = line.replace(/^[^：:]*[：:]\s*/, "").replace(/[（）()]/g, " ");
  const names = body
    .split(/[、，,/\s]+/)
    .map((s) => s.replace(/[（）()]/g, "").trim())
    .filter((s) => s.length >= 1 && s.length <= 8 && !/^(参会|出席|参加|和|与|及|等)$/.test(s));
  return names.slice(0, 12);
}

/** 启发式提取量化指标：抓"中文语境 + 数字 + 单位"片段 */
function heuristicMetrics(content: string): OrganizedNote["metrics"] {
  const out: OrganizedNote["metrics"] = [];
  const re = /([\u4e00-\u9fa5A-Za-z]{1,8})[：:\s]*([\d][\d.]*\s*[%+件元万人天倍]?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) && out.length < 10) {
    const label = m[1].trim();
    const value = m[2].trim();
    if (label.length >= 1 && !/^(的|了|有|是|在|和|与)$/.test(label)) {
      out.push({ label: label.slice(0, 12), value: value.slice(0, 40) });
    }
  }
  return out;
}

/** 启发式提取待澄清问题：以问号结尾或含"要不要/是否/报不报"的句子 */
function heuristicOpenQuestions(content: string): string[] {
  const out: string[] = [];
  for (const s of content.split(/\n|。|；|;/)) {
    const t = s.trim();
    if (!t) continue;
    if (/[？?]$/.test(t) || /(要不要|是否|报不报|该不该|能不能|可行吗|吗[？?]$)/.test(t)) {
      out.push(t.slice(0, 80));
    }
    if (out.length >= 8) break;
  }
  return out;
}

/** 轻量关键词提取：从内容抽 2-6 字连续中文片段，用于启发式兜底与相关匹配 */
function extractKeywords(content: string, max = 6): string[] {
  const cands = content.match(/[\u4e00-\u9fa5A-Za-z0-9]+/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of cands) {
    for (const w of [c, ...(c.length > 4 ? [c.slice(0, 4), c.slice(-4)] : [])]) {
      const clean = w.trim();
      if (clean.length < 2) continue;
      if (WEAK.has(clean)) continue;
      const key = clean.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(clean);
      break;
    }
    if (out.length >= max) break;
  }
  return out;
}

const WEAK = new Set([
  "这个", "一个", "可以", "需要", "进行", "还有", "以及", "不过", "因为", "所以",
  "就是", "不是", "怎么", "什么", "我们", "你们",
]);

/** 启发式标题：取内容首行截断 */
function heuristicTitle(content: string): string {
  const line = content.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  return line.length > 30 ? line.slice(0, 30) + "…" : line || "未命名想法";
}

function heuristicCategory(content: string): string {
  const kws = content.match(/[\u4e00-\u9fa5]{2,6}/g) ?? [];
  if (kws.some((k) => ["学习", "教程", "课程", "笔记", "学会", "掌握"].includes(k))) return "学习";
  if (kws.some((k) => ["会议", "周报", "工作", "项目", "客户", "任务"].includes(k))) return "工作";
  if (kws.some((k) => ["代码", "函数", "接口", "bug", "实现", "报错", "报错"].includes(k))) return "技术";
  if (kws.some((k) => ["设计", "界面", "配色", "字体", "风格"].includes(k))) return "设计";
  return "随手记";
}

/** 基于内容关键词，在已有笔记里找最相关的（标题/摘要/内容关键词重合度） */
function suggestRelated(content: string, existing: BrainNote[]): { related: string[]; reason: string } {
  const kws = new Set(extractKeywords(content, 8).map((k) => k.toLowerCase()));
  const scored = existing
    .map((n) => {
      const hay = `${n.title} ${n.summary} ${n.content}`.toLowerCase();
      let score = 0;
      for (const k of kws) {
        if (k.length >= 2 && hay.includes(k.slice(0, 2))) score++;
      }
      return { n, score };
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  if (!scored.length) return { related: [], reason: "" };
  return {
    related: scored.map(({ n }) => n.id),
    reason: "内容关键词与已有笔记重合，可能相关",
  };
}

function parseOrganized(raw: string): Partial<OrganizedNote> {
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    const obj = JSON.parse(cleaned) as Record<string, unknown>;
    const arr = (v: unknown): string[] =>
      Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 8) : [];
    const actionItems: OrganizedNote["actionItems"] = Array.isArray(obj.actionItems)
      ? obj.actionItems
          .map((it: unknown) => {
            const o = (it ?? {}) as Record<string, unknown>;
            const text = String(o.text ?? "").trim();
            return {
              text: text.slice(0, 40),
              owner: typeof o.owner === "string" ? o.owner.trim().slice(0, 12) : "",
              dueDate:
                typeof o.dueDate === "string" && o.dueDate.trim()
                  ? o.dueDate.trim().slice(0, 10)
                  : null,
              priority: (o.priority === "high" || o.priority === "low" ? o.priority : "medium") as
                | "high"
                | "medium"
                | "low",
              strategyIndex:
                typeof o.strategyIndex === "number" && o.strategyIndex >= 0
                  ? o.strategyIndex
                  : undefined,
            };
          })
          .filter((it) => it.text)
          .slice(0, 8)
      : [];
    const metrics: OrganizedNote["metrics"] = Array.isArray(obj.metrics)
      ? obj.metrics
          .map((m: unknown) => {
            const o = (m ?? {}) as Record<string, unknown>;
            return {
              label: String(o.label ?? "").trim().slice(0, 12),
              value: String(o.value ?? "").trim().slice(0, 40),
            };
          })
          .filter((m) => m.label && m.value)
          .slice(0, 12)
      : [];
    const problemDomains: OrganizedNote["problemDomains"] = Array.isArray(obj.problemDomains)
      ? obj.problemDomains
          .map((p: unknown) => {
            const o = (p ?? {}) as Record<string, unknown>;
            return {
              domain: String(o.domain ?? "").trim().slice(0, 10),
              status: String(o.status ?? "").trim().slice(0, 120),
              conclusion: String(o.conclusion ?? "").trim().slice(0, 120),
            };
          })
          .filter((p) => p.domain)
          .slice(0, 10)
      : [];
    const strategy: OrganizedNote["strategy"] = Array.isArray(obj.strategy)
      ? obj.strategy
          .map((s: unknown) => {
            const o = (s ?? {}) as Record<string, unknown>;
            return {
              angle: String(o.angle ?? "").trim().slice(0, 12),
              logic: String(o.logic ?? "").trim().slice(0, 160),
            };
          })
          .filter((s) => s.angle)
          .slice(0, 8)
      : [];
    const attendees: string[] = Array.isArray(obj.attendees)
      ? obj.attendees.map(String).filter(Boolean).slice(0, 12)
      : [];
    const openQuestions: string[] = Array.isArray(obj.openQuestions)
      ? obj.openQuestions.map(String).filter(Boolean).slice(0, 10)
      : [];
    const strategies: OrganizedNote["strategies"] = Array.isArray(obj.strategies)
      ? obj.strategies
          .map((s: unknown) => {
            const o = (s ?? {}) as Record<string, unknown>;
            return {
              title: String(o.title ?? "").trim().slice(0, 30),
              description: String(o.description ?? "").trim().slice(0, 200),
            };
          })
          .filter((s) => s.title)
          .slice(0, 5)
      : [];
    const decisions: string[] = Array.isArray(obj.decisions)
      ? obj.decisions.map(String).filter(Boolean).slice(0, 8)
      : [];
    const isSnippet: boolean = obj.isSnippet === true;
    const language =
      typeof obj.language === "string" && obj.language.trim() ? obj.language.trim().toLowerCase() : "";
    const codeContent =
      typeof obj.codeContent === "string" && obj.codeContent.trim() ? obj.codeContent : "";
    return {
      title: typeof obj.title === "string" && obj.title.trim() ? obj.title.trim() : undefined,
      category: typeof obj.category === "string" && obj.category.trim() ? obj.category.trim() : undefined,
      summary: typeof obj.summary === "string" && obj.summary.trim() ? obj.summary.trim() : undefined,
      tags: arr(obj.tags),
      related: arr(obj.related),
      relatedReason:
        typeof obj.relatedReason === "string" ? obj.relatedReason.trim() : undefined,
      actionItems,
      strategies,
      decisions,
      attendees,
      metrics,
      problemDomains,
      openQuestions,
      strategy,
      type:
        typeof obj.type === "string" &&
        (obj.type === "meeting" || obj.type === "clip" || obj.type === "jotting" ||
          obj.type === "markdown" || obj.type === "snippet" || obj.type === "task")
          ? (obj.type as NoteType)
          : undefined,
      source: typeof obj.source === "string" && obj.source.trim() ? obj.source.trim().slice(0, 300) : undefined,
      keyPoints: Array.isArray(obj.keyPoints)
        ? obj.keyPoints
            .map((k: unknown) => {
              const o = (k ?? {}) as Record<string, unknown>;
              return { point: String(o.point ?? "").trim().slice(0, 80) };
            })
            .filter((k) => k.point)
            .slice(0, 12)
        : undefined,
      insights: Array.isArray(obj.insights)
        ? obj.insights.map(String).filter(Boolean).slice(0, 10)
        : undefined,
      isSnippet,
      language,
      codeContent,
      rewritten:
        typeof obj.rewritten === "string" && obj.rewritten.trim()
          ? obj.rewritten.trim().slice(0, 6000)
          : undefined,
    };
  } catch {
    return {};
  }
}

async function callQwen(
  content: string,
  existing: BrainNote[],
  type: NoteType,
): Promise<Partial<OrganizedNote>> {
  const baseUrl = (process.env.LLM_MODEL_BASE_URL || "").replace(/\/+$/, "");
  /** 统一字段声明：所有类型共用同一套 OrganizedNote 键，按类型填充相关字段、其余留空 */
  const COMMON_FIELDS =
    "title（简洁标题，≤30 字）、category（分类，从「工作 / 阅读 / 学习 / 技术 / 设计 / 生活 / 灵感 / 随手记 / 文档 / 待办」中选一个）、" +
    "summary（一句话摘要，≤60 字）、tags（3–5 个标签字符串数组）、related（关联建议，字符串数组，每项指向下方已有笔记 **id**；若无紧密关联留空数组）、" +
    "relatedReason（若 related 非空，用一句话说明为什么关联，否则空字符串）、" +
    "attendees（字符串数组：若正文提到人物/参会者则列出姓名或称呼，否则空数组 []）、" +
    "metrics（数组：抽取原文全部关键量化指标，每项 {label: 指标名≤12字, value: 数值含单位}；无数字则空数组 []）、" +
    "problemDomains（数组：把内容按主题归类，每项 {domain: 问题域名称≤10字, status: 现状/痛点一句话, conclusion: 结论或待决策一句话}；无法归类则空数组 []）、" +
    "openQuestions（数组：原文抛出的待澄清/待决策问题；无则空数组 []）、" +
    "actionItems（数组，提取原文中明确要求去做的任务，每项含 text 任务内容≤40字、owner 负责人称呼(无则空字符串)、dueDate 截止日期(仅当原文给了明确绝对日期如 '2026-08-28' 或 '8月28日' 才填 ISO 格式 YYYY-MM-DD；原文是相对时间如'周二前'/'本周内'/'下周三' 一律填 null，并把相对时间原样保留在 text 里)、priority 'high'/'medium'/'low'、strategyIndex 该任务关联到的 strategies 数组下标，无关联则为 null；原文若无明确任务则输出空数组 []）、" +
    "strategies（数组，从原文提炼的长期策略/方向，每项含 title≤30字、description≤80字；原文若非策略性质则空数组 []）、" +
    "strategy（数组：基于全局主动推导的「策略规划建议」，每项 {angle: 角度名如'效率侧'/'风险侧'/'长期建设', logic: 该角度核心策略逻辑≤120字}；无则空数组 []）、" +
    "decisions（字符串数组，明确做出的决议结论；若无则为空数组 []）、" +
    "isSnippet（布尔，原文是否为代码片段；含代码块/函数定义/import 等视为 true，否则 false）、" +
    "language（若 isSnippet=true，此处的编程语言如 python/javascript/typescript/sql/shell，否则空字符串）、" +
    "codeContent（若 isSnippet=true，严格抽取原文中的代码部分，不含中文解释说明；否则空字符串）、";

  /** 按输入类型选择转译 prompt：同一套字段，按类型指定重点与 rewritten 模板 */
  function buildSystemPrompt(type: NoteType): string {
    const tail = "只输出 JSON，不要多余内容。";
    switch (type) {
      case "meeting":
        return (
          "你是『第二大脑』的会议纪要拆解助手，把杂乱的会议手记重构成专业级结构化纪要。即使原文没有明确总结，也要基于事实主动推导结论与行动。根据内容输出严格 JSON，键为：" +
          "category（「工作」）、" +
          COMMON_FIELDS +
          "attendees（字符串数组：从「参会人/参会」行识别全部参会者姓名或称呼，如 [「我」,「老张」,「小李」,「王姐」,「小陈」,「实习生」]；无法识别则为空数组 []）、" +
          "metrics（数组：从原文抽取全部关键量化指标，每项 {label: 指标名≤12字, value: 数值含单位如 'ROI 1:1.2'/'小红书曝光 +30%'/'市场预算 -15%'/'GMV 目标 +20%'/'尾货 3000件'/'退货率 35%'/'客单价 ¥345'/'整体转化率 2.1%'/'访客 -8%'/'企微 2万·活跃<10%'}；无数字则空数组 []）、" +
          "problemDomains（数组：把内容按「问题域」归类，每项 {domain: 问题域名称≤10字, status: 现状/痛点一句话, conclusion: 初步结论或待决策一句话}；典型域：渠道投放/市场预算/设计产能/夏季尾货/私域运营/新品跟进/双11规划/达人直播/首页改版/会员体系）、" +
          "openQuestions（数组：原文抛出的待决策/待澄清问题，如「双11报不报？备货多少？」「学生证折扣可行吗？」；无则空数组 []）、" +
          "strategies（数组，拆解出会议决定的长期策略/方向，每项含 title≤30字如『Q3主攻东南亚市场』、description≤80字说明为什么与怎么做）、" +
          "strategy（数组：基于全局主动推导的「策略规划建议」，按角度拆分，每项 {angle: 角度名如 「渠道侧」/「货品侧」/「组织侧」/「风险侧」/「长期建设」, logic: 该角度核心策略逻辑≤120字}；这是对原文未明说部分的主动推导，应给出可执行的策略方向）、" +
          "decisions（数组，会议明确通过的决议/结论，一句一条；若原文无显式决议则为空数组 []）、" +
          "actionItems（数组，会上明确的待办，每项含 text≤40字、owner 负责人姓名(从 attendees 中取，无则为空字符串)、dueDate(仅当原文给了明确绝对日期如 '2026-08-28'/'8月28日' 才填 ISO YYYY-MM-DD；相对时间如'下周三前'/'本周内' 一律填 null 并把相对时间原样保留在 text 里，由系统按今天自动换算)、priority 'high'/'medium'/'low'、strategyIndex 该任务服务于哪个 strategies 下标，无则 null）、" +
          "isSnippet（false）、language（''）、codeContent（''）、source（''）、keyPoints（[]）、insights（[]）、" +
          "rewritten（字符串，把原始手记重写成专业会议纪要 Markdown，结构：\n## 会议名称 / 日期 / 参会人 / 核心议题\n## 一、关键问题与决策摘要（表格 | 问题域 | 现状/痛点 | 初步结论/待决策 |）\n## 二、下阶段行动计划（表格 | 事项 | 负责人 | 时间节点 |）\n## 三、遗留问题与风险\n## 四、下次会议安排\n## 五、策略规划建议（按 渠道侧/货品侧/组织侧/风险侧/长期建设 分点）\n保留全部关键事实、数据、人名、决策；去除口语冗余与重复；若原文已是规范纪要则留空字符串）。" +
          tail
        );
      case "clip":
        return (
          "你是『第二大脑』的阅读笔记整理助手，把复制粘贴进来的网页/文章转成「来源 + 核心观点 + 我的批注 + 行动」的结构化阅读笔记。长文要提炼而非照抄。根据内容输出严格 JSON，键为：" +
          "category（「阅读」）、" +
          COMMON_FIELDS +
          "source（字符串：原文出处或来源链接；无则空字符串）、" +
          "keyPoints（数组：从原文提炼的核心观点/要点，每项 {point: 一句话≤60字}；3–8 条）、" +
          "insights（数组：基于原文的批注/启发/联想，每条≤60字；无则空数组 []）、" +
          "actionItems（若原文含可执行建议则提取，否则空数组）、" +
          "rewritten（字符串，把内容重写成阅读笔记 Markdown，结构：\n## 来源 / 出处\n## 核心观点\n## 我的批注与启发\n## 行动项\n保留关键事实与数据，去除广告/导航等冗余；若原文已是规范笔记则留空字符串）。" +
          tail
        );
      case "jotting":
        return (
          "你是『第二大脑』的灵感碎片整理助手，把零散的日常记录升华成「要点 + 灵感 + 待办 + 关联」的结构化卡片。根据内容输出严格 JSON，键为：" +
          "category（「随手记」）、" +
          COMMON_FIELDS +
          "keyPoints（数组：从碎片中提炼的要点/事实，每项 {point: 一句话≤50字}；无则空数组 []）、" +
          "insights（数组：碎片引发的想法/灵感/待探究，每条≤60字；无则空数组 []）、" +
          "openQuestions（数组：原文抛出的待探究问题；无则空数组 []）、" +
          "actionItems（若碎片含明确待办则提取，否则空数组）、" +
          "rewritten（字符串，把碎片重写成灵感卡片 Markdown，结构：\n## 要点\n## 灵感与想法\n## 待办\n## 关联线索\n保留原意，去除口水话；若内容已是规范卡片则留空字符串）。" +
          tail
        );
      case "markdown":
        return (
          "你是『第二大脑』的文档规范化助手。原文已是 Markdown，不要重新概括或删改语义，只做「规范化重排」：统一标题层级、修正嵌套、若分节≥3 在顶部补一个目录、把表格对齐为规范 Markdown 表格、给代码块标注语言、统一列表与标点。同时抽取元数据。根据内容输出严格 JSON，键为：" +
          "category（「文档」）、" +
          COMMON_FIELDS +
          "source（字符串：若原文含来源链接则填，否则空字符串）、" +
          "keyPoints（[]）、insights（[]）、" +
          "rewritten（字符串：规范化重排后的完整 Markdown 正文，保留全部原文内容与顺序，仅调整格式与可读性，不要删减信息；若原文为代码片段则留空字符串）。" +
          tail
        );
      case "snippet":
        return (
          "你是『第二大脑』的代码片段整理助手。根据内容输出严格 JSON，键为：" +
          "category（「技术」）、" +
          COMMON_FIELDS +
          "rewritten（字符串，代码片段留空字符串）。" +
          tail
        );
      case "task":
        return (
          "你是『第二大脑』的待办整理助手，把待办清单解析成带负责人/截止/优先级的行动项，并按主题或优先级分组。根据内容输出严格 JSON，键为：" +
          "category（「待办」）、" +
          COMMON_FIELDS +
          "keyPoints（[]）、insights（[]）、" +
          "actionItems（清单里每一项都应收录，尽量补全 owner 与 dueDate）、" +
          "rewritten（字符串，把清单重写成分组待办 Markdown，结构：\n## 高优先级\n- [ ] 事项（负责人 · 截止）\n## 中优先级\n## 低优先级\n保留全部待办，能推断的负责人/时间尽量补全）。" +
          tail
        );
      default:
        return buildSystemPrompt("jotting");
    }
  }
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LLM_MODEL_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL_MODEL_ID,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(type),
        },
        {
          role: "user",
          content: JSON.stringify({
            raw: content,
            existingNotes: existing.slice(0, 60).map((n) => ({ id: n.id, title: n.title, summary: n.summary })),
          }),
        },
      ],
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`brain_organize_${res.status}`);
  const data = await res.json();
  const content0: string = data?.choices?.[0]?.message?.content ?? "";
  if (!content0) throw new Error("brain_organize_empty");
  return parseOrganized(content0);
}

/** 整理一段原始文本为结构化笔记。existing 用于关联建议与兜底。服务端调用。 */
export async function organizeNote(
  content: string,
  existing: BrainNote[] = [],
): Promise<OrganizedNote> {
  const type = classifyInput(content);
  const isMeeting = type === "meeting";
  const base: OrganizedNote = {
    title: heuristicTitle(content),
    category: categoryForType(type),
    type,
    summary: content.replace(/\n+/g, " ").slice(0, 60),
    tags: extractKeywords(content, 5),
    related: [],
    relatedReason: "",
    actionItems: heuristicActionItems(content),
    strategies: isMeeting ? heuristicStrategies(content) : [],
    decisions: isMeeting ? heuristicDecisions(content) : [],
    attendees: isMeeting ? heuristicAttendees(content) : [],
    metrics: heuristicMetrics(content),
    problemDomains: [],
    openQuestions: isMeeting ? heuristicOpenQuestions(content) : [],
    strategy: [],
    isMeeting,
    isSnippet: isSnippetNote(content),
    language: "",
    codeContent: "",
    source: type === "clip" ? (content.match(/https?:\/\/[^\s)"']+/)?.[0] ?? "") : "",
    keyPoints: type === "clip" || type === "jotting" ? heuristicKeyPoints(content) : [],
    insights: [],
    rewritten: "",
  };
  // 代码片段：启发式抽取 codeContent 并推断语言
  if (base.isSnippet) {
    const snip = heuristicSnippet(content);
    if (snip) {
      base.codeContent = snip.codeContent;
      base.language = snip.language;
    }
  }

  const apiKey = process.env.LLM_MODEL_API_KEY;
  const baseUrl = process.env.LLM_MODEL_BASE_URL;
  const model = process.env.LLM_MODEL_MODEL_ID;
  if (apiKey && baseUrl && model && content.trim().length > 4) {
    try {
      const ai = await callQwen(content, existing, type);
      const merged: OrganizedNote = {
        title: ai.title || base.title,
        category: ai.category || base.category,
        type: ai.type || type,
        summary: ai.summary || base.summary,
        tags: ai.tags?.length ? ai.tags : base.tags,
        related: ai.related?.length ? ai.related : base.related,
        relatedReason: ai.relatedReason || "",
        actionItems: ai.actionItems?.length ? ai.actionItems : base.actionItems,
        strategies: ai.strategies?.length ? ai.strategies : base.strategies,
        decisions: ai.decisions?.length ? ai.decisions : base.decisions,
        attendees: ai.attendees?.length ? ai.attendees : base.attendees,
        metrics: ai.metrics?.length ? ai.metrics : base.metrics,
        problemDomains: ai.problemDomains?.length ? ai.problemDomains : base.problemDomains,
        openQuestions: ai.openQuestions?.length ? ai.openQuestions : base.openQuestions,
        strategy: ai.strategy?.length ? ai.strategy : base.strategy,
        isMeeting,
        // 片段标记优先采纳启发式判定，AI 补充语言与代码内容
        isSnippet: base.isSnippet,
        language: ai.language || base.language,
        codeContent: ai.codeContent || base.codeContent,
        source: ai.source || base.source,
        keyPoints: ai.keyPoints?.length ? ai.keyPoints : base.keyPoints,
        insights: ai.insights?.length ? ai.insights : base.insights,
        rewritten: ai.rewritten || "",
      };
      // 行动项日期统一规范化：相对时间按今天换算，错年份/过去过久的清空
      merged.actionItems = normalizeActionDates(merged.actionItems);
      if (merged.decisions.length && merged.summary) {
        merged.summary = merged.summary.replace(/\n+$/, "");
      }
      // AI 未给出关联时仍尝试关键词启发式补一个
      if (!merged.related.length) {
        const kw = suggestRelated(content, existing);
        if (kw.related.length) {
          merged.related = kw.related;
          merged.relatedReason = kw.reason;
        }
      }
      return merged;
    } catch {
      // Qwen 失败 → 用启发式结果
    }
  }
  const kw = suggestRelated(content, existing);
  return { ...base, related: kw.related, relatedReason: kw.reason };
}

// ---------------- 收件箱意图分类（第九阶段） ----------------

// 收件箱条目 intent：note / task / meeting / snippet / project / unknown
export type InboxIntent = "note" | "task" | "meeting" | "snippet" | "project" | "unknown";

export interface IntentVerdict {
  intent: InboxIntent;
  confidence: number;
}

const PROJECT_KEYWORDS = ["项目", "立项", "启动", "规划", "milestone", "里程碑", "roadmap", "路线图"];

// 「时间 + 动作」的任务线索，如「下周三前完成」「明天交」
const TASK_TIME_PATTERN = /(下周|本周|明天|今天|后天|周[一二三四五六日]|\d{1,2}\/\d{1,2}|\d{2,4}-\d{1,2}-\d{1,2}).{0,8}(完成|交|提交|发|做|整理|准备|汇总|出|写|搞定|处理)/;

/**
 * 从原始文本做纯启发式意图判定（不调用 LLM，与 organizer 现有 heuristics 复用）。
 * 命中即停、按优先级：代码 > 时间+动作(任务) > 会议 > 项目 > 普通笔记。
 * 仅供独立调用/降级使用；POST /inbox 走 deriveIntentFromOrganizedNote（合并 AI 结果）。
 */
export function classifyIntent(content: string): IntentVerdict & {
  suggestedTitle: string;
  suggestedCategory: string;
  suggestedTags: string[];
} {
  const c = content || "";
  let intent: InboxIntent = "note";
  let confidence = 0.6;
  if (isSnippetNote(c)) {
    intent = "snippet";
    confidence = 0.95;
  } else if (TASK_TIME_PATTERN.test(c) || heuristicActionItems(c).length > 0) {
    intent = "task";
    confidence = 0.85;
  } else if (isMeetingNote(c)) {
    intent = "meeting";
    confidence = 0.9;
  } else if (PROJECT_KEYWORDS.some((k) => c.includes(k))) {
    intent = "project";
    confidence = 0.7;
  }
  const type = classifyInput(c);
  return {
    intent,
    confidence,
    suggestedTitle: heuristicTitle(c),
    suggestedCategory: categoryForType(type),
    suggestedTags: extractKeywords(c, 5),
  };
}

/** 收件箱条目确认时，依据 AI 整理结果（OrganizedNote）判定可靠意图。 */
export function deriveIntentFromOrganizedNote(
  content: string,
  o: OrganizedNote,
): IntentVerdict {
  const hasAction = o.actionItems.length > 0;
  const hasStrategy = o.strategies.length > 0;
  // 依规格优先级：任务(有动作无策略) → 会议 → 片段 → 项目 → 笔记
  if (hasAction && !hasStrategy) return { intent: "task", confidence: 0.85 };
  if (o.isMeeting) return { intent: "meeting", confidence: 0.9 };
  if (o.isSnippet) return { intent: "snippet", confidence: 0.95 };
  if (PROJECT_KEYWORDS.some((k) => content.includes(k))) return { intent: "project", confidence: 0.7 };
  return { intent: "note", confidence: 0.6 };
}