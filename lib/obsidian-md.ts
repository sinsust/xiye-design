import fs from "node:fs";
import path from "node:path";
import type { BrainNote } from "@/lib/brain-db";
import type { OrganizedNote, ActionItem, MetricItem, ProblemDomain, StrategyAngle } from "@/lib/brain-organizer";

// xiye ↔ Obsidian Markdown 互转。
// 设计原则：vault 里的文件是给用户看的 —— frontmatter 只保留对用户有意义/同步必需的最小集
//（xiyeId 定位锚 + tags 原生标签），xiye 内部字段（category/source/xiyeType/时间戳）一律不写，
// 同步所需元数据全部落在 DB（obsidianVault/obsidianRelPath/obsidianNoteId）与文件名里。
// 正文为原始 content；related 转为 [[wikilink]]；AI 结构化结论以可见 callout 呈现（不再藏 JSON 注释）。

export interface ObsidianNoteMeta {
  title: string;
  category: string;
  tags: string[];
  content: string;
  related: string[];
  struct: string | null;
  source: string;
  xiyeType: string;
  obsidianNoteId: string;
  createdAt: number;
  updatedAt: number;
}

const STRUCT_OPEN = "<!-- xiye-struct";
const STRUCT_CLOSE = "-->";

function sanitizeBase(title: string): string {
  return (title || "untitled").replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 80) || "untitled";
}

/** 解析最终文件名：默认纯标题（如「需求评审.md」）；
 *  仅当同名文件已被其他笔记占用时才追加短 id 消歧（如「需求评审-a1b2c3d4.md」）。 */
export function resolveFileNameForNote(dir: string, note: { id: string; title: string }): string {
  const candidate = `${sanitizeBase(note.title)}.md`;
  const abs = path.join(dir, candidate);
  if (!fs.existsSync(abs)) return candidate;
  try {
    // 已有同名文件：属于本笔记则直接复用，否则消歧
    const head = fs.readFileSync(abs, "utf8").slice(0, 500);
    if (head.includes(`xiyeId: ${note.id}`) || head.includes(`obsidianNoteId: ${note.id}`)) return candidate;
  } catch {
    /* 读取失败按占用处理，走消歧 */
  }
  const short = note.id.split("-").pop() || note.id;
  return `${sanitizeBase(note.title)}-${short}.md`;
}

