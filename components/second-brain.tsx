"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Brain,
  CalendarClock,
  Check,
  ArrowRight,
  FileUp,
  GraduationCap,
  Inbox,
  Loader2,
  Pencil,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KnowledgeGraph } from "@/components/knowledge-graph";
import { ImaImportModal } from "@/components/ImaImportModal";
import BatchImportModal from "@/components/BatchImportModal";
import { MarkdownView } from "@/components/MarkdownView";
import { ReminderCenter } from "@/components/reminders/ReminderCenter";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { InboxDrawer } from "@/components/InboxDrawer";
import TaskDetailDrawer from "@/components/tasks/TaskDetailDrawer";
import ProjectPanel from "@/components/projects/ProjectPanel";
import GroupedBoard from "@/components/tasks/GroupedBoard";
import GanttView from "@/components/GanttView";
import { detectLearningTopics } from "@/lib/brain-path";
import type { LearningTopic } from "@/lib/brain-path";
import type {
  BrainTask,
  BrainTaskPriority,
  BrainTaskStatus,
  BrainStrategy,
  BrainStrategyStatus,
} from "@/lib/brain-db";

interface BrainNote {
  id: string;
  source: string;
  title: string;
  content: string;
  category: string;
  summary: string;
  tags: string[];
  related: string[];
  // 版本链
  parentId: string | null;
  version: number;
  superseded: boolean;
  // 代码片段
  isSnippet: boolean;
  language: string | null;
  codeContent: string | null;
  // AI 整理完整结构化结果（OrganizedNote JSON 字符串）；null 表示未整理
  struct: string | null;
  createdAt: number;
  updatedAt: number;
}

interface OrganizedActionItem {
  text: string;
  owner: string;
  dueDate: string | null;
  priority: BrainTaskPriority;
  strategyIndex?: number;
}

interface OrganizedMetric {
  label: string;
  value: string;
}
interface OrganizedProblemDomain {
  domain: string;
  status: string;
  conclusion: string;
}
interface OrganizedStrategy {
  angle: string;
  logic: string;
}

interface OrganizedDraft {
  title: string;
  category: string;
  // 输入类型：meeting/clip/jotting/markdown/snippet/task
  type?: string;
  summary: string;
  tags: string[];
  related: string[];
  relatedReason: string;
  actionItems: OrganizedActionItem[];
  strategies: { title: string; description: string }[];
  decisions: string[];
  attendees: string[];
  metrics: OrganizedMetric[];
  problemDomains: OrganizedProblemDomain[];
  openQuestions: string[];
  strategy: OrganizedStrategy[];
  isMeeting: boolean;
  isSnippet: boolean;
  language: string;
  codeContent: string;
  // 复制粘贴/网页类：出处或来源链接
  source?: string;
  // 核心观点 / 要点（clip 与 jotting 用）
  keyPoints?: { point: string }[];
  // 我的批注 / 启发 / 灵感（clip 与 jotting 用）
  insights?: string[];
  // 深度重写后的规范正文（Markdown）；空字符串表示未重写
  rewritten: string;
}

/** 自适应卡片输入：与 OrganizedDraft 结构化字段对齐 */
interface StructViewData {
  type?: string;
  attendees?: string[];
  metrics?: OrganizedMetric[];
  problemDomains?: OrganizedProblemDomain[];
  openQuestions?: string[];
  actionItems?: OrganizedActionItem[];
  strategy?: OrganizedStrategy[];
  decisions?: string[];
  source?: string;
  keyPoints?: { point: string }[];
  insights?: string[];
}

const TYPE_LABEL: Record<string, string> = {
  meeting: "会议纪要",
  clip: "阅读摘录",
  jotting: "灵感碎片",
  markdown: "文档",
  snippet: "代码片段",
  task: "待办清单",
};

