// 第二大脑 AI 整理管线：把用户"随手扔进来"的任意原始文本，
// 自动组织成结构化笔记 —— 分类 / 摘要 / 标签 / 关联建议。
// 优先 Qwen（OpenAI 兼容），失败/未配置时回退本地启发式，保证总能返回可用结构。
// 关联建议：若能匹配到用户已有笔记（按标题/内容相似），返回其 id，否则返回标题占位。

import type { BrainNote } from "./brain-db";

export interface ActionItem {
  text: string;
  dueDate: string | null;
  priority: "high" | "medium" | "low";
  // 关联到返回的 strategies 数组下标（0 起）；无关联则不填
  strategyIndex?: number;
}

export interface OrganizedNote {
  title: string;
  category: string;
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
  // 原始内容是否被识别为会议纪要
  isMeeting: boolean;
  // 是否为代码片段
  isSnippet: boolean;
  // 编程语言（python/js/ts/sql/shell 等），从代码块标记或内容特征推断
  language: string;
  // 原始代码（不含解释说明），供高亮与一键复制
  codeContent: string;
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
    // 尝试提取截止日期
    const dueMatch = line.match(/(\d{1,2}\s*月\s*\d{1,2}\s*日|下周[一二三四五六日天]*|明天|周五|本周末|\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
    const today = new Date();
    let dueDate: string | null = null;
    if (dueMatch) {
      const m = dueMatch[0];
      const mm = m.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
      if (mm) {
        const d = new Date(today.getFullYear(), Number(mm[1]) - 1, Number(mm[2]));
        dueDate = d.toISOString().slice(0, 10);
      } else {
        const off = m.includes("明天") ? 1 : m.includes("本周末") ? 5 : m.includes("周五") ? ((5 - today.getDay() + 7) % 7 || 7) : m.includes("下周") ? 7 : 2;
        const d = new Date(today.getTime() + off * 86400_000);
        dueDate = d.toISOString().slice(0, 10);
      }
    }
    items.push({ text, dueDate, priority: line.includes("紧急") || line.includes("尽快") ? "high" : "medium" });
  }
  return items.slice(0, 6);
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
          .slice(0, 6)
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
  isMeeting: boolean,
): Promise<Partial<OrganizedNote>> {
  const baseUrl = (process.env.LLM_MODEL_BASE_URL || "").replace(/\/+$/, "");
  const baseSystem =
    "你是『第二大脑』的策展助手，帮用户把杂乱的随手记整理成结构化笔记。根据原始文本输出严格 JSON，键为：" +
    "title（简洁标题，≤30 字）、category（分类，从「工作 / 学习 / 技术 / 设计 / 生活 / 灵感 / 随手记」中选一个）、" +
    "summary（一句话摘要，≤60 字）、tags（3–5 个标签字符串数组）、related（关联建议，字符串数组，每项指向下方已有笔记 **id**；若无紧密关联留空数组）、" +
    "relatedReason（若 related 非空，用一句话说明为什么关联，否则空字符串）、" +
    "actionItems（数组，提取原文中明确要求去做的任务，每项含 text 任务内容≤40字、dueDate 截止日期(ISO 日期 YYYY-MM-DD)若无则为空字符串或 null、priority 'high'/'medium'/'low'、strategyIndex 该任务关联到的 strategies 数组下标，无关联则为 null；原文若无明确任务则输出空数组 []）、" +
    "strategies（数组，从原文提炼的长期策略/方向，每项含 title≤30字、description≤60字；原文若非策略性质则空数组 []）、" +
    "decisions（字符串数组，会议明确做出的决议结论；若无则为空数组 []）、" +
    "isSnippet（布尔，原文是否为代码片段；含代码块/函数定义/import 等视为 true，否则 false）、" +
    "language（若 isSnippet=true，此处的编程语言如 python/javascript/typescript/sql/shell，否则空字符串）、" +
    "codeContent（若 isSnippet=true，严格抽取原文中的代码部分，不含中文解释说明；否则空字符串）、" +
    "rewritten（字符串，把原始杂乱文本重写成结构清晰、条理分明的 Markdown 正文；保留全部关键事实、数据、人名、决策，去除口语冗余与重复；按内容自行选用小标题如「背景」「核心要点」「待办事项」「待澄清」组织；若原文为代码片段则留空字符串）。只输出 JSON，不要多余内容。";
  const meetingSystem =
    "你是『第二大脑』的会议纪要拆解助手，把输入整理成结构化笔记并拆出策略与任务。根据内容输出严格 JSON，键为：" +
    "title（会议/议题标题）、category（从「工作 / 学习 / 技术 / 设计 / 生活 / 灵感 / 随手记」中选一个，会议一般归「工作」）" +
    "、summary（一句话摘要≤60字）、tags（3–5 个标签）、related（关联已有笔记 id 数组，无则空）、relatedReason（相关说明）、" +
    "strategies（数组，拆解出会议决定的长期策略/方向，每项含 title≤30字如『Q3主攻东南亚市场』、description≤60字说明为什么与怎么做）、" +
    "decisions（数组，会议明确通过的决议/结论，一句一条）、" +
    "actionItems（数组，会上明确的待办，每项含 text≤40字、dueDate(ISO YYYY-MM-DD，无则null)、priority 'high'/'medium'/'low'、strategyIndex 该任务服务于哪个 strategies 下标，无则 null）、" +
    "rewritten（字符串，把原始会议记录重写成结构清晰的 Markdown 纪要；保留全部决议、行动项、负责人、时间节点与关键数据；用「会议背景」「会议决议」「行动项」「待澄清」等小标题组织；若原文已是规范纪要则留空字符串）。只输出 JSON，不要多余内容。";
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
          content: isMeeting ? meetingSystem : baseSystem,
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
  const isMeeting = isMeetingNote(content);
  const base: OrganizedNote = {
    title: heuristicTitle(content),
    category: isMeeting ? "工作" : heuristicCategory(content),
    summary: content.replace(/\n+/g, " ").slice(0, 60),
    tags: extractKeywords(content, 5),
    related: [],
    relatedReason: "",
    actionItems: heuristicActionItems(content),
    strategies: isMeeting ? heuristicStrategies(content) : [],
    decisions: isMeeting ? heuristicDecisions(content) : [],
    isMeeting,
    isSnippet: isSnippetNote(content),
    language: "",
    codeContent: "",
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
      const ai = await callQwen(content, existing, isMeeting);
      const merged: OrganizedNote = {
        title: ai.title || base.title,
        category: ai.category || base.category,
        summary: ai.summary || base.summary,
        tags: ai.tags?.length ? ai.tags : base.tags,
        related: ai.related?.length ? ai.related : base.related,
        relatedReason: ai.relatedReason || "",
        actionItems: ai.actionItems?.length ? ai.actionItems : base.actionItems,
        strategies: ai.strategies?.length ? ai.strategies : base.strategies,
        decisions: ai.decisions?.length ? ai.decisions : base.decisions,
        isMeeting,
        // 片段标记优先采纳启发式判定，AI 补充语言与代码内容
        isSnippet: base.isSnippet,
        language: ai.language || base.language,
        codeContent: ai.codeContent || base.codeContent,
        rewritten: ai.rewritten || "",
      };
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