function escapeScalar(v: string): string {
  return /[:#\[\]"',]/.test(v) || v.trim() !== v ? `"${v.replace(/"/g, '\\"')}"` : v;
}

function toYamlFrontmatter(meta: Record<string, unknown>): string {
  const lines = ["---"];
  for (const [k, v] of Object.entries(meta)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      if (!v.length) continue; // 空数组不写，减少属性面板噪音
      lines.push(`${k}: [${v.map((x) => escapeScalar(String(x))).join(", ")}]`);
    } else if (typeof v === "number" || typeof v === "boolean") {
      lines.push(`${k}: ${v}`);
    } else {
      lines.push(`${k}: ${escapeScalar(String(v))}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

function parseFrontmatter(raw: string): { meta: Record<string, unknown>; body: string } {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, unknown> = {};
  for (const line of m[1].split("\n")) {
    const mm = line.match(/^([\w-]+):\s*(.*)$/);
    if (!mm) continue;
    const key = mm[1];
    const val = mm[2].trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      const inner = val.slice(1, -1).trim();
      meta[key] = inner ? inner.split(",").map((s) => s.trim().replace(/^"|"$/g, "")) : [];
    } else if (val === "true" || val === "false") {
      meta[key] = val === "true";
    } else if (/^\d+$/.test(val)) {
      meta[key] = Number(val);
    } else {
      meta[key] = val.replace(/^"|"$/g, "");
    }
  }
  return { meta, body: raw.slice(m[0].length) };
}

function safeParse(s: string): OrganizedNote | null {
  try {
    return JSON.parse(s) as OrganizedNote;
  } catch {
    return null;
  }
}

function structToMarkdown(struct: OrganizedNote): string {
  const blocks: string[] = [];
  const add = (label: string, items: string[]) => {
    if (items.length) blocks.push(`**${label}**\n${items.map((i) => `- ${i}`).join("\n")}`);
  };
  add(
    "要点",
    (struct.keyPoints ?? []).map((k) => k.point),
  );
  add(
    "行动项",
    struct.actionItems.map((a: ActionItem) => (a.owner ? `${a.text} @${a.owner}` : a.text)),
  );
  add(
    "策略",
    struct.strategies.map((s) => s.title),
  );
  add("决议", struct.decisions);
  add("参会人", struct.attendees);
  add(
    "指标",
    struct.metrics.map((m: MetricItem) => `${m.label}: ${m.value}`),
  );
  add(
    "问题域",
    struct.problemDomains.map((p: ProblemDomain) => `${p.domain}: ${p.conclusion}`),
  );
  add(
    "跨域策略",
    struct.strategy.map((s: StrategyAngle) => `${s.angle}`),
  );
  add("开放问题", struct.openQuestions);
  if (!blocks.length) return "";
  return `> [!xiye] AI 结构化整理\n> ${blocks.join("\n> \n> ")}`;
}

export function noteToMarkdown(note: BrainNote): string {
  const parsed = note.struct ? safeParse(note.struct) : null;
  // frontmatter 最小集：xiyeId（双向同步定位锚）+ tags（Obsidian 原生标签，非空才写）
  const meta: Record<string, unknown> = { xiyeId: note.id };
  if (note.tags?.length) meta.tags = note.tags;
  const parts: string[] = [toYamlFrontmatter(meta), ""];
  if (note.content) parts.push(note.content);

  if (note.related && note.related.length) {
    parts.push("", "## 关联笔记", ...note.related.map((r) => `- [[${r}]]`));
  }

  if (note.struct) {
    const summary = parsed ? structToMarkdown(parsed) : "";
    if (summary) parts.push("", summary);
    // 不再写入 struct JSON 注释：结构化结果保留在 xiye 库中，vault 只呈现可读 callout
  }
  return parts.join("\n") + "\n";
}

export function markdownToNote(md: string): ObsidianNoteMeta {
  const { meta, body } = parseFrontmatter(md);

  // struct JSON（仅旧格式文件有；新格式不再写入，读取兼容保留）
  let struct: string | null = null;
  const sm = md.match(/<!-- xiye-struct\s*\n([\s\S]*?)\n-->/);
  if (sm) struct = sm[1].trim();

  // 关联区提取
  const related: string[] = [];
  const relSection = body.match(/##\s*关联笔记([\s\S]*?)(?=\n<!-- |$)/);
  if (relSection) {
    for (const m of relSection[1].matchAll(/\[\[([^\]]+)\]\]/g)) related.push(m[1].trim());
  }

  // 正文：去除 struct 注释、xiye callout、关联区
  const content = body
    .replace(/<!-- xiye-struct\s*\n[\s\S]*?\n-->/g, "")
    .replace(/>\s*\[!xiye\][\s\S]*?(?=\n## |\n# |\n<!-- |$)/g, "")
    .replace(/##\s*关联笔记[\s\S]*?(?=\n<!-- |$)/g, "")
    .trim();

  // 定位锚：新格式 xiyeId（= xiye 主键）；兼容旧格式 obsidianNoteId（= 文件名 stem）
  const anchor =
    typeof meta.xiyeId === "string" && meta.xiyeId
      ? meta.xiyeId
      : typeof meta.obsidianNoteId === "string"
        ? meta.obsidianNoteId
        : "";

  return {
    title: typeof meta.title === "string" ? meta.title : "",
    category: typeof meta.category === "string" ? meta.category : "",
    tags: Array.isArray(meta.tags) ? (meta.tags as string[]) : [],
    content,
    related,
    struct,
    source: typeof meta.source === "string" ? meta.source : "obsidian",
    xiyeType: typeof meta.xiyeType === "string" ? meta.xiyeType : "",
    obsidianNoteId: anchor,
    createdAt: typeof meta.createdAt === "number" ? meta.createdAt : Date.now(),
    updatedAt: typeof meta.updatedAt === "number" ? meta.updatedAt : Date.now(),
  };
}