/** 按输入类型自适应渲染 AI 结构化结果；无内容返回 null。传 onActionItemsChange 时行动项可编辑（工作台用），否则只读 */
function StructPreview({ d, onActionItemsChange }: { d: StructViewData; onActionItemsChange?: (items: OrganizedActionItem[]) => void }) {
  const type = d.type || "jotting";
  const ai = d.actionItems ?? [];
  const kp = d.keyPoints ?? [];
  const ins = d.insights ?? [];
  const has =
    (d.attendees?.length || 0) +
    (d.metrics?.length || 0) +
    (d.problemDomains?.length || 0) +
    ai.length +
    (d.strategy?.length || 0) +
    (d.openQuestions?.length || 0) +
    (d.decisions?.length || 0) +
    kp.length +
    ins.length +
    (d.source ? 1 : 0);
  if (!has) return null;

  const sectionTitle = (t: string) => (
    <div className="mb-1 text-xs font-medium text-foreground">{t}</div>
  );

  return (
    <div className="space-y-4 rounded-lg border border-dashed border-border p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-primary">AI 结构化拆解</div>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
          {TYPE_LABEL[type] || "随手记"}
        </span>
      </div>

      {/* 参会人 + 指标 chips：有则展示（会议/粘贴类常见） */}
      {(d.attendees?.length || d.metrics?.length) ? (
        <div className="flex flex-wrap gap-1.5">
          {(d.attendees ?? []).map((a) => (
            <span key={a} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
              {a}
            </span>
          ))}
          {(d.metrics ?? []).map((m, i) => (
            <span key={i} className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-foreground">
              <span className="text-muted-foreground">{m.label}</span>{" "}
              <span className="font-semibold">{m.value}</span>
            </span>
          ))}
        </div>
      ) : null}

      {/* 问题域表（会议） */}
      {(d.problemDomains?.length || 0) > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="border border-border px-2 py-1 font-medium">问题域</th>
                <th className="border border-border px-2 py-1 font-medium">现状 / 痛点</th>
                <th className="border border-border px-2 py-1 font-medium">结论 / 待决策</th>
              </tr>
            </thead>
            <tbody>
              {(d.problemDomains ?? []).map((p, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap border border-border px-2 py-1 font-medium text-foreground">
                    {p.domain}
                  </td>
                  <td className="border border-border px-2 py-1 text-muted-foreground">{p.status}</td>
                  <td className="border border-border px-2 py-1 text-foreground">{p.conclusion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 会议决议 */}
      {(d.decisions?.length || 0) > 0 && (
        <div>
          {sectionTitle("会议决议")}
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-foreground">
            {(d.decisions ?? []).map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 来源（clip） */}
      {d.source ? (
        <div>
          {sectionTitle("来源")}
          <p className="break-all text-xs text-muted-foreground">{d.source}</p>
        </div>
      ) : null}

      {/* 核心观点 / 要点（clip / jotting） */}
      {kp.length > 0 && (
        <div>
          {sectionTitle(type === "clip" ? "核心观点" : "要点")}
          <ul className="space-y-1">
            {kp.map((k, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs text-foreground"
              >
                <span className="mt-0.5 text-primary">•</span>
                <span className="flex-1">{k.point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 我的批注 / 灵感 */}
      {ins.length > 0 && (
        <div>
          {sectionTitle(type === "clip" ? "我的批注与启发" : "灵感")}
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
            {ins.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 行动项：所有类型通用；工作台可编辑，详情只读 */}
      {ai.length > 0 && (
        <div>
          {sectionTitle("行动项")}
          {onActionItemsChange ? (
            <div className="space-y-1.5">
              {ai.map((a, i) => (
                <div key={i} className="space-y-1 rounded-md border border-border bg-muted/40 p-2 text-xs">
                  <div className="flex items-center gap-2">
                    <input
                      value={a.text}
                      onChange={(ev) => {
                        const next = [...ai];
                        next[i] = { ...next[i], text: ev.target.value };
                        onActionItemsChange(next);
                      }}
                      className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-1"
                      placeholder="行动内容"
                    />
                    <button
                      onClick={() => onActionItemsChange(ai.filter((_, j) => j !== i))}
                      className="shrink-0 text-muted-foreground transition hover:text-destructive"
                      aria-label="删除行动项"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <input
                      value={a.owner ?? ""}
                      onChange={(ev) => {
                        const next = [...ai];
                        next[i] = { ...next[i], owner: ev.target.value };
                        onActionItemsChange(next);
                      }}
                      className="w-20 rounded border border-border bg-background px-1.5 py-0.5"
                      placeholder="负责人"
                    />
                    <input
                      type="date"
                      value={a.dueDate ?? ""}
                      onChange={(ev) => {
                        const next = [...ai];
                        next[i] = { ...next[i], dueDate: ev.target.value || null };
                        onActionItemsChange(next);
                      }}
                      className="rounded border border-border bg-background px-1.5 py-0.5"
                    />
                    <select
                      value={a.priority}
                      onChange={(ev) => {
                        const next = [...ai];
                        next[i] = { ...next[i], priority: ev.target.value as BrainTaskPriority };
                        onActionItemsChange(next);
                      }}
                      className="rounded border border-border bg-background px-1 py-0.5 uppercase"
                    >
                      <option value="high">high</option>
                      <option value="medium">medium</option>
                      <option value="low">low</option>
                    </select>
                  </div>
                </div>
              ))}
              <button
                onClick={() =>
                  onActionItemsChange([...ai, { text: "", owner: "", dueDate: null, priority: "medium" }])
                }
                className="text-xs text-primary transition hover:opacity-80"
              >
                + 添加行动项
              </button>
            </div>
          ) : (
            <ul className="space-y-1">
              {ai.map((a, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs"
                >
                  <span className="text-foreground">{a.text}</span>
                  {a.owner && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">{a.owner}</span>}
                  {a.dueDate && <span className="text-muted-foreground">{a.dueDate}</span>}
                  <span className="uppercase text-muted-foreground">{a.priority}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 策略规划建议（meeting） */}
      {(d.strategy?.length || 0) > 0 && (
        <div>
          {sectionTitle("策略规划建议")}
          <div className="space-y-1.5">
            {(d.strategy ?? []).map((s, i) => (
              <div key={i} className="rounded-md border border-border bg-muted/40 px-2 py-1.5">
                <div className="text-xs font-semibold text-foreground">{s.angle}</div>
                <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.logic}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 待决策 / 风险 */}
      {(d.openQuestions?.length || 0) > 0 && (
        <div>
          {sectionTitle("待决策 / 风险")}
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
            {(d.openQuestions ?? []).map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// 问答检索模式：仅本地 / 仅 ima / 混合
type AskMode = "local" | "ima" | "mixed";
// 问答回答下方的来源引用标注
interface AskSourceItem {
  noteId: string;
  title: string;
  source: "local" | "ima";
  sourceName?: string;
  relevance?: number;
}
const ASK_MODE_LABEL: { value: AskMode; label: string; hint: string }[] = [
  { value: "local", label: "🏠 本地", hint: "仅检索你自己的笔记" },
  { value: "ima", label: "☁️ ima", hint: "仅实时检索你的 ima 知识库" },
  { value: "mixed", label: "🔀 混合", hint: "本地笔记 + ima 合并检索（默认）" },
];

// 冷静的蓝青灰分类色（仅作为内容识别用，主色跟随系统主题）
const CATEGORY_COLORS: Record<string, string> = {
  工作: "#2563eb",
  学习: "#0ea5e9",
  技术: "#0891b2",
  设计: "#6366f1",
  生活: "#059669",
  灵感: "#8b5cf6",
  随手记: "#94a3b8",
};

const CATEGORY_OPTIONS = ["工作", "学习", "技术", "设计", "生活", "灵感", "随手记"];

function catColor(cat: string): string {
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

function langColor(lang: string | null): string {
  if (!lang) return "#94a3b8";
  return LANG_COLOR[lang.toLowerCase()] ?? "#64748b";
}

function langLabel(lang: string | null): string {
  if (!lang) return "";
  const l = lang.toLowerCase();
  const map: Record<string, string> = {
    javascript: "JS", js: "JS", typescript: "TS", ts: "TS",
    python: "Python", sql: "SQL", shell: "Shell", bash: "Shell", text: "Text",
  };
  return map[l] ?? l;
}

/** 把代码片段预览截断为前 N 行 */
function snippetPreview(code: string, lines = 5): string {
  if (!code) return "";
  const arr = code.split("\n");
  return arr.slice(0, lines).join("\n");
}

/** 极简语法高亮：把代码转成 React 节点（字符串/注释/关键词/函数/数字） */
function highlightCode(code: string): ReactNode {
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

const STATUS_LABEL: Record<BrainTaskStatus, string> = { todo: "待办", in_progress: "进行中", done: "已完成" };
const STATUS_NEXT: Record<BrainTaskStatus, BrainTaskStatus> = { todo: "in_progress", in_progress: "done", done: "todo" };
const PRIORITY_RANK: Record<BrainTaskPriority, number> = { high: 0, medium: 1, low: 2 };
const PRIORITY_COLOR: Record<BrainTaskPriority, string> = { high: "#ef4444", medium: "#f59e0b", low: "#9ca3af" };

// 策略状态
const STRATEGY_LABEL: Record<BrainStrategyStatus, string> = {
  active: "活跃",
  paused: "暂停",
  achieved: "已达成",
  abandoned: "已放弃",
};
const STRATEGY_NEXT: Record<BrainStrategyStatus, BrainStrategyStatus> = {
  active: "paused",
  paused: "achieved",
  achieved: "abandoned",
  abandoned: "active",
};
const STRATEGY_COLOR: Record<BrainStrategyStatus, string> = {
  active: "#16a34a",
  paused: "#f59e0b",
  achieved: "#2563eb",
  abandoned: "#9ca3af",
};

/** 把私人笔记映射成图谱节点（"相关"弱关系） */
function asGraphEntries(notes: BrainNote[]) {
  return notes.map((n) => ({
    slug: n.id,
    name: n.title || n.content.slice(0, 8),
    type: (n.category || "随手记") as unknown as import("@/lib/knowledge-types").KnowledgeType,
    summary: n.summary,
    body: n.content,
    related: n.related,
  }));
}

const SOURCE_ICON: Record<string, string> = {
  text: "📋",
  file: "📎",
  clip: "🔗",
  voice: "🎙",
  ima: "☁️",
};

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "刚刚";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
  return new Date(ts).toLocaleDateString("zh-CN");
}

/** 今天（YYYY-MM-DD），用于判断任务是否过期 */
function nowDateStr(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatDueDate(dueDate: string): string {
  const mm = dueDate.slice(5, 7);
  const dd = dueDate.slice(8, 10);
  const yy = dueDate.slice(0, 4);
  const curYY = String(new Date().getFullYear());
  return yy === curYY ? `${Number(mm)}月${Number(dd)}日` : `${yy}-${mm}-${dd}`;
}

/** 把 ISO 下次复习时间转成"X 分钟后 / X 小时后 / 明天 / X 天后"的友好文案 */
function nextInHours(iso: string): string {
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

const inputCls =
  "w-full rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary";

export function SecondBrain({ notes: initial }: { notes: BrainNote[] }) {
  const [notes, setNotes] = useState<BrainNote[]>(initial);
  // 第二大脑 · 从用户绑定的腾讯 ima 知识库导入
  const [imaOpen, setImaOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [text, setText] = useState("");
  const [organizing, setOrganizing] = useState(false);
  // AI 整理失败标记：工作台顶部提示兜底
  const [organizeError, setOrganizeError] = useState(false);
  // 近似重复检测：整理时若与已有笔记高度相似则提示更新
  const [dupWarning, setDupWarning] = useState<{ id: string; title: string; score: number } | null>(null);
  // embedding 存量回填
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState("");
  // 工作台「概览」浮层面板开关
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  // 问答
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [askMode, setAskMode] = useState<AskMode>("mixed");
  const [qa, setQa] = useState<{ q: string; a: string; sources: AskSourceItem[] }[]>([]);
  // 编辑
  const [editing, setEditing] = useState<BrainNote | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  // 编辑态结构化草稿（打开时从 editing.struct 解析，重新整理后刷新）
  const [editStruct, setEditStruct] = useState<OrganizedDraft | null>(null);
  const [reorging, setReorging] = useState(false);
  // 编辑弹窗正文预览/编辑切换
  const [editPreview, setEditPreview] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 任务看板
  const [tasks, setTasks] = useState<BrainTask[]>([]);
  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/brain/tasks");
      const data = await res.json();
      if (res.ok && Array.isArray(data.tasks)) setTasks(data.tasks);
    } catch {
      /* 忽略 */
    }
  }, []);
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);
  // 看板：任务状态循环切换（todo → in_progress → done → todo），不使用拖拽
  const cycleTask = useCallback(async (id: string) => {
    const cur = tasks.find((t) => t.id === id);
    if (!cur) return;
    const next = STATUS_NEXT[cur.status];
    try {
      const res = await fetch(`/api/brain/tasks?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (res.ok && data?.task) {
        setTasks((prev) => prev.map((t) => (t.id === id ? data.task : t)));
      }
    } catch {
      /* 忽略 */
    }
  }, [tasks]);
  // 笔记卡片内直接勾选完成 / 取消完成
  const toggleTaskDone = useCallback(async (id: string, done: boolean) => {
    try {
      const res = await fetch(`/api/brain/tasks?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: done ? "done" : "todo" }),
      });
      const data = await res.json();
      if (res.ok && data?.task) {
        setTasks((prev) => prev.map((t) => (t.id === id ? data.task : t)));
      }
    } catch {
      /* 忽略 */
    }
  }, []);
  // noteId → 该笔记下的任务（缓存，供笔记卡片徽标与展开列表）
  const tasksByNote = useMemo(() => {
    const map = new Map<string, BrainTask[]>();
    for (const t of tasks) {
      const arr = map.get(t.noteId) ?? [];
      arr.push(t);
      map.set(t.noteId, arr);
    }
    return map;
  }, [tasks]);
  // 看板统计
  const taskCounts = useMemo(() => {
    const c: Record<BrainTaskStatus, number> = { todo: 0, in_progress: 0, done: 0 };
    for (const t of tasks) c[t.status] += 1;
    return c;
  }, [tasks]);
  const overdueTasks = useMemo(
    () => tasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate < nowDateStr()),
    [tasks],
  );
  // 间隔复习提醒
  interface DueReview {
    id: string;
    noteId: string;
    nextReviewAt: string;
    interval: number;
    easeFactor: number;
    reviewCount: number;
    noteTitle: string;
    noteCategory: string;
  }
  const [dueReviews, setDueReviews] = useState<DueReview[]>([]);
  const [nextReview, setNextReview] = useState<{ noteTitle: string; nextReviewAt: string } | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const loadReviews = useCallback(async () => {
    try {
      const res = await fetch("/api/brain/reviews");
      const data = await res.json();
      if (res.ok && Array.isArray(data.due)) {
        setDueReviews(data.due);
        setNextReview(data.next ?? null);
      }
    } catch {
      /* 忽略 */
    }
  }, []);
  useEffect(() => {
    loadReviews();
  }, [loadReviews]);
  const doReview = useCallback(async (id: string, action: "complete" | "skip") => {
    setReviewingId(id);
    try {
      const res = await fetch(`/api/brain/reviews?id=${id}&action=${action}`, { method: "POST" });
      if (res.ok) {
        await loadReviews();
        loadTasks(); // 归档 done 任务后刷新看板
      }
    } catch {
      /* 忽略 */
    } finally {
      setReviewingId(null);
    }
  }, [loadReviews, loadTasks]);
  // 策略管理
  const [strategies, setStrategies] = useState<BrainStrategy[]>([]);
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);
  // 看板策略筛选："all" 全部，"group" 按策略分组展示
  const [strategyFilter, setStrategyFilter] = useState<"all" | "group" | string>("all");
  const loadStrategies = useCallback(async () => {
    try {
      const res = await fetch("/api/brain/strategies");
      const data = await res.json();
      if (res.ok && Array.isArray(data.strategies)) setStrategies(data.strategies);
    } catch {
      /* 忽略 */
    }
  }, []);
  useEffect(() => {
    loadStrategies();
  }, [loadStrategies]);

  // ---------- 代码片段 ----------
  const [snippets, setSnippets] = useState<BrainNote[]>([]);
  const [snippetLang, setSnippetLang] = useState("全部");
  const [snippetQuery, setSnippetQuery] = useState("");
  const [expandedSnippet, setExpandedSnippet] = useState<string | null>(null);
  const loadSnippets = useCallback(async () => {
    try {
      const res = await fetch("/api/brain/snippets");
      const data = await res.json();
      if (res.ok && Array.isArray(data.snippets)) setSnippets(data.snippets);
    } catch {
      /* 忽略 */
    }
  }, []);
  useEffect(() => {
    loadSnippets();
  }, [loadSnippets]);
  const snippetFiltered = useMemo(() => {
    let arr = snippets;
    if (snippetLang !== "全部") arr = arr.filter((s) => s.language?.toLowerCase() === snippetLang.toLowerCase());
    if (snippetQuery.trim()) {
      const q = snippetQuery.trim().toLowerCase();
      arr = arr.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.codeContent ?? "").toLowerCase().includes(q) ||
          s.tags.some((tg) => tg.toLowerCase().includes(q)),
      );
    }
    return arr;
  }, [snippets, snippetLang, snippetQuery]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const copyCode = useCallback(async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 1500);
    } catch {
      /* 忽略 */
    }
  }, []);

  // ---------- ima 自动增量同步（打开页面 >24h 触发后台同步） ----------
  const [imaSyncAuto, setImaSyncAuto] = useState(false);
  const [imaSyncToast, setImaSyncToast] = useState<string | null>(null);
  const refreshAll = useCallback(async () => {
    try {
      const res = await fetch("/api/brain/notes");
      const data = await res.json();
      if (res.ok && Array.isArray(data.notes)) setNotes(data.notes);
    } catch {
      /* 忽略 */
    }
    loadTasks();
    loadStrategies();
    loadSnippets();
    loadReviews();
  }, [loadTasks, loadStrategies, loadSnippets, loadReviews]);
  // 打开页面时：已绑定 ima 且距上次同步 >24h（从未同步过则首次即同步）→ 后台自动增量同步
  useEffect(() => {
    let cancelled = false;
    let toastTimer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      let bound = false;
      try {
        const r = await fetch("/api/account/ima");
        const d = await r.json();
        bound = Boolean(d.bound);
      } catch {
        bound = false;
      }
      if (cancelled || !bound) return;

      let needSync = false;
      try {
        const r = await fetch("/api/brain/ima/sync?action=logs");
        const d = await r.json();
        const logs: { syncedAt?: string }[] = Array.isArray(d.logs) ? d.logs : [];
        if (!logs.length) {
          needSync = true;
        } else if (logs[0]?.syncedAt) {
          if (Date.now() - new Date(logs[0].syncedAt).getTime() > 24 * 3600_000) needSync = true;
        }
      } catch {
        needSync = false;
      }
      if (cancelled || !needSync) return;

      setImaSyncAuto(true);
      try {
        const res = await fetch("/api/brain/ima/sync", { method: "POST" });
        const d = await res.json();
        if (res.ok && d?.result) {
          setImaSyncToast(
            `自动同步：新建 ${d.result.created} · 更新 ${d.result.updated} · 跳过 ${d.result.skipped}`,
          );
        }
      } catch {
        setImaSyncToast("自动同步失败，可在个人中心重试");
      }
      if (!cancelled) {
        setImaSyncAuto(false);
        refreshAll();
        toastTimer = setTimeout(() => setImaSyncToast(null), 6000);
      }
    })();
    return () => {
      cancelled = true;
      if (toastTimer) clearTimeout(toastTimer);
    };
  }, [refreshAll]);

  // 从问答来源标签跳转到本地笔记：重置过滤 + 展开卡片 + 平滑滚动定位
  const jumpToNote = useCallback((noteId: string) => {
    setSourceFilter("all");
    setListFilter("全部");
    setExpanded(noteId);
    requestAnimationFrame(() => {
      document.getElementById(`note-${noteId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  // ---------- 知识厚度统计 ----------
  const thickness = useMemo(() => {
    const allNoteIds = notes.length;
    // 有效笔记：排除已归档（superseded）版本；一条链只数顶层初版为主体
    const activeNoteIds = notes.filter((n) => !n.superseded).length;
    const rootCount = notes.filter((n) => !n.parentId).length;
    // 版本演化数：经历过升级的笔记链（存在 parentId 或 version>1）
    const versioned = notes.some((n) => n.parentId || n.version > 1)
      ? new Set(notes.filter((n) => n.parentId).map((n) => n.parentId!)).size + notes.filter((n) => !n.parentId && n.version > 1).length
      : 0;
    const snippetCount = notes.filter((n) => n.isSnippet).length;
    // 平均版本深度 ≈ 总版本 / 顶层初版数
    const avgDepth = rootCount ? Number((allNoteIds / rootCount).toFixed(1)) : 0;
    return { allNoteIds, activeNoteIds, versioned, snippetCount, avgDepth };
  }, [notes]);

  // ---------- 版本演化 ----------
  const [versionsByNote, setVersionsByNote] = useState<Record<string, BrainNote[]>>({});
  const loadVersions = useCallback(async (noteId: string) => {
    try {
      const res = await fetch(`/api/brain/notes/${noteId}/versions`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.versions)) {
        setVersionsByNote((prev) => ({ ...prev, [noteId]: data.versions }));
      }
    } catch {
      /* 忽略 */
    }
  }, []);
  const [upgradeTarget, setUpgradeTarget] = useState<BrainNote | null>(null);
  const [upgradeTitle, setUpgradeTitle] = useState("");
  const [upgradeContent, setUpgradeContent] = useState("");
  const [upgrading, setUpgrading] = useState(false);
  /** 发起升级为 v+1 新版本 */
  const doUpgrade = useCallback(async () => {
    if (!upgradeTarget || upgrading) return;
    setUpgrading(true);
    try {
      const res = await fetch(`/api/brain/notes/${upgradeTarget.id}/upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: upgradeTitle?.trim() || undefined,
          content: upgradeContent?.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.note) throw new Error(data?.error);
      setNotes((prev) => [data.note, ...prev]);
      // 归档旧版：在本组件笔记列表里同步置 superseded
      setNotes((prev) =>
        prev.map((n) =>
          n.id === upgradeTarget.id || n.parentId === upgradeTarget.parentId ? { ...n, superseded: true } : n,
        ),
      );
      if (data.versions?.length) {
        setVersionsByNote((prev) => ({ ...prev, [data.note.id]: data.versions }));
      }
      setUpgradeTarget(null);
      loadSnippets();
    } catch {
      window.alert("升级失败");
    } finally {
      setUpgrading(false);
    }
  }, [upgradeTarget, upgrading, upgradeTitle, upgradeContent, loadSnippets]);

  // strategyId → 策略（供看板标签、笔记徽标）
  const strategyMap = useMemo(() => {
    const m = new Map<string, BrainStrategy>();
    for (const s of strategies) m.set(s.id, s);
    return m;
  }, [strategies]);
  // noteId → 该笔记下策略（知识卡片生效）
  const strategiesByNote = useMemo(() => {
    const m = new Map<string, BrainStrategy[]>();
    for (const s of strategies) {
      const arr = m.get(s.noteId) ?? [];
      arr.push(s);
      m.set(s.noteId, arr);
    }
    return m;
  }, [strategies]);
  // 循环切换策略状态（活跃→暂停→已达成→已放弃）
  const cycleStrategyStatus = useCallback(async (id: string) => {
    const cur = strategies.find((s) => s.id === id);
    if (!cur) return;
    const next = STRATEGY_NEXT[cur.status];
    // 乐观更新后落库，失败回读
    setStrategies((prev) => prev.map((s) => (s.id === id ? { ...s, status: next } : s)));
    try {
      const res = await fetch(`/api/brain/strategies?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) loadStrategies();
    } catch {
      loadStrategies();
    }
  }, [strategies, loadStrategies]);
  // 策略维度聚合：strategyId(含空) → 任务数 / 已完成数
  const strategyTaskStats = useMemo(() => {
    const m = new Map<string, { total: number; done: number }>();
    for (const t of tasks) {
      const key = t.strategyId ?? "";
      const o = m.get(key) ?? { total: 0, done: 0 };
      o.total += 1;
      if (t.status === "done") o.done += 1;
      m.set(key, o);
    }
    return m;
  }, [tasks]);
  // 删除策略（关联任务 strategyId 置空，不删任务）
  const [confirmDeleteStrategy, setConfirmDeleteStrategy] = useState<string | null>(null);
  const deleteStrategy = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/brain/strategies?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setStrategies((prev) => prev.filter((s) => s.id !== id));
        loadTasks();
      }
    } catch {
      /* 忽略 */
    }
    setConfirmDeleteStrategy(null);
  }, [loadTasks]);
  // 看板过滤后的任务：全部 / 指定策略 / 分组视图单独渲染
  const boardTasks = useMemo(() => {
    if (strategyFilter === "all" || strategyFilter === "group") return tasks;
    return tasks.filter((t) => t.strategyId === strategyFilter);
  }, [tasks, strategyFilter]);
  // 按策略分组：strategyId → 任务（供「按策略分组」视图）
  const tasksByStrategyGroup = useMemo(() => {
    const groups = new Map<string, BrainTask[]>();
    const unassigned: BrainTask[] = [];
    for (const t of tasks) {
      if (t.strategyId) {
        const arr = groups.get(t.strategyId) ?? [];
        arr.push(t);
        groups.set(t.strategyId, arr);
      } else {
        unassigned.push(t);
      }
    }
    return { groups, unassigned };
  }, [tasks]);
  // 周报
  const [reporting, setReporting] = useState(false);
  const [report, setReport] = useState<{
    report?: {
      weekLabel: string;
      summary: string;
      completed: string[];
      decisions: string[];
      blockers: string[];
      next: string[];
    };
    source?: { id: string; title: string; category: string; summary: string }[];
  } | null>(null);
  const [reportError, setReportError] = useState(false);
  // 整理工作台
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [wTitle, setWTitle] = useState("");
  const [wCategory, setWCategory] = useState("随手记");
  const [wSummary, setWSummary] = useState("");
  const [wTags, setWTags] = useState<string[]>([]);
  const [wTagInput, setWTagInput] = useState("");
  const [wRelated, setWRelated] = useState<string[]>([]);
  const [wRelatedReason, setWRelatedReason] = useState("");
  // AI 从原文中识别出的待办任务（随笔记一并入库）
  const [wActionItems, setWActionItems] = useState<OrganizedDraft["actionItems"]>([]);
  // AI 拆解出的策略与会议决议（随笔记一并入库）
  const [wStrategies, setWStrategies] = useState<OrganizedDraft["strategies"]>([]);
  const [wDecisions, setWDecisions] = useState<string[]>([]);
  // 代码片段识别结果（随笔记一并入库，供高亮与复制）
  const [wSnippet, setWSnippet] = useState(false);
  const [wLanguage, setWLanguage] = useState("");
  const [wCode, setWCode] = useState("");
  // 深度重写后的规范正文（可编辑）；落库时作为 content
  const [wContent, setWContent] = useState("");
  // 规范正文预览/编辑切换
  const [wPreview, setWPreview] = useState(true);
  // 金标结构化字段：参会人 / 指标 / 问题域 / 待决策 / 策略建议
  const [wAttendees, setWAttendees] = useState<string[]>([]);
  const [wMetrics, setWMetrics] = useState<OrganizedMetric[]>([]);
  const [wProblemDomains, setWProblemDomains] = useState<OrganizedProblemDomain[]>([]);
  const [wOpenQuestions, setWOpenQuestions] = useState<string[]>([]);
  const [wStrategy, setWStrategy] = useState<OrganizedStrategy[]>([]);
  // 原始完整结构化草稿（OrganizedDraft），随笔记一并落库为 struct，刷新不丢
  const [wStruct, setWStruct] = useState<OrganizedDraft | null>(null);
  // 输入类型与 clip/jotting 专属字段
  const [wType, setWType] = useState<string>("jotting");
  const [wSource, setWSource] = useState("");
  const [wKeyPoints, setWKeyPoints] = useState<{ point: string }[]>([]);
  const [wInsights, setWInsights] = useState<string[]>([]);
  // 动态占位
  const [phIdx, setPhIdx] = useState(0);
  const PLACEHOLDERS = [
    "👋 今天有什么新想法？粘贴会议纪要、代码片段或灵感…",
    "📝 把开会聊的关键结论、待办、决定都扔进来…",
    "💻 贴一段 Python 代码或踩坑记录，我来帮你整理…",
    "🧠 突然想到的点子、要复习的易经卦象，随手记下…",
  ];
  useEffect(() => {
    const t = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length), 5000);
    return () => clearInterval(t);
  }, []);

  const generateReport = async () => {
    if (reporting) return;
    setReporting(true);
    setReportError(false);
    try {
      const res = await fetch("/api/brain/report");
      const data = await res.json();
      if (!res.ok || !data?.report) throw new Error(data?.error);
      setReport(data);
    } catch {
      setReportError(true);
    } finally {
      setReporting(false);
    }
  };

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of notes) {
      const c = n.category || "随手记";
      map.set(c, (map.get(c) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [notes]);

  // 学习路径：从学习类笔记聚类出的主题
  const learningTopics = useMemo<LearningTopic[]>(() => detectLearningTopics(notes), [notes]);
  const [openTopic, setOpenTopic] = useState<string | null>(null);

  // 列表分类过滤
  const [listFilter, setListFilter] = useState("全部");
  // 列表来源过滤（全部 / 手动 / ima）
  const [sourceFilter, setSourceFilter] = useState<"all" | "manual" | "ima">("all");
  // 大脑工作台 Tab（整理笔记 / 向我提问 / 任务看板）
  const [workTab, setWorkTab] = useState<"input" | "ask" | "kanban" | "strategies" | "snippets" | "projects">("input");
  // 最近活跃流是否全部展开
  const [activityShowAll, setActivityShowAll] = useState(false);
  // —— 第九阶段：顶层视图（首页=今日助理面板 / 工作台）+ 收件箱抽屉 ——
  const [topView, setTopView] = useState<"dashboard" | "workbench">("dashboard");
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxPending, setInboxPending] = useState(0);
  // —— 第十阶段：任务详情抽屉 + 看板多维分组 + 项目 ——
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [kanbanGroup, setKanbanGroup] = useState<"status" | "project" | "milestone" | "assignee">("status");
  const [kanbanView, setKanbanView] = useState<"board" | "gantt">("board");
  const [projects, setProjects] = useState<{ id: string; name: string; color: string }[]>([]);
  // —— 第十一阶段：每日助理点项目卡片 → 跳转项目详情 ——
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/brain/projects");
      const data = await res.json();
      if (res.ok && Array.isArray(data.projects)) {
        setProjects(data.projects.map((p: { id: string; name: string; color: string }) => ({ id: p.id, name: p.name, color: p.color })));
      }
    } catch {
      /* 忽略 */
    }
  }, []);
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);
  // 监听复习/任务变更 → 刷新面板
  useEffect(() => {
    const h = () => window.dispatchEvent(new Event("brain:data-changed"));
    window.addEventListener("brain:dashboard-refresh", h);
    return () => window.removeEventListener("brain:dashboard-refresh", h);
  }, []);
  // 顶部视图切换：切到工作台时找到对应二级 Tab，否则回整理笔记
  const gotoTop = (v: "dashboard" | "workbench", tab?: typeof workTab) => {
    if (v === "workbench" && tab) setWorkTab(tab);
    setTopView(v);
  };

  // 提醒中心跳转：/brain?tab=tasks → 任务看板；/brain?tab=reviews → 复习；/brain?note=xxx → 展开笔记
  const gotoNav = useCallback((link: string) => {
    const tabMatch = link.match(/[?&]tab=([^&]+)/);
    const noteMatch = link.match(/[?&]note=([^&]+)/);
    if (tabMatch) {
      const t = tabMatch[1];
      if (t === "tasks") gotoTop("workbench", "kanban");
      else if (t === "reviews" || t === "strategies") gotoTop("workbench", (t === "reviews" ? "input" : "strategies") as "input" | "strategies");
      else gotoTop("workbench", "input");
    } else if (noteMatch) {
      gotoTop("workbench", "input");
      jumpToNote(decodeURIComponent(noteMatch[1]));
    }
  }, [gotoTop, jumpToNote]);

  const filteredNotes = useMemo(() => {
    const bySource =
      sourceFilter === "all"
        ? notes
        : notes.filter((n) => (n.source === "ima" ? "ima" : "manual") === sourceFilter);
    return listFilter === "全部"
      ? bySource
      : bySource.filter((n) => (n.category || "随手记") === listFilter);
  }, [notes, listFilter, sourceFilter]);

  // 最近活跃流（Activity Feed）
  const activity = useMemo(() => {
    const items: { kind: string; text: string; time: string }[] = [];
    const sorted = [...notes].sort((a, b) => b.createdAt - a.createdAt);
    for (const n of sorted.slice(0, 5)) {
      items.push({
        kind: n.source || "text",
        text: `整理了「${n.title}」(${n.category || "随手记"})`,
        time: relativeTime(n.createdAt),
      });
    }
    const tagCount = learningTopics.reduce((s, t) => s + t.count, 0);
    if (tagCount) items.push({ kind: "tag", text: `新增 ${tagCount} 个学习关联标签`, time: "近一周" });
    return items.slice(0, 6);
  }, [notes, learningTopics]);

  /** 整理：打开工作台并将 AI 建议填充到可编辑表单 */
  const organize = async () => {
    const t = text.trim();
    if (!t || organizing) return;
    setOrganizing(true);
    setOrganizeError(false);
    setRaw(t);
    try {
      const res = await fetch("/api/brain/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: t }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      // 近似重复检测：与已有笔记高度相似时提示更新
      setDupWarning(data?.duplicate ?? null);
      fillDraft(data.draft);
    } catch {
      fillDraft({
        title: t.split("\n")[0].slice(0, 30),
        category: "随手记",
        summary: t.slice(0, 120),
        tags: [],
        related: [],
        relatedReason: "",
        actionItems: [],
        strategies: [],
        decisions: [],
        attendees: [],
        metrics: [],
        problemDomains: [],
        openQuestions: [],
        strategy: [],
        type: "jotting",
        source: "",
        keyPoints: [],
        insights: [],
        isMeeting: false,
        isSnippet: false,
        language: "",
        codeContent: "",
        rewritten: "",
      });
      // 整理失败可见反馈：标记顶部兜底提示
      setOrganizeError(true);
      setDupWarning(null);
    } finally {
      setOrganizing(false);
    }
  };

  /** 把草稿写入工作台表单并打开 */
  const fillDraft = (d: OrganizedDraft) => {
    setWTitle(d.title || d.summary.slice(0, 30));
    setWCategory(d.category || "随手记");
    setWSummary(d.summary);
    setWTags(d.tags ?? []);
    setWRelated(d.related ?? []);
    setWRelatedReason(d.relatedReason ?? "");
    setWActionItems(Array.isArray(d.actionItems) ? d.actionItems : []);
    setWStrategies(Array.isArray(d.strategies) ? d.strategies : []);
    setWDecisions(Array.isArray(d.decisions) ? d.decisions : []);
    setWAttendees(Array.isArray(d.attendees) ? d.attendees : []);
    setWMetrics(Array.isArray(d.metrics) ? d.metrics : []);
    setWProblemDomains(Array.isArray(d.problemDomains) ? d.problemDomains : []);
    setWOpenQuestions(Array.isArray(d.openQuestions) ? d.openQuestions : []);
    setWStrategy(Array.isArray(d.strategy) ? d.strategy : []);
    setWType(d.type || "jotting");
    setWSource(d.source ?? "");
    setWKeyPoints(Array.isArray(d.keyPoints) ? d.keyPoints : []);
    setWInsights(Array.isArray(d.insights) ? d.insights : []);
    setWSnippet(!!d.isSnippet);
    setWLanguage(d.language ?? "");
    setWCode(d.codeContent ?? "");
    // 规范正文：优先用 AI 深度重写；无则回落原始记录
    setWContent(d.rewritten || raw || "");
    // 完整结构化草稿随笔记一并落库（struct）
    setWStruct(d);
    setWorkspaceOpen(true);
  };

  const addTag = () => {
    const v = wTagInput.trim().replace(/^#/, "");
    if (v && !wTags.includes(v)) setWTags((p) => [...p, v]);
    setWTagInput("");
  };

  /** 采纳并入库 */
  const saveDraft = async () => {
    if (!raw || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/brain/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: wContent?.trim() || raw,
          title: wTitle,
          category: wCategory,
          summary: wSummary,
          tags: wTags,
          related: wRelated,
          actionItems: wActionItems.filter((a) => a.text.trim()),
          strategies: wStrategies,
          decisions: wDecisions,
          isSnippet: wSnippet,
          language: wLanguage,
          codeContent: wCode,
          // 完整结构化草稿（金标字段），落库为 struct；同步编辑过的行动项与类型字段
          struct: wStruct
            ? {
                ...wStruct,
                actionItems: wActionItems.filter((a) => a.text.trim()),
                type: wType,
                source: wSource,
                keyPoints: wKeyPoints,
                insights: wInsights,
              }
            : wStruct,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.note) throw new Error(data?.error);
      setNotes((prev) => [data.note, ...prev]);
      setText("");
      setRaw("");
      setDupWarning(null);
      setWActionItems([]);
      setWStrategies([]);
      setWDecisions([]);
      setWSnippet(false);
      setWLanguage("");
      setWCode("");
      setWContent("");
      setWAttendees([]);
      setWMetrics([]);
      setWProblemDomains([]);
      setWOpenQuestions([]);
      setWStrategy([]);
      setWType("jotting");
      setWSource("");
      setWKeyPoints([]);
      setWInsights([]);
      setWStruct(null);
      setWorkspaceOpen(false);
      loadTasks();
      loadStrategies();
      loadSnippets();
    } catch {
      window.alert("入库失败");
    } finally {
      setSaving(false);
    }
  };

  // ---------- 导出（前端 Blob 下载，零后端） ----------
  const downloadText = (name: string, text: string, type = "text/markdown;charset=utf-8") => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };
  const todayStamp = () => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  };
  const safeName = (t: string) => (t || "note").replace(/[\\/:*?"<>|]/g, "_").slice(0, 60);
  const noteToMarkdown = (n: BrainNote) =>
    [
      `# ${n.title || "未命名"}`,
      "",
      `- 分类：${n.category || "随手记"}`,
      n.summary ? `- 摘要：${n.summary}` : "",
      n.tags?.length ? `- 标签：${n.tags.join("、")}` : "",
      "",
      n.content || "",
    ]
      .filter((x) => x !== undefined && x !== "")
      .join("\n");
  const exportAllMd = () =>
    downloadText(`第二大脑-全部笔记-${todayStamp()}.md`, notes.map((n) => noteToMarkdown(n)).join("\n\n---\n\n"));
  const exportNote = (n: BrainNote) => downloadText(`${safeName(n.title)}.md`, noteToMarkdown(n));

  // ---------- embedding 存量回填 ----------
  const runBackfill = async () => {
    if (backfilling) return;
    setBackfilling(true);
    setBackfillMsg("");
    try {
      const res = await fetch("/api/brain/embedding/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 20 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      setBackfillMsg(
        `已补 ${data.processed} 条${data.remaining > 0 ? `，还剩 ${data.remaining} 条可再点` : "，全部补齐"}`,
      );
    } catch {
      setBackfillMsg("回填失败（本地向量模型不可用？）");
    } finally {
      setBackfilling(false);
    }
  };

  // ---------- 本周行动项聚合（周报深化：来自 struct.actionItems） ----------
  const weekActionItems = useMemo(() => {
    const d = new Date();
    const day = (d.getDay() + 6) % 7;
    const ws = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day).getTime();
    const out: { text: string; owner?: string; dueDate?: string; noteTitle: string }[] = [];
    const seen = new Set<string>();
    for (const n of notes) {
      if (n.createdAt < ws || !n.struct) continue;
      try {
        const s = JSON.parse(n.struct) as OrganizedDraft;
        for (const a of s.actionItems ?? []) {
          const t = a.text.trim();
          if (!t || seen.has(t)) continue;
          seen.add(t);
          out.push({ text: t, owner: a.owner || undefined, dueDate: a.dueDate || undefined, noteTitle: n.title || "未命名" });
        }
      } catch {
        /* 结构损坏忽略 */
      }
    }
    return out
      .sort((a, b) => (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99"))
      .slice(0, 12);
  }, [notes]);

  const ask = async () => {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    try {
      const res = await fetch("/api/brain/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, mode: askMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      const sources: AskSourceItem[] = Array.isArray(data.sources) ? data.sources : [];
      setQa((prev) => [...prev, { q, a: data.answer, sources }]);
      setQuestion("");
    } catch {
      setQa((prev) => [...prev, { q, a: "问答失败，请稍后重试。", sources: [] }]);
      setQuestion("");
    } finally {
      setAsking(false);
    }
  };

  const startEdit = (n: BrainNote) => {
    setEditing(n);
    setEditTitle(n.title);
    setEditContent(n.content);
    try {
      setEditStruct(n.struct ? (JSON.parse(n.struct) as OrganizedDraft) : null);
    } catch {
      setEditStruct(null);
    }
  };

  /** 存量笔记一键重新整理：跑 organizer 刷新标题/正文/结构化字段 */
  const reorganizeExisting = async () => {
    if (!editing || reorging) return;
    setReorging(true);
    try {
      const res = await fetch("/api/brain/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      const data = await res.json();
      if (!res.ok || !data?.draft) throw new Error(data?.error);
      const d = data.draft as OrganizedDraft;
      setEditTitle(d.title || editTitle);
      setEditContent(d.rewritten || editContent);
      setEditStruct(d);
    } catch {
      window.alert("重新整理失败，请稍后重试");
    } finally {
      setReorging(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/brain/notes?id=${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          content: editContent,
          // 重新整理后的结构化草稿随保存落库
          struct: editStruct ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.note) throw new Error(data?.error);
      setNotes((prev) => prev.map((n) => (n.id === data.note.id ? data.note : n)));
      setEditing(null);
    } catch {
      window.alert("保存失败");
    } finally {
      setLoading(false);
    }
  };

  const requestDelete = (id: string) => {
    setConfirmDelete(id);
    if (deleteTimer.current) clearTimeout(deleteTimer.current);
    deleteTimer.current = setTimeout(() => setConfirmDelete(null), 2500);
  };

  const doDelete = async (id: string) => {
    const res = await fetch(`/api/brain/notes?id=${id}`, { method: "DELETE" });
    if (res.ok) setNotes((prev) => prev.filter((n) => n.id !== id));
    setConfirmDelete(null);
  };

  const graphEntries = useMemo(() => asGraphEntries(notes), [notes]);
  const centerEntry = useMemo(() => {
    if (!expanded) return undefined;
    const a = asGraphEntries(notes);
    return a.find((x) => x.slug === expanded);
  }, [expanded, notes]);

  return (
    <div style={{ background: "#F9FAFB", minHeight: "100vh" }}>
      {/* 收件箱抽屉（右侧滑出） */}
      <InboxDrawer
        open={inboxOpen}
        onClose={() => setInboxOpen(false)}
        onPendingChange={setInboxPending}
      />
      {/* 任务详情抽屉（右侧滑出） */}
      <TaskDetailDrawer
        taskId={detailTaskId}
        onClose={() => setDetailTaskId(null)}
        onChanged={loadTasks}
      />
      {/* ima 自动同步提示（打开页面后台触发时展示） */}
      {imaSyncAuto && (
        <div className="fixed left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-lg">
          <Loader2 className="size-3.5 animate-spin" /> 正在自动同步 ima 知识库…
        </div>
      )}
      {imaSyncToast && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full border border-emerald-600/20 bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-lg">
          {imaSyncToast}
        </div>
      )}
      <div className="mx-auto max-w-7xl px-4 py-8">
        {imaOpen && (
          <ImaImportModal
            onClose={() => setImaOpen(false)}
            onImported={(n) => {
              setNotes((prev) => [n, ...prev] as BrainNote[]);
              setImaOpen(false);
            }}
          />
        )}
        {batchOpen && (
          <BatchImportModal
            onClose={() => setBatchOpen(false)}
            onImported={(notes) => {
              setNotes((prev) => [...notes, ...prev]);
              loadTasks();
              loadStrategies();
              loadSnippets();
            }}
          />
        )}
        {/* 头部（精简） */}
        <div className="mb-4 flex items-baseline gap-3 border-b border-border/70 pb-4">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Brain className="size-5" />
            </span>
            第二大脑
          </h1>
          <span className="text-sm text-muted-foreground">AI 驱动的个人知识中枢</span>
          {/* 问号提示 */}
          <span className="group relative ml-auto">
            <button
              className="flex size-6 items-center justify-center rounded-full border border-border text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
              aria-label="了解更多"
            >
              ?
            </button>
            <span className="pointer-events-none absolute right-0 top-8 z-30 w-64 rounded-xl border border-border bg-popover p-3 text-xs leading-relaxed text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              只管往里扔，AI 帮你理清楚、记得住、用得上。粘贴会议纪要、学习笔记或临时想法，
              自动分类、摘要、打标签、找关联；之后可基于你自己的全部笔记提问。
            </span>
          </span>
        </div>

        {/* 顶部导航：首页（默认）/ 知识沉淀 / 任务看板 / 策略 / 代码片段 + 收件箱 */}
        <div className="mb-5 flex flex-wrap items-center gap-1 rounded-xl border border-border bg-white px-2 py-1.5 shadow-sm">
          {[
            { v: "dashboard" as const, label: "🏠 首页" },
            { v: "input" as const, label: "📝 记一笔" },
            { v: "ask" as const, label: "💬 向我提问" },
            { v: "kanban" as const, label: "📋 任务看板" },
            { v: "projects" as const, label: "📁 项目" },
            { v: "strategies" as const, label: "🎯 策略" },
            { v: "snippets" as const, label: "💻 代码片段" },
          ].map((i) => {
            const active = topView === "dashboard" ? i.v === "dashboard" : i.v === workTab;
            return (
              <button
                key={i.v}
                onClick={() => gotoTop(i.v === "dashboard" ? "dashboard" : "workbench", i.v as typeof workTab)}
                className={
                  "rounded-lg px-3 py-1.5 text-[13px] font-medium transition " +
                  (active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")
                }
              >
                {i.label}
                {i.v === "kanban" && taskCounts.todo + taskCounts.in_progress > 0 && (
                  <span className="ml-1 rounded-full bg-primary px-1.5 py-px text-[10px] font-semibold text-primary-foreground">
                    {taskCounts.todo + taskCounts.in_progress}
                  </span>
                )}
                {i.v === "strategies" && strategies.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary px-1.5 py-px text-[10px] font-semibold text-primary-foreground">
                    {strategies.length}
                  </span>
                )}
                {i.v === "snippets" && snippetFiltered.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary px-1.5 py-px text-[10px] font-semibold text-primary-foreground">
                    {snippetFiltered.length}
                  </span>
                )}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            {topView !== "dashboard" && (
              <button
                onClick={() => setOverviewOpen((v) => !v)}
                className={
                  "relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition " +
                  (overviewOpen ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")
                }
              >
                概览
                {overviewOpen && <span className="size-1.5 rounded-full bg-primary" />}
              </button>
            )}
            <ReminderCenter onNavigate={gotoNav} />
            <button
              onClick={() => setInboxOpen(true)}
              className="relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Inbox className="size-4" />
              收件箱
              {inboxPending > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {inboxPending > 99 ? "99+" : inboxPending}
                </span>
              )}
            </button>
          </div>
        </div>

        {topView === "dashboard" ? (
          <DashboardPanel
            onOpenInbox={() => setInboxOpen(true)}
            onGoto={(tab) => gotoTop("workbench", tab as typeof workTab)}
            onNewTask={() => gotoTop("workbench", "kanban")}
            onOpenProject={(id) => {
              setOpenProjectId(id);
              gotoTop("workbench", "projects");
            }}
          />
        ) : workTab === "projects" ? (
          <ProjectPanel
            openTask={(id) => setDetailTaskId(id)}
            onTasksChanged={loadTasks}
            initialProjectId={openProjectId}
          />
        ) : (
        <div className="grid grid-cols-1 gap-6">
          {/* ============ 左列 · 工作台（全宽，概览已移至浮层） ============ */}
          <div className="space-y-6">
            {/* 大脑工作台（整理/提问 Tab 切换） */}
            <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
              {workTab === "snippets" ? (
                <div className="mt-3">
                  {/* 语言过滤 + 搜索 */}
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex items-center gap-1 rounded-[var(--radius)] border border-border bg-muted/40 p-0.5">
                      {["全部", "python", "javascript", "sql", "shell", "其他"].map((lang) => (
                        <button
                          key={lang}
                          onClick={() => setSnippetLang(lang)}
                          className={
                            "rounded-[var(--radius)] px-2 py-1 text-xs transition " +
                            (snippetLang === lang
                              ? "bg-primary text-primary-foreground font-medium"
                              : "text-muted-foreground hover:text-foreground")
                          }
                        >
                          {lang === "全部" ? "全部" : lang === "javascript" ? "JS" : lang[0].toUpperCase() + lang.slice(1)}
                        </button>
                      ))}
                    </div>
                    <div className="relative ml-auto min-w-0 flex-1">
                      <input
                        value={snippetQuery}
                        onChange={(ev) => setSnippetQuery(ev.target.value)}
                        placeholder="搜索代码 / 标题 / 标签…"
                        className={inputCls + " w-full text-xs"}
                      />
                    </div>
                  </div>

                  {snippetFiltered.length === 0 ? (
                    <div className="rounded-[var(--radius)] border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
                      没有代码片段。在「整理笔记」里粘贴一段代码，AI 会自动识别并分类保存。
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {snippetFiltered.map((s) => {
                        const open = expandedSnippet === s.id;
                        return (
                          <div
                            key={s.id}
                            className="group rounded-[var(--radius)] border border-border bg-card p-3 shadow-sm transition hover:border-primary/30"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                                style={{ background: langColor(s.language) }}
                              >
                                {langLabel(s.language)}
                              </span>
                              <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{s.title}</h3>
                              {s.codeContent && (
                                <button
                                  className="shrink-0 rounded-[var(--radius)] border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                                  onClick={() => copyCode(s.codeContent!, s.id)}
                                  title="复制"
                                >
                                  {copiedCode === s.id ? "✓ 已复制" : "📋 复制"}
                                </button>
                              )}
                            </div>
                            <pre
                              className={
                                "mt-2 cursor-pointer overflow-auto rounded-md bg-[#0f172a] px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-200 " +
                                (open ? "max-h-80" : "max-h-16")
                              }
                              onClick={() => setExpandedSnippet(open ? null : s.id)}
                            >
                              <code>{highlightCode(open ? s.codeContent ?? "" : snippetPreview(s.codeContent ?? "", 3))}</code>
                            </pre>
                            {s.tags.length > 0 && (
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                {s.tags.slice(0, 3).map((t) => (
                                  <span key={t} className="rounded-[var(--radius)] bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                    #{t}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <span className="ml-auto">{relativeTime(s.createdAt)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : workTab === "strategies" ? (
                <div className="mt-3">
                  {strategies.length === 0 ? (
                    <div className="rounded-[var(--radius)] border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
                      还没有策略。在「整理笔记」里投入一份会议纪要，AI 会自动拆解出长期策略与任务。
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {strategies.map((s) => {
                        const open = expandedStrategy === s.id;
                        const stats = strategyTaskStats.get(s.id) ?? { total: 0, done: 0 };
                        const sTasks = tasks.filter((t) => t.strategyId === s.id);
                        return (
                          <div key={s.id} className="rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm">
                            <div className="flex items-center gap-2">
                              <button
                                className="min-w-0 flex-1 text-left"
                                onClick={() => setExpandedStrategy(open ? null : s.id)}
                              >
                                <div className="flex items-center gap-2">
                                  <h3 className="truncate text-sm font-medium text-foreground">{s.title}</h3>
                                  <span
                                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                                    style={{ background: STRATEGY_COLOR[s.status] }}
                                  >
                                    {STRATEGY_LABEL[s.status]}
                                  </span>
                                </div>
                              </button>
                              <div className="flex shrink-0 items-center gap-1">
                                <span className="text-[11px] text-muted-foreground">
                                  📋 {stats.total} 个任务 · {stats.done} 已完成
                                </span>
                              </div>
                            </div>
                            <div className="mt-1.5 flex items-start justify-between gap-2">
                              <p className="line-clamp-2 min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
                                {s.description || "暂无描述"}
                              </p>
                              <div className="flex shrink-0 items-center gap-0.5">
                                <button
                                  onClick={() => cycleStrategyStatus(s.id)}
                                  title={`切换为 ${STRATEGY_LABEL[STRATEGY_NEXT[s.status]]}`}
                                  className="rounded-[var(--radius)] p-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                                >
                                  <RotateCcw className="size-3.5" />
                                </button>
                                <button
                                  onClick={() =>
                                    confirmDeleteStrategy === s.id
                                      ? deleteStrategy(s.id)
                                      : setConfirmDeleteStrategy(s.id)
                                  }
                                  title={confirmDeleteStrategy === s.id ? "确认删除" : "删除策略"}
                                  className={
                                    "rounded-[var(--radius)] p-1.5 transition " +
                                    (confirmDeleteStrategy === s.id
                                      ? "bg-destructive/10 text-destructive"
                                      : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive")
                                  }
                                >
                                  {confirmDeleteStrategy === s.id ? <Check className="size-3.5" /> : <Trash2 className="size-3.5" />}
                                </button>
                              </div>
                            </div>
                            {open && (
                              <div className="mt-3 border-t border-border/70 pt-2.5">
                                <div className="mb-1.5 text-[11px] font-semibold text-foreground">
                                  关联任务（{sTasks.length}）
                                </div>
                                {sTasks.length === 0 && (
                                  <div className="text-[11px] text-muted-foreground">暂无关联任务</div>
                                )}
                                <ul className="space-y-1">
                                  {sTasks.map((tk) => (
                                    <li key={tk.id} className="flex items-center gap-2 text-xs">
                                      <span
                                        className={
                                          "inline-block size-1.5 shrink-0 rounded-full " +
                                          (tk.status === "done" ? "bg-primary" : "bg-muted-foreground/50")
                                        }
                                      />
                                      <span className={tk.status === "done" ? "text-muted-foreground line-through" : "text-foreground"}>
                                        {tk.title}
                                      </span>
                                      {tk.dueDate && tk.status !== "done" && (
                                        <span
                                          className={
                                            "ml-auto text-[10px] " +
                                            (tk.dueDate < nowDateStr() ? "font-medium text-destructive" : "text-muted-foreground")
                                          }
                                        >
                                          {formatDueDate(tk.dueDate)}
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : workTab === "kanban" ? (
                <div className="mt-3">
                  {/* 看板 / 甘特图 视图切换 */}
                  <div className="mb-3 flex items-center gap-1">
                    {[
                      { k: "board" as const, label: "📋 看板" },
                      { k: "gantt" as const, label: "📊 甘特图" },
                    ].map((v) => (
                      <button
                        key={v.k}
                        onClick={() => setKanbanView(v.k)}
                        className={"rounded-md px-2.5 py-1 text-[11px] font-medium transition " +
                          (kanbanView === v.k ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>

                  {kanbanView === "gantt" ? (
                    <GanttView
                      openTask={(id) => setDetailTaskId(id)}
                      onChanged={() => { loadTasks(); loadProjects(); }}
                    />
                  ) : (
                  <>
                  {/* 多维分组切换：状态 / 项目 / 里程碑 / 负责人 */}
                  <div className="mb-3 flex flex-wrap items-center gap-1">
                    {[
                      { k: "status" as const, label: "按状态" },
                      { k: "project" as const, label: "按项目" },
                      { k: "milestone" as const, label: "按里程碑" },
                      { k: "assignee" as const, label: "按负责人" },
                    ].map((g) => (
                      <button
                        key={g.k}
                        onClick={() => setKanbanGroup(g.k)}
                        className={"rounded-md px-2.5 py-1 text-[11px] font-medium transition " +
                          (kanbanGroup === g.k ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>

                  {kanbanGroup !== "status" ? (
                    <GroupedBoard
                      groupBy={kanbanGroup}
                      tasks={tasks
                        .filter((t) => !t.parentTaskId)
                        .map((t) => ({ id: t.id, title: t.title, status: t.status, dueDate: t.dueDate, priority: t.priority, projectId: t.projectId, milestone: t.milestone, assignee: t.assignee }))}
                      projects={projects}
                      openTask={(id) => setDetailTaskId(id)}
                      onCycle={cycleTask}
                    />
                  ) : (
                  <>  
                  {/* 策略筛选下拉：全部 / 按策略分组 / 指定策略 */}
                  {strategies.length > 0 && (
                    <div className="mb-3 flex items-center gap-1.5">
                      <select
                        value={strategyFilter}
                        onChange={(ev) => setStrategyFilter(ev.target.value)}
                        className={inputCls + " w-auto text-xs"}
                      >
                        <option value="all">全部任务</option>
                        <option value="group">按策略分组</option>
                        {strategies.map((s) => (
                          <option key={s.id} value={s.id}>{s.title}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {strategyFilter === "group" && strategies.length > 0 ? (
                    <div className="space-y-3">
                      {[...tasksByStrategyGroup.groups.entries()].map(([sid, st]) => {
                        const s = strategyMap.get(sid);
                        const grouped = st.filter((t) => t.status !== "done").length;
                        const doneCount = st.length - grouped;
                        return (
                          <div key={sid} className="rounded-[var(--radius)] border border-border bg-card p-3">
                            <div className="mb-2 flex items-center gap-2">
                              <span
                                className="inline-block size-1.5 rounded-full"
                                style={{ background: s ? STRATEGY_COLOR[s.status] : "#94a3b8" }}
                              />
                              <span className="text-xs font-semibold text-foreground">{s?.title ?? "未知策略"}</span>
                              <span className="ml-auto text-[10px] text-muted-foreground">
                                {grouped} 待办 · {doneCount} 已完成
                              </span>
                            </div>
                            <div className="space-y-2">
                              {st.length === 0 && (
                                <div className="rounded-[var(--radius)] border border-dashed border-border/60 py-4 text-center text-[11px] text-muted-foreground">
                                  暂无任务
                                </div>
                              )}
                              {st.map((t) => (
                                <TaskCard
                                  key={t.id}
                                  task={t}
                                  note={notes.find((n) => n.id === t.noteId)}
                                  strategyName={s?.title}
                                  onCycle={() => cycleTask(t.id)}
                                  onOpen={() => setDetailTaskId(t.id)}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {tasksByStrategyGroup.unassigned.length > 0 && (
                        <div className="rounded-[var(--radius)] border border-dashed border-border/60 bg-muted/20 p-3">
                          <div className="mb-2 text-xs font-semibold text-muted-foreground">未关联策略</div>
                          <div className="space-y-2">
                            {tasksByStrategyGroup.unassigned.map((t) => (
                              <TaskCard
                                key={t.id}
                                task={t}
                                note={notes.find((n) => n.id === t.noteId)}
                                onCycle={() => cycleTask(t.id)}
                                onOpen={() => setDetailTaskId(t.id)}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {(["todo", "in_progress", "done"] as BrainTaskStatus[]).map((st) => {
                        const col = boardTasks
                          .filter((t) => t.status === st)
                          .sort(
                            (a, b) =>
                              PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
                              a.createdAt - b.createdAt,
                          );
                        return (
                          <div key={st} className="rounded-[var(--radius)] border border-border bg-muted/20 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-xs font-semibold text-foreground">{STATUS_LABEL[st]}</span>
                              <span className="rounded-full bg-card px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                                {col.length}
                              </span>
                            </div>
                            <div className="space-y-2">
                              {col.length === 0 && (
                                <div className="rounded-[var(--radius)] border border-dashed border-border/60 py-5 text-center text-[11px] text-muted-foreground">
                                  暂无
                                </div>
                              )}
                              {col.map((t) => (
                                <TaskCard
                                  key={t.id}
                                  task={t}
                                  note={notes.find((n) => n.id === t.noteId)}
                                  strategyName={strategyMap.get(t.strategyId ?? "")?.title}
                                  onCycle={() => cycleTask(t.id)}
                                  onOpen={() => setDetailTaskId(t.id)}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {overdueTasks.length > 0 && (
                    <div className="mt-3 rounded-[var(--radius)] border border-dashed border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                      ⚠️ {overdueTasks.length} 项任务已过截止日，建议尽快处理
                    </div>
                  )}
                  {tasks.length === 0 && (
                    <div className="mt-4 rounded-[var(--radius)] border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
                      还提取不到任务。在「整理笔记」里投入含待办内容的对话或想法，AI 会自动识别出任务。
                    </div>
                  )}
                  </>
                  )}
                  </>
                  )}
                </div>
              ) : workTab === "input" ? (
                <div className="mt-3">
                  <div className="flex items-center justify-end">
                    <span className="text-xs text-muted-foreground">⌘ / Ctrl + Enter 立即整理</span>
                  </div>
                  <textarea
                    value={text}
                    onChange={(ev) => {
                      setText(ev.target.value);
                      ev.target.style.height = "auto";
                      ev.target.style.height = `min(${Math.max(ev.target.scrollHeight, 120)}px, 300px)`;
                    }}
                    onKeyDown={(ev) => {
                      if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") organize();
                    }}
                    placeholder={PLACEHOLDERS[phIdx]}
                    className="mt-2 max-h-[300px] min-h-[120px] w-full resize-y rounded-[var(--radius)] border border-muted bg-card px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_12%,transparent)]"
                  />
                  <div className="mt-3 flex items-center gap-2 rounded-[var(--radius)] border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <FileUp className="size-3.5 shrink-0" />
                    支持拖入 PDF / Word / 音频文件，自动转成可整理文本
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setBatchOpen(true)}>
                      <FileUp className="size-3.5" />
                      批量导入
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setText(""); setRaw(""); }}
                      disabled={!text.trim()}
                    >
                      清空
                    </Button>
                    <Button size="sm" onClick={organize} disabled={!text.trim() || organizing}>
                      {organizing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                      {organizing ? "AI 整理中…" : "帮我整理"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  {qa.map((item, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="text-sm font-medium text-foreground">{item.q}</div>
                      <div className="whitespace-pre-wrap rounded-[var(--radius)] bg-muted/60 p-3 text-sm leading-relaxed text-foreground">
                        {item.a}
                      </div>
                      {item.sources.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-muted-foreground">引用来源：</span>
                          {item.sources.map((s, si) =>
                            s.source === "ima" ? (
                              <span
                                key={si}
                                className="inline-flex max-w-full items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-600"
                                title={s.relevance != null ? `相关度 ${Math.round(s.relevance * 100)}%` : undefined}
                              >
                                <span className="truncate">{s.title}</span>
                                <span className="shrink-0">· ima{s.sourceName ? " · " + s.sourceName : ""}</span>
                              </span>
                            ) : (
                              <button
                                key={si}
                                type="button"
                                onClick={() => jumpToNote(s.noteId)}
                                title={
                                  (s.relevance != null ? `相关度 ${Math.round(s.relevance * 100)}%，点击定位到笔记` : "点击定位到笔记")
                                }
                                className="inline-flex max-w-full cursor-pointer items-center gap-1 rounded-full bg-muted/70 px-2 py-0.5 text-[11px] text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                              >
                                <span className="truncate">{s.title}</span>
                                <span className="shrink-0">· 本地</span>
                              </button>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {asking && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />
                      AI 正在翻你的笔记…
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="flex shrink-0 overflow-hidden rounded-md border border-border text-xs">
                      {ASK_MODE_LABEL.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setAskMode(m.value)}
                          title={m.hint}
                          className={
                            "px-2 py-1.5 transition " +
                            (askMode === m.value
                              ? "bg-primary font-medium text-primary-foreground"
                              : "bg-white text-muted-foreground hover:text-foreground")
                          }
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <div className="relative flex-1">
                      <input
                        value={question}
                        onChange={(ev) => setQuestion(ev.target.value)}
                        onKeyDown={(ev) => ev.key === "Enter" && ask()}
                        placeholder="例如：上次会议里关于用户增长的结论是什么？"
                        className={inputCls}
                      />
                    </div>
                    <Button onClick={ask} disabled={!question.trim() || asking} className="shrink-0">
                      提问
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* 笔记列表 · 高密度 */}
            <div className="rounded-xl border border-border bg-white shadow-sm">
              <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
                <h2 className="text-sm font-semibold text-foreground">知识沉淀</h2>
                <span className="text-xs text-muted-foreground">{filteredNotes.length}/{notes.length}</span>
                {/* 来源过滤：全部 / 手动 / ima */}
                <div className="flex overflow-hidden rounded-md border border-border text-xs">
                  {[
                    { v: "all" as const, label: "全部" },
                    { v: "manual" as const, label: "手动" },
                    { v: "ima" as const, label: "☁️ ima" },
                  ].map((s) => (
                    <button
                      key={s.v}
                      onClick={() => setSourceFilter(s.v)}
                      className={
                        "px-2 py-1 transition " +
                        (sourceFilter === s.v
                          ? "bg-primary font-medium text-primary-foreground"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted")
                      }
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {/* 导出 / 向量回填 */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={exportAllMd}
                    className="rounded-[var(--radius)] border border-border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    title="导出全部笔记为 Markdown"
                  >
                    导出全部
                  </button>
                  <button
                    onClick={runBackfill}
                    disabled={backfilling}
                    className="rounded-[var(--radius)] border border-border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    title="为没有向量的历史笔记补算检索向量（本地模型，零费用）"
                  >
                    {backfilling ? "回填中…" : "回填向量"}
                  </button>
                  {backfillMsg && <span className="text-[10px] text-muted-foreground">{backfillMsg}</span>}
                </div>
                <div className="ml-auto flex flex-wrap gap-1">
                  {["全部", ...categories.map(([c]) => c)].map((c) => (
                    <button
                      key={c}
                      onClick={() => setListFilter(c)}
                      className={
                        "rounded-[var(--radius)] px-2.5 py-1 text-xs transition " +
                        (listFilter === c
                          ? "bg-primary font-medium text-primary-foreground"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted")
                      }
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-5 pb-5 pt-3">
                {filteredNotes.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    {listFilter !== "全部" ? "这个分类还没有笔记。" : "还没有笔记，先在「整理笔记」里扔一段进来。"}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-2">
                    {filteredNotes.map((n) => (
                      <NoteCard
                        key={n.id}
                        note={n}
                        tasks={tasksByNote.get(n.id) ?? []}
                        strategies={strategiesByNote.get(n.id) ?? []}
                        versions={versionsByNote[n.id] ?? []}
                        expanded={expanded === n.id}
                        confirmDelete={confirmDelete === n.id}
                        onToggle={() => {
                          const next = expanded === n.id ? null : n.id;
                          setExpanded(next);
                          if (next) loadVersions(n.id);
                        }}
                        onEdit={() => startEdit(n)}
                        onDeletePress={() =>
                          confirmDelete === n.id ? doDelete(n.id) : requestDelete(n.id)
                        }
                        onToggleTask={(id, done) => toggleTaskDone(id, done)}
                        onUpgrade={() => {
                          setUpgradeTarget(n);
                          setUpgradeTitle(n.title);
                          setUpgradeContent(n.content);
                          setExpanded(null);
                        }}
                        copiedCode={copiedCode}
                        onCopyCode={copyCode}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ============ 右列 · 概览（浮层面板：不占布局宽度，可开关） ============ */}
          {overviewOpen && (
            <div className="fixed right-4 top-20 z-40 flex max-h-[80vh] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <span className="text-sm font-semibold text-foreground">概览</span>
                <button
                  onClick={() => setOverviewOpen(false)}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="关闭概览面板"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="flex-1 space-y-6 overflow-y-auto p-4">
            {/* 知识厚度 */}
            <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Brain className="size-3.5" />
                </span>
                知识厚度
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
                <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                  <div className="text-xl font-semibold leading-none text-foreground">{thickness.activeNoteIds}</div>
                  <div className="mt-1.5 text-[11px] leading-tight text-muted-foreground">有效笔记<br/>（共 {thickness.allNoteIds} 篇）</div>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                  <div className="text-xl font-semibold leading-none text-foreground">{thickness.versioned}</div>
                  <div className="mt-1.5 text-[11px] leading-tight text-muted-foreground">版本演化<br/>笔记链数</div>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                  <div className="text-xl font-semibold leading-none text-foreground">{thickness.snippetCount}</div>
                  <div className="mt-1.5 text-[11px] leading-tight text-muted-foreground">代码片段<br/>已沉淀</div>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                  <div className="text-xl font-semibold leading-none text-foreground">{thickness.avgDepth}</div>
                  <div className="mt-1.5 text-[11px] leading-tight text-muted-foreground">平均版本深度<br/>×{thickness.allNoteIds} 版本</div>
                </div>
              </div>
            </div>

            {/* 最近活跃流 */}
            <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Brain className="size-3.5" />
                </span>
                最近大脑活跃
              </h2>
              <ul className="mt-3 space-y-2.5">
                {activity.length === 0 && (
                  <li className="text-xs text-muted-foreground">还没有活动，录入几条笔记试试。</li>
                )}
                {(activityShowAll ? activity : activity.slice(0, 3)).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                    <span className="mt-px shrink-0 text-[11px]">
                      {item.kind === "tag" ? "🏷" : SOURCE_ICON[item.kind] ?? "📋"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-foreground">{item.text.trim()}</span>{" "}
                      <span className="text-muted-foreground/70">{item.time}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {activity.length > 3 && (
                <button
                  onClick={() => setActivityShowAll((v) => !v)}
                  className="mt-2 text-xs font-medium text-primary transition hover:opacity-80"
                >
                  {activityShowAll ? "收起" : `查看更多（${activity.length - 3} 条）`}
                </button>
              )}
            </div>

            {/* 复习提醒（间隔复习/遗忘曲线） */}
            <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <RotateCcw className="size-3.5" />
                </span>
                <h2 className="text-sm font-semibold text-foreground">今日待复习</h2>
                {dueReviews.length > 0 && (
                  <span className="ml-auto rounded-full bg-destructive px-1.5 py-px text-[10px] font-semibold text-white">
                    {dueReviews.length}
                  </span>
                )}
              </div>

              <div className="mt-3">
                {dueReviews.length === 0 ? (
                  <p className="text-xs text-muted-foreground">✅ 今天没有需要复习的笔记</p>
                ) : (
                  <ul className="space-y-2">
                    {dueReviews.map((r) => (
                      <li key={r.id} className="rounded-[var(--radius)] border border-border/70 bg-muted/20 p-2.5">
                        <div className="truncate text-xs font-medium text-foreground">{r.noteTitle}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          第 {r.reviewCount + 1} 次复习 · 间隔 {r.interval} 天
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => doReview(r.id, "complete")}
                            disabled={reviewingId === r.id}
                          >
                            ✅ 已复习
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => doReview(r.id, "skip")}
                            disabled={reviewingId === r.id}
                          >
                            ⏭ 跳过
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-3 border-t border-border/70 pt-2 text-[11px] text-muted-foreground">
                {nextReview
                  ? `下次复习：${nextInHours(nextReview.nextReviewAt)}${nextReview.noteTitle ? ` · ${nextReview.noteTitle}` : ""}`
                  : dueReviews.length > 0
                    ? "今日已排期，复习后自动重新排期"
                    : "写入笔记后按遗忘曲线自动排期"}
              </div>
            </div>

            {/* 本周周报（独立一行，全宽） */}
              {/* 最近周报摘要 */}
            <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <CalendarClock className="size-3.5" />
                  </span>
                  本周周报
                </h2>
                <Button variant="outline" size="sm" onClick={generateReport} disabled={reporting}>
                  {reporting ? <Loader2 className="size-3 animate-spin" /> : <CalendarClock className="size-3" />}
                  {report?.report ? "重生成" : "生成"}
                </Button>
              </div>

              {reportError && <p className="mt-3 text-sm text-destructive">周报生成失败，请稍后重试。</p>}

              {report?.report ? (
                <div className="mt-3 space-y-2.5 border-t border-border pt-3">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {report.report.weekLabel}
                  </span>
                  <p className="text-sm font-medium leading-relaxed text-foreground">{report.report.summary}</p>
                  <div className="space-y-1.5">
                    {report.report.completed.slice(0, 3).map((it, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                        <span className="mt-1.5 inline-block size-1 shrink-0 rounded-full bg-primary" />
                        <span className="line-clamp-1">{it}</span>
                      </div>
                    ))}
                    {report.report.completed.length > 3 && (
                      <span className="block pt-0.5 text-[11px] text-muted-foreground/70">
                        还有 {report.report.completed.length - 3} 项…
                      </span>
                    )}
                  </div>
                  {report.source && report.source.length > 0 && (
                    <details className="group">
                      <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground transition hover:text-primary">
                        依据 {report.source.length} 条笔记
                      </summary>
                      <ul className="mt-1.5 space-y-1">
                        {report.source.map((s) => (
                          <li key={s.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="inline-block size-1.5 shrink-0 rounded-full" style={{ background: catColor(s.category) }} />
                            {s.title}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ) : (
                <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                  本周暂无工作笔记，积累 3 条后可生成周报。
                </div>
              )}
            </div>

            {/* 本周行动项（周报深化：聚合 struct.actionItems） */}
            {weekActionItems.length > 0 && (
              <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Check className="size-3.5" />
                  </span>
                  <h2 className="text-sm font-semibold text-foreground">本周行动项</h2>
                  <span className="text-[11px] text-muted-foreground">来自 AI 整理</span>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {weekActionItems.map((a, i) => (
                    <li
                      key={i}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs"
                    >
                      <span className="min-w-0 flex-1 text-foreground">{a.text}</span>
                      {a.owner && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">{a.owner}</span>}
                      {a.dueDate && <span className="text-muted-foreground">{a.dueDate}</span>}
                      <span className="max-w-28 truncate text-[10px] text-muted-foreground/70">{a.noteTitle}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 图谱（独立一行，全宽） */}
            {graphEntries.length > 0 && (
              <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Brain className="size-3.5" />
                  </span>
                  知识图谱
                </div>
                <KnowledgeGraph entries={graphEntries} center={centerEntry} height={288} />
              </div>
            )}

            {/* 学习路径 */}
            {learningTopics.length > 0 && (
              <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <GraduationCap className="size-3.5" />
                  </span>
                  <h2 className="text-sm font-semibold text-foreground">学习路径</h2>
                </div>
                <div className="space-y-3">
                  {learningTopics.map((t) => {
                    const open = openTopic === t.key;
                    return (
                      <button
                        key={t.key}
                        onClick={() => setOpenTopic(open ? null : t.key)}
                        className="w-full rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius)] text-base"
                            style={{ background: `color-mix(in srgb, ${t.color} 14%, transparent)` }}
                          >
                            {t.emoji}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-foreground">{t.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {t.count} 篇笔记 · 最近 {relativeTime(t.lastAt)}
                            </span>
                          </span>
                          <span className="text-xs font-semibold" style={{ color: t.color }}>
                            {t.count}
                          </span>
                        </div>
                        {open && (
                          <div className="mt-3 border-t border-border pt-3">
                            <div className="relative space-y-2.5 pl-4">
                              <span className="absolute bottom-1 left-1 top-1 w-px" style={{ background: `color-mix(in srgb, ${t.color} 40%, transparent)` }} />
                              {t.notes.slice(-4).map((n) => (
                                <div key={n.id} className="relative">
                                  <span className="absolute -left-[13.5px] top-1.5 size-2 rounded-full border-2 border-background" style={{ background: t.color }} />
                                  <div className="min-w-0">
                                    <div className="truncate text-xs font-medium text-foreground">{n.title}</div>
                                    {n.summary && (
                                      <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{n.summary}</div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                            {!open && t.count > 4 && (
                              <div className="mt-2 text-[11px] text-muted-foreground">还有 {t.count - 4} 篇…</div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {/* ============ 整理工作台 · 全屏模态 ============ */}
      {workspaceOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-white shadow-2xl"
          >
            {/* 顶栏 */}
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Sparkles className="size-4 text-primary" />
                AI 整理工作台
                <span className="rounded-[var(--radius)] bg-muted px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
                  采纳前可编辑
                </span>
              </div>
              <Button variant="ghost" size="sm" className="p-1" onClick={() => setWorkspaceOpen(false)} aria-label="关闭">
                <X className="size-4" />
              </Button>
            </div>

            {/* 整理失败提示 */}
            {organizeError && (
              <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-800">
                AI 整理失败，已用基础整理兜底 —— 可点左下「重新生成」重试。
              </div>
            )}

            {/* 近似重复提示 */}
            {dupWarning && (
              <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-800">
                <span className="flex-1">
                  检测到与已有笔记「{dupWarning.title}」相似（{dupWarning.score}%），建议更新该笔记避免重复积累。
                </span>
                <button
                  onClick={() => {
                    const n = notes.find((x) => x.id === dupWarning.id);
                    if (n) {
                      setWorkspaceOpen(false);
                      setDupWarning(null);
                      startEdit(n);
                    }
                  }}
                  className="rounded bg-amber-600/10 px-2 py-0.5 font-medium text-amber-900 transition hover:bg-amber-600/20"
                >
                  去更新
                </button>
                <button
                  onClick={() => setDupWarning(null)}
                  className="rounded px-1.5 py-0.5 text-amber-700 transition hover:bg-amber-600/10 hover:text-amber-900"
                >
                  忽略
                </button>
              </div>
            )}

            {/* 左右分屏 */}
            <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-2">
              {/* 左 · 原始记录（只读灰底） */}
              <div className="flex min-h-0 flex-col border-b border-border bg-muted/30 md:border-b-0 md:border-r">
                <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <FileUp className="size-3.5" />
                  原始记录 · 只读
                </div>
                <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap px-5 py-4 font-mono text-xs leading-relaxed text-muted-foreground">
                  {raw}
                </pre>
              </div>

              {/* 右 · AI 建议（可编辑表单） */}
              <div className="flex min-h-0 flex-col">
                <div className="flex items-center gap-2 border-b border-border bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-primary">
                  <Sparkles className="size-3.5" />
                  AI 建议 · 可编辑
                </div>
                <div className="min-h-0 flex-1 space-y-4 overflow-auto px-5 py-4">
                  {/* 标题 */}
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">标题</label>
                    <input
                      value={wTitle}
                      onChange={(ev) => setWTitle(ev.target.value)}
                      className={inputCls + " mt-1.5 font-medium"}
                      placeholder="给这条记录起个标题"
                    />
                  </div>

                  {/* 分类 */}
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">分类</label>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {CATEGORY_OPTIONS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setWCategory(c)}
                          className={
                            "rounded-[var(--radius)] px-2.5 py-1 text-xs transition " +
                            (wCategory === c
                              ? "font-semibold text-white"
                              : "bg-muted text-muted-foreground hover:bg-muted/70")
                          }
                          style={wCategory === c ? { background: catColor(c) } : undefined}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 标签 */}
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">标签</label>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-[var(--radius)] border border-border bg-card px-2 py-1.5">
                      {wTags.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 rounded-[var(--radius)] bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          #{t}
                          <button onClick={() => setWTags((p) => p.filter((x) => x !== t))} className="text-primary/60 hover:text-primary" aria-label={`移除 ${t}`}>
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                      <input
                        value={wTagInput}
                        onChange={(ev) => setWTagInput(ev.target.value)}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter" || ev.key === ",") {
                            ev.preventDefault();
                            addTag();
                          } else if (ev.key === "Backspace" && !wTagInput && wTags.length) {
                            setWTags((p) => p.slice(0, -1));
                          }
                        }}
                        placeholder={wTags.length ? "输入后回车添加" : "输入标签，回车添加"}
                        className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-xs text-foreground outline-none"
                      />
                    </div>
                  </div>

                  {/* 摘要 / 行动点 */}
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">摘要 / 行动点</label>
                    <textarea
                      value={wSummary}
                      onChange={(ev) => setWSummary(ev.target.value)}
                      className={inputCls + " mt-1.5 min-h-24 resize-y leading-relaxed"}
                      placeholder="结构化要点，建议一行一个关键点…"
                    />
                  </div>

                  {/* 规范正文（AI 深度重写，可编辑/预览切换） */}
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        规范正文 · AI 深度重写
                      </label>
                      <div className="flex items-center gap-1 rounded-md border border-border p-0.5 text-[10px]">
                        <button
                          onClick={() => setWPreview(false)}
                          className={
                            "rounded px-1.5 py-0.5 transition " +
                            (!wPreview ? "bg-primary text-white" : "text-muted-foreground")
                          }
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => setWPreview(true)}
                          className={
                            "rounded px-1.5 py-0.5 transition " +
                            (wPreview ? "bg-primary text-white" : "text-muted-foreground")
                          }
                        >
                          预览
                        </button>
                      </div>
                    </div>
                    {wPreview ? (
                      wContent.trim() ? (
                        <div className="mt-1.5 max-h-72 overflow-auto rounded-lg border border-border bg-muted/20 p-3">
                          <MarkdownView md={wContent} />
                        </div>
                      ) : (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          暂无重写正文（可能为代码片段或兜底整理）。
                        </p>
                      )
                    ) : (
                      <textarea
                        value={wContent}
                        onChange={(ev) => setWContent(ev.target.value)}
                        className={inputCls + " mt-1.5 min-h-40 resize-y font-mono text-xs leading-relaxed"}
                        placeholder="AI 会把杂乱原文重写成结构清晰的 Markdown 正文，你可继续微调…"
                      />
                    )}
                  </div>

                  {/* 按输入类型自适应的结构化拆解 */}
                  <StructPreview
                    d={{
                      type: wType,
                      attendees: wAttendees,
                      metrics: wMetrics,
                      problemDomains: wProblemDomains,
                      actionItems: wActionItems,
                      strategy: wStrategy,
                      openQuestions: wOpenQuestions,
                      decisions: wDecisions,
                      source: wSource,
                      keyPoints: wKeyPoints,
                      insights: wInsights,
                    }}
                    onActionItemsChange={setWActionItems}
                  />

                  {/* 关联 */}
                  {wRelated.length > 0 && (
                    <div>
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        关联笔记（{wRelated.length}）
                      </label>
                      <p className="mt-1 text-xs text-muted-foreground">{wRelatedReason || "与已有笔记相关"}</p>
                      <ul className="mt-1.5 space-y-1">
                        {wRelated.map((id) => {
                          const n = notes.find((x) => x.id === id);
                          return (
                            <li key={id} className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Check className="size-3 text-primary" />
                              {n?.title ?? id.slice(-8)}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 底栏操作 */}
            <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={organize} disabled={organizing}>
                  <RotateCcw className="size-3.5" />
                  重新生成
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setWorkspaceOpen(false)}>
                  取消
                </Button>
              </div>
              <Button size="sm" onClick={saveDraft} disabled={saving || !wTitle.trim()}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {saving ? "入库中…" : "采纳并入库"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑弹窗 */}
      {editing && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div
            className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-white shadow-2xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="font-semibold text-foreground">编辑笔记</h2>
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)} aria-label="关闭">
                <X className="size-4" />
              </Button>
            </div>
            <div className="overflow-auto p-5">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">标题</label>
              <input className={inputCls + " mt-1.5"} value={editTitle} onChange={(ev) => setEditTitle(ev.target.value)} />
              {editStruct && (
                <div className="mt-4">
                  <label className="text-xs uppercase tracking-wide text-muted-foreground">
                    AI 结构化拆解
                  </label>
                  <div className="mt-1.5">
                    <StructPreview d={editStruct} />
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">原文</label>
                <div className="flex items-center gap-1 rounded-md border border-border p-0.5 text-[10px]">
                  <button
                    onClick={() => setEditPreview(false)}
                    className={
                      "rounded px-1.5 py-0.5 transition " +
                      (!editPreview ? "bg-primary text-white" : "text-muted-foreground")
                    }
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => setEditPreview(true)}
                    className={
                      "rounded px-1.5 py-0.5 transition " +
                      (editPreview ? "bg-primary text-white" : "text-muted-foreground")
                    }
                  >
                    预览
                  </button>
                </div>
              </div>
              {editPreview ? (
                editContent.trim() ? (
                  <div className="mt-1.5 max-h-96 overflow-auto rounded-lg border border-border bg-muted/20 p-3">
                    <MarkdownView md={editContent} />
                  </div>
                ) : (
                  <p className="mt-1.5 text-xs text-muted-foreground">暂无正文。</p>
                )
              ) : (
                <textarea
                  className={inputCls + " mt-1.5 min-h-48 resize-y font-mono text-xs"}
                  value={editContent}
                  onChange={(ev) => setEditContent(ev.target.value)}
                />
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => editing && exportNote(editing)} disabled={!editing}>
                导出
              </Button>
              <Button variant="outline" size="sm" onClick={reorganizeExisting} disabled={reorging || loading}>
                {reorging ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                重新整理
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>取消</Button>
              <Button size="sm" onClick={saveEdit} disabled={loading || !editTitle.trim()}>
                {loading ? "保存中…" : "保存"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 升级为新版本弹窗 */}
      {upgradeTarget && (
        <div
          className="fixed inset-0 z-[115] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setUpgradeTarget(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-white shadow-2xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="flex items-center gap-2 font-semibold text-foreground">
                <RotateCcw className="size-4 text-primary" />
                升级为新版
                <span className="rounded-[var(--radius)] bg-primary/10 px-2 py-0.5 text-[11px] font-normal text-primary">
                  v{upgradeTarget.version} → v{upgradeTarget.version + 1}
                </span>
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setUpgradeTarget(null)} aria-label="关闭">
                <X className="size-4" />
              </Button>
            </div>
            <div className="overflow-auto p-5">
              <p className="text-xs text-muted-foreground">
                不会覆盖当前内容：旧版自动归档，新版本接入同一版本链，并继承关联任务/复习记录。
              </p>
              <label className="mt-4 block text-xs uppercase tracking-wide text-muted-foreground">标题</label>
              <input
                className={inputCls + " mt-1.5"}
                value={upgradeTitle}
                onChange={(ev) => setUpgradeTitle(ev.target.value)}
              />
              <label className="mt-4 block text-xs uppercase tracking-wide text-muted-foreground">新版本正文</label>
              <textarea
                className={inputCls + " mt-1.5 min-h-48 resize-y font-mono text-xs"}
                value={upgradeContent}
                onChange={(ev) => setUpgradeContent(ev.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => setUpgradeTarget(null)}>取消</Button>
              <Button size="sm" onClick={doUpgrade} disabled={upgrading || !upgradeTitle.trim()}>
                {upgrading ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                {upgrading ? "创建中…" : "创建新版本"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NoteCard({
  note,
  tasks,
  strategies,
  versions,
  expanded,
  confirmDelete,
  copiedCode,
  onToggle,
  onEdit,
  onDeletePress,
  onToggleTask,
  onUpgrade,
  onCopyCode,
}: {
  note: BrainNote;
  tasks: BrainTask[];
  strategies: BrainStrategy[];
  versions: BrainNote[];
  expanded: boolean;
  confirmDelete: boolean;
  copiedCode: string | null;
  onToggle: () => void;
  onEdit: () => void;
  onDeletePress: () => void;
  onToggleTask: (id: string, done: boolean) => void;
  onUpgrade: () => void;
  onCopyCode: (code: string, id: string) => void;
}) {
  const openCount = tasks.filter((t) => t.status !== "done").length;
  return (
    <div
      id={`note-${note.id}`}
      className="group relative cursor-pointer rounded-[var(--radius)] border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      onClick={onToggle}
    >
      {/* 顶部：分类色块 + 来源图标 + 任务徽标 + hover 操作 */}
      <div className="flex items-center gap-2 px-3.5 pt-3">
        {note.isSnippet && (
          <span
            className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
            style={{ background: langColor(note.language) }}
          >
            {langLabel(note.language)}
          </span>
        )}
        <span
          className="inline-block size-2 rounded-full"
          style={{ background: catColor(note.category) }}
        />
        <span className="text-xs font-medium text-muted-foreground">{note.category || "随手记"}</span>
        {tasks.length > 0 && (
          <span
            className={
              "inline-flex items-center gap-1 rounded-[var(--radius)] px-1.5 py-0.5 text-[11px] font-medium " +
              (openCount > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")
            }
            title={`${openCount} 项待处理 / ${tasks.length} 项任务`}
          >
            📋 {openCount > 0 ? `${openCount}/${tasks.length}` : "✓"}
          </span>
        )}
        {strategies.length > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-[var(--radius)] bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary"
            title={`关联 ${strategies.length} 个策略`}
          >
            🎯 {strategies.length}
          </span>
        )}
        {/* 版本标识：已归档 / 版本号 */}
        {note.superseded ? (
          <span
            className="inline-flex items-center rounded-[var(--radius)] bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
            title="已被更高版本取代"
          >
            已归档
          </span>
        ) : note.version > 1 ? (
          <span
            className="inline-flex items-center rounded-[var(--radius)] bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary"
            title={`第 ${note.version} 版`}
          >
            v{note.version}
          </span>
        ) : null}
        <span className="ml-auto text-sm leading-none">{SOURCE_ICON[note.source] ?? "📋"}</span>
        <span className="relative flex items-center gap-0.5 pl-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            className="rounded-[var(--radius)] p-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
            onClick={(ev) => {
              ev.stopPropagation();
              onEdit();
            }}
            aria-label="编辑"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            className={
              "rounded-[var(--radius)] p-1.5 transition " +
              (confirmDelete
                ? "bg-destructive/10 text-destructive"
                : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive")
            }
            onClick={(ev) => {
              ev.stopPropagation();
              onDeletePress();
            }}
            aria-label={confirmDelete ? "确认删除" : "删除"}
          >
            {confirmDelete ? <Check className="size-3.5" /> : <Trash2 className="size-3.5" />}
          </button>
        </span>
      </div>

      {/* 中部：标题 + 两行摘要 */}
      <div className="px-3.5 pt-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 truncate text-sm font-medium text-foreground">{note.title}</h3>
          {note.isSnippet && note.codeContent && (
            <button
              className="shrink-0 rounded-[var(--radius)] border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-primary"
              onClick={(ev) => {
                ev.stopPropagation();
                onCopyCode(note.codeContent!, note.id);
              }}
              title="复制代码"
            >
              {copiedCode === note.id ? "✓ 已复制" : "📋 复制"}
            </button>
          )}
        </div>
        {note.summary && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{note.summary}</p>
        )}
        {/* 代码片段预览：monospace + 深色背景，前 5 行 */}
        {note.isSnippet && note.codeContent && (
          <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-[#0f172a] px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-200">
            <code>{highlightCode(snippetPreview(note.codeContent, expanded ? 40 : 5))}</code>
          </pre>
        )}
      </div>

      {/* 底部：标签 + 相对时间 */}
      <div className="flex flex-wrap items-center gap-1.5 px-3.5 pb-3 pt-2.5">
        {note.tags.slice(0, 2).map((t) => (
          <span key={t} className="rounded-[var(--radius)] bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            #{t}
          </span>
        ))}
        {note.tags.length > 2 && (
          <span className="text-[11px] text-muted-foreground">+{note.tags.length - 2}</span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">{relativeTime(note.createdAt)}</span>
      </div>

      {/* 展开原文 */}
      {expanded && (
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap border-t border-border/70 bg-muted/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          {note.content}
        </pre>
      )}

      {/* 展开关联策略 */}
      {expanded && strategies.length > 0 && (
        <div className="border-t border-border/70 px-4 py-2.5">
          <div className="mb-1.5 text-[11px] font-semibold text-foreground">关联策略（{strategies.length}）</div>
          <div className="space-y-1">
            {strategies.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-xs">
                <span
                  className="inline-block size-1.5 shrink-0 rounded-full"
                  style={{ background: STRATEGY_COLOR[s.status] }}
                />
                <span className="min-w-0 flex-1 truncate text-foreground">{s.title}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{STRATEGY_LABEL[s.status]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 展开关联任务：直接勾选完成 */}
      {expanded && tasks.length > 0 && (
        <div className="border-t border-border/70 px-4 py-2.5">
          <div className="mb-1.5 text-[11px] font-semibold text-foreground">
            关联任务（{tasks.filter((t) => t.status !== "done").length}/{tasks.length}）
          </div>
          <div className="space-y-1.5">
            {tasks.map((tk) => (
              <label key={tk.id} className="flex cursor-pointer items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={tk.status === "done"}
                  onChange={(ev) => {
                    ev.stopPropagation();
                    onToggleTask(tk.id, ev.target.checked);
                  }}
                  className="accent-[var(--primary)]"
                />
                <span className={tk.status === "done" ? "text-muted-foreground line-through" : "text-foreground"}>
                  {tk.title}
                </span>
                {tk.dueDate && tk.status !== "done" && (
                  <span
                    className={
                      "ml-auto text-[11px] " +
                      (tk.dueDate < nowDateStr() ? "text-destructive" : "text-muted-foreground")
                    }
                  >
                    {formatDueDate(tk.dueDate)}
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 展开版本时间线 + 升级按钮 */}
      {expanded && versions.length > 0 && (
        <div className="border-t border-border/70 px-4 py-2.5">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[11px] font-semibold text-foreground">版本时间线（{versions.length}）</span>
            <span className="ml-auto text-[11px] text-muted-foreground">{note.version ? `当前 v${note.version}` : ""}</span>
          </div>
          <div className="flex items-center gap-0">
            {versions.map((v, i) => {
              const isCurrent = v.id === note.id;
              return (
                <div key={v.id} className="flex min-w-0 items-center">
                  <div
                    className={
                      "flex flex-col items-center " +
                      (i === versions.length - 1 ? "" : "flex-1")
                    }
                  >
                    <div
                      className={
                        "size-2.5 rounded-full border border-background " +
                        (isCurrent ? "bg-primary" : v.superseded ? "bg-muted-foreground/60" : "bg-muted-foreground/30")
                      }
                    />
                    <span
                      className={
                        "mt-0.5 whitespace-nowrap text-[10px] " +
                        (isCurrent ? "font-semibold text-primary" : "text-muted-foreground")
                      }
                    >
                      v{v.version}
                    </span>
                  </div>
                  {i < versions.length - 1 && (
                    <div className="mx-0.5 mb-4 h-px flex-1 bg-border" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">初版 → 最新（点击卡片名可切换）</div>
        </div>
      )}
      {expanded && !note.superseded && (
        <div className="border-t border-border/70 px-4 py-2">
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs"
            onClick={(ev) => {
              ev.stopPropagation();
              onUpgrade();
            }}
          >
            <RotateCcw className="size-3" /> 升级为新版
          </Button>
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  note,
  strategyName,
  onCycle,
  onOpen,
}: {
  task: BrainTask;
  note?: BrainNote;
  strategyName?: string;
  onCycle: () => void;
  onOpen?: () => void;
}) {
  const overdue = task.status !== "done" && !!task.dueDate && task.dueDate < nowDateStr();
  return (
    <div
      onClick={onOpen}
      className={"group relative rounded-[var(--radius)] border border-border bg-card p-3 pl-4 shadow-sm transition hover:border-primary/30 " + (onOpen ? "cursor-pointer" : "")}
    >
      {/* 优先级左侧色条（红/黄/灰） */}
      <span
        className="absolute inset-y-2 left-0 w-1 rounded-r"
        style={{ background: PRIORITY_COLOR[task.priority] }}
        title={`优先级：${task.priority === "high" ? "高" : task.priority === "medium" ? "中" : "低"}`}
      />
      <div className="space-y-1">
        <div className={"text-xs leading-snug " + (task.status === "done" ? "text-muted-foreground line-through" : "text-foreground")}>
          {task.title}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {note && (
            <span
              title={note.title}
              className="inline-flex max-w-full items-center gap-1 rounded-[var(--radius)] bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              <span className="truncate">{note.title}</span>
            </span>
          )}
          {strategyName && (
            <span className="inline-flex max-w-full items-center gap-1 rounded-[var(--radius)] bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              <span className="truncate">🎯 {strategyName}</span>
            </span>
          )}
          {task.dueDate && (
            <span className={"text-[10px] " + (overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
              {overdue ? "⚠ " : ""}
              {formatDueDate(task.dueDate)} {overdue ? "已过期" : ""}
            </span>
          )}
        </div>
      </div>
      {/* 「→」切换下一状态 */}
      <button
        onClick={(ev) => { ev.stopPropagation(); onCycle(); }}
        title={`切换为 ${STATUS_LABEL[STATUS_NEXT[task.status]]}`}
        className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-[var(--radius)] text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
        aria-label="切换状态"
      >
        <ArrowRight className="size-3.5" />
      </button>
    </div>
  );
}