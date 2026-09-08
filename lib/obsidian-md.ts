import type { BrainNote } from "@/lib/brain-db";
import type { OrganizedNote, ActionItem, MetricItem, ProblemDomain, StrategyAngle } from "@/lib/brain-organizer";

// xiye ↔ Obsidian Markdown 互转。
// 设计：frontmatter 存元数据（含 obsidianNoteId 做精确溯源）；正文为原始 content；
// related 与 Obsidian [[wikilink]] 双向字符串互转；完整 struct JSON 藏在 HTML 注释里保证往返无损。

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

/** 文件名：标题+短id，如「需求评审-a1b2c3d4.md」，永不重名且人类可读 */
export function fileNameForNote(note: { id: string; title: string }): string {
  const short = note.id.split("-").pop() || note.id;
  const base = (note.title || "untitled").replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 80) || "untitled";
  return `${base}-${short}.md`;
}

function escapeScalar(v: string): string {
  return /[:#\[\]"',]/.test(v) || v.trim() !== v ? `"${v.replace(/"/g, '\\"')}"` : v;
}

function toYamlFrontmatter(meta: Record<string, unknown>): string {
  const lines = ["---"];
  for (const [k, v] of Object.entries(meta)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      lines.push(`${k}: ${v.length ? "[" + v.map((x) => escapeScalar(String(x))).join(", ") + "]" : "[]"}`);
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
  const meta: Record<string, unknown> = {
    title: note.title,
    category: note.category,
    tags: note.tags ?? [],
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    obsidianNoteId: note.id,
    source: note.source,
    xiyeType: parsed?.type ?? "",
  };
  const parts: string[] = [toYamlFrontmatter(meta), ""];
  if (note.content) parts.push(note.content);

  if (note.related && note.related.length) {
    parts.push("", "## 关联笔记", ...note.related.map((r) => `- [[${r}]]`));
  }

  if (note.struct) {
    const summary = parsed ? structToMarkdown(parsed) : "";
    if (summary) parts.push("", summary);
    parts.push("", STRUCT_OPEN, note.struct, STRUCT_CLOSE);
  }
  return parts.join("\n") + "\n";
}

export function markdownToNote(md: string): ObsidianNoteMeta {
  const { meta, body } = parseFrontmatter(md);

  // 隐藏 struct JSON
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

  return {
    title: typeof meta.title === "string" ? meta.title : "",
    category: typeof meta.category === "string" ? meta.category : "",
    tags: Array.isArray(meta.tags) ? (meta.tags as string[]) : [],
    content,
    related,
    struct,
    source: typeof meta.source === "string" ? meta.source : "obsidian",
    xiyeType: typeof meta.xiyeType === "string" ? meta.xiyeType : "",
    obsidianNoteId: typeof meta.obsidianNoteId === "string" ? meta.obsidianNoteId : "",
    createdAt: typeof meta.createdAt === "number" ? meta.createdAt : Date.now(),
    updatedAt: typeof meta.updatedAt === "number" ? meta.updatedAt : Date.now(),
  };
}
