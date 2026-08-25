import type { ReactNode } from "react";
import { ClipboardList, Cloud, FileText, FileUp, Mic } from "lucide-react";
import type { BrainTaskPriority, BrainTaskStatus, BrainStrategyStatus } from "@/lib/brain-db";
import type { BrainNote } from "./types";

// 冷静的蓝青灰分类色（仅作为内容识别用，主色跟随系统主题）
export const CATEGORY_COLORS: Record<string, string> = {
  工作: "#2563eb",
  学习: "#0ea5e9",
  技术: "#0891b2",
  设计: "#6366f1",
  生活: "#059669",
  灵感: "#8b5cf6",
  随手记: "#94a3b8",
};

export const CATEGORY_OPTIONS = ["工作", "学习", "技术", "设计", "生活", "灵感", "随手记"];

export function catColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? "#94a3b8";
}

// 代码片段语言色（用于语言标签与小色块）
const LANG_COLOR: Record<string, string> = {
  python: "#3776ab",
  javascript: "#f0db4f",
  js: "#f0db4f",
  typescript: "#3178c6",
  ts: "#3178c6",
  sql: "#e38c00",
  shell: "#4eaa25",
  bash: "#4eaa25",
  c: "#a8b9cc",
  css: "#563d7c",
  text: "#94a3b8",
};

export function langColor(lang: string | null): string {
  if (!lang) return "#94a3b8";
  return LANG_COLOR[lang.toLowerCase()] ?? "#64748b";
}

export function langLabel(lang: string | null): string {
  if (!lang) return "";
  const l = lang.toLowerCase();
  const map: Record<string, string> = {
    javascript: "JS",
    js: "JS",
    typescript: "TS",
    ts: "TS",
    python: "Python",
    sql: "SQL",
    shell: "Shell",
    bash: "Shell",
    text: "Text",
  };
  return map[l] ?? l;
}

/** 把代码片段预览截断为前 N 行 */
export function snippetPreview(code: string, lines = 5): string {
  if (!code) return "";
  const arr = code.split("\n");
  return arr.slice(0, lines).join("\n");
}

/** 极简语法高亮：把代码转成 React 节点（字符串/注释/关键词/函数/数字） */
export function highlightCode(code: string): ReactNode {
  const tokens = code
    .split(/(\s+|"[^"]*"|'[^']*'|#.*$|\/\/.*$|[-+*\/%<>=!&|^]+|\b\d+(?:\.\d+)?\b|[,:{}\[\]()])/gm)
    .filter((t) => t !== "");
  const KEYWORDS = new Set([
    "import", "from", "def", "class", "return", "if", "elif", "else", "for", "while",
    "in", "not", "and", "or", "is", "None", "True", "False", "print", "lambda",
    "const", "let", "var", "function", "async", "await", "export", "default",
    "select", "from", "where", "insert", "into", "values", "create", "table", "order",
    "by", "group", "join", "on", "as", "limit", "set", "update", "delete", "case",
  ]);
  return tokens.map((t, i) => {
    if (/^"[^"]*"$/.test(t) || /^'[^']*'$/.test(t)) return <span key={i} style={{ color: "#a5b4fc" }}>{t}</span>;
    if (/^#.*/.test(t) || /^\/\/.*/.test(t)) return <span key={i} style={{ color: "#64748b" }}>{t}</span>;
    if (KEYWORDS.has(t)) return <span key={i} style={{ color: "#f472b6" }}>{t}</span>;
    if (/^\d+(\.\d+)?$/.test(t)) return <span key={i} style={{ color: "#fbbf24" }}>{t}</span>;
    return t;
  });
}

export const STATUS_LABEL: Record<BrainTaskStatus, string> = { todo: "待办", in_progress: "进行中", done: "已完成" };
export const STATUS_NEXT: Record<BrainTaskStatus, BrainTaskStatus> = { todo: "in_progress", in_progress: "done", done: "todo" };
export const PRIORITY_RANK: Record<BrainTaskPriority, number> = { high: 0, medium: 1, low: 2 };
export const PRIORITY_COLOR: Record<BrainTaskPriority, string> = { high: "#ef4444", medium: "#f59e0b", low: "#9ca3af" };

// 策略状态
export const STRATEGY_LABEL: Record<BrainStrategyStatus, string> = {
  active: "活跃",
  paused: "暂停",
  achieved: "已达成",
  abandoned: "已放弃",
};
export const STRATEGY_NEXT: Record<BrainStrategyStatus, BrainStrategyStatus> = {
  active: "paused",
  paused: "achieved",
  achieved: "abandoned",
  abandoned: "active",
};
export const STRATEGY_COLOR: Record<BrainStrategyStatus, string> = {
  active: "#16a34a",
  paused: "#f59e0b",
  achieved: "#2563eb",
  abandoned: "#9ca3af",
};

/** 把私人笔记映射成图谱节点（"相关"弱关系） */
export function asGraphEntries(notes: BrainNote[]) {
  return notes.map((n) => ({
    slug: n.id,
    name: n.title || n.content.slice(0, 8),
    type: (n.category || "随手记") as unknown as import("@/lib/knowledge-types").KnowledgeType,
    summary: n.summary,
    body: n.content,
    related: n.related,
  }));
}

export const SOURCE_ICON: Record<string, ReactNode> = {
  text: <FileText className="size-3.5" />,
  file: <FileUp className="size-3.5" />,
  clip: <ClipboardList className="size-3.5" />,
  voice: <Mic className="size-3.5" />,
  ima: <Cloud className="size-3.5" />,
};

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "刚刚";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
  return new Date(ts).toLocaleDateString("zh-CN");
}

/** 今天（YYYY-MM-DD），用于判断任务是否过期 */
export function nowDateStr(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function formatDueDate(dueDate: string): string {
  const mm = dueDate.slice(5, 7);
  const dd = dueDate.slice(8, 10);
  const yy = dueDate.slice(0, 4);
  const curYY = String(new Date().getFullYear());
  return yy === curYY ? `${Number(mm)}月${Number(dd)}日` : `${yy}-${mm}-${dd}`;
}

/** 把 ISO 下次复习时间转成"X 分钟后 / X 小时后 / 明天 / X 天后"的友好文案 */
export function nextInHours(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "已到期";
  const min = Math.round(diff / 60000);
  if (min < 60) return `${Math.max(1, min)} 分钟后`;
  const h = Math.round(diff / 3600_000);
  if (h < 24) return `${h} 小时后`;
  const d = Math.round(h / 24);
  if (d <= 1) return "明天";
  if (d < 30) return `${d} 天后`;
  const dt = new Date(iso);
  return `${dt.getMonth() + 1}月${dt.getDate()}日`;
}

export const inputCls =
  "w-full rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary";