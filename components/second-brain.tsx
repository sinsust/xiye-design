"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Brain,
  CalendarCheck,
  CalendarClock,
  Check,
  ArrowRight,
  ClipboardList,
  Cloud,
  Code2,
  Columns3,
  Copy,
  FileText,
  FileUp,
  FolderKanban,
  GraduationCap,
  Home,
  Inbox,
  LayoutDashboard,
  LayoutList,
  ListTodo,
  Loader2,
  Mic,
  PenLine,
  Pencil,
  RotateCcw,
  Search,
  Shuffle,
  Sparkles,
  Table2,
  Tags,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KnowledgeGraph } from "@/components/knowledge-graph";
import { TableAnalysisPage } from "@/components/table/TableAnalysisPage";
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
import type {
  AskMode,
  AskSourceItem,
  BrainNote,
  OrganizedActionItem,
  OrganizedDraft,
  OrganizedMetric,
  OrganizedProblemDomain,
  OrganizedStrategy,
  StructViewData,
} from "./brain/types";
import { TYPE_LABEL } from "./brain/types";
import { SearchPanel } from "./brain/search-panel";
import { StructPreview } from "./brain/struct-preview";
import { NoteCard } from "./brain/note-card";
import { TaskCard } from "./brain/task-card";
import { OverviewPanel } from "./brain/overview-panel";
import { SnippetsTab } from "./brain/workbench/snippets-tab";
import { StrategiesTab } from "./brain/workbench/strategies-tab";
import { KanbanTab } from "./brain/workbench/kanban-tab";
import { InputTab } from "./brain/workbench/input-tab";
import {
  STATUS_LABEL,
  STATUS_NEXT,
  PRIORITY_RANK,
  PRIORITY_COLOR,
  STRATEGY_LABEL,
  STRATEGY_NEXT,
  STRATEGY_COLOR,
  CATEGORY_COLORS,
  CATEGORY_OPTIONS,
  SOURCE_ICON,
  asGraphEntries,
  catColor,
  langColor,
  langLabel,
  snippetPreview,
  highlightCode,
  relativeTime,
  nowDateStr,
  formatDueDate,
  nextInHours,
  inputCls,
} from "./brain/brain-utils";

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
  // 顶栏「全局搜索」下拉面板
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchWrapRef = useRef<HTMLDivElement>(null);
  // 搜索即时过滤的降级值：输入即时交付 UI，过滤在后台低优先级计算，避免大数据量下键入卡顿
  const deferredSearch = useDeferredValue(searchQuery);
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
  const [workTab, setWorkTab] = useState<"input" | "ask" | "kanban" | "strategies" | "snippets" | "projects" | "table">("input");
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

  // —— P1：Cmd/Ctrl+K 唤起全局搜索 / 命令面板 ——
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchQuery("");
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // 全局搜索面板：外点 / Esc 关闭
  useEffect(() => {
    if (!searchOpen) return;
    const onClick = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [searchOpen]);

  // 全局搜索过滤缓存：依赖 deferredSearch，仅当关键词或数据变化时重算，避免无关交互触发重复全量过滤
  const searchHits = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return null;
    const noteHits = notes
      .filter((n) => !n.superseded && [n.title, n.summary, n.category, ...n.tags].join(" ").toLowerCase().includes(q))
      .slice(0, 6);
    const taskHits = tasks.filter((t) => !t.archived && t.title.toLowerCase().includes(q)).slice(0, 4);
    const strategyHits = strategies.filter((s) => s.title.toLowerCase().includes(q)).slice(0, 4);
    const snippetHits = snippetFiltered
      .filter((s) => [s.title, s.language].filter(Boolean).join(" ").toLowerCase().includes(q))
      .slice(0, 4);
    return {
      q,
      noteHits,
      taskHits,
      strategyHits,
      snippetHits,
      total: noteHits.length + taskHits.length + strategyHits.length + snippetHits.length,
    };
  }, [deferredSearch, notes, tasks, strategies, snippetFiltered]);

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
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1100px 560px at 12% -8%, color-mix(in oklch, var(--primary) 0.11, transparent), transparent 62%), radial-gradient(900px 520px at 94% 112%, color-mix(in oklch, var(--primary) 0.08, transparent), transparent 60%), color-mix(in oklch, var(--muted) 26%, white)",
        backgroundAttachment: "fixed",
      }}
    >
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
        <div className="mb-5 flex flex-wrap items-center gap-1 rounded-xl border border-border/60 bg-white/70 px-2 py-1.5 shadow-lg shadow-primary/5 backdrop-blur-md">
          {[
            { v: "dashboard" as const, label: "首页", icon: Home },
            { v: "input" as const, label: "记一笔", icon: PenLine },
            { v: "kanban" as const, label: "任务看板", icon: ListTodo },
            { v: "projects" as const, label: "项目", icon: FolderKanban },
            { v: "strategies" as const, label: "策略", icon: Target },
            { v: "snippets" as const, label: "代码片段", icon: Code2 },
            { v: "table" as const, label: "表格", icon: Table2 },
          ].map((i) => {
            const active = topView === "dashboard" ? i.v === "dashboard" : i.v === workTab;
            return (
              <button
                key={i.v}
                onClick={() => gotoTop(i.v === "dashboard" ? "dashboard" : "workbench", i.v as typeof workTab)}
                className={
                  "relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition " +
                  (active
                    ? "text-primary"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground")
                }
              >
                {active && (
                  <span className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-r from-primary/14 to-primary/6 shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary)_30%,transparent)]" />
                )}
                <i.icon className="size-4" />
                {i.label}
                {i.v === "kanban" && taskCounts.todo + taskCounts.in_progress > 0 && (
                  <span className="rounded-full bg-gradient-to-r from-primary to-primary/80 px-1.5 py-px text-[10px] font-semibold text-primary-foreground shadow-sm">
                    {taskCounts.todo + taskCounts.in_progress}
                  </span>
                )}
                {i.v === "strategies" && strategies.length > 0 && (
                  <span className="rounded-full bg-gradient-to-r from-primary to-primary/80 px-1.5 py-px text-[10px] font-semibold text-primary-foreground shadow-sm">
                    {strategies.length}
                  </span>
                )}
                {i.v === "snippets" && snippetFiltered.length > 0 && (
                  <span className="rounded-full bg-gradient-to-r from-primary to-primary/80 px-1.5 py-px text-[10px] font-semibold text-primary-foreground shadow-sm">
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
            <div ref={searchWrapRef} className="relative">
              <button
                onClick={() => {
                  setSearchOpen((v) => !v);
                }}
                className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="全局搜索 / AI 问答"
                title="全局搜索 / AI 问答"
              >
                <Search className="size-[18px]" />
              </button>

              <SearchPanel
                open={searchOpen}
                query={searchQuery}
                setQuery={setSearchQuery}
                hits={searchHits}
                onClose={() => setSearchOpen(false)}
                goto={(view, tab) => gotoTop(view as "dashboard" | "workbench", tab as (typeof workTab | undefined))}
                onInbox={() => setInboxOpen(true)}
                jumpToNote={jumpToNote}
                openSnippet={(id) => { gotoTop("workbench", "snippets"); setExpandedSnippet(id); }}
                qa={qa}
                question={question}
                setQuestion={setQuestion}
                askMode={askMode}
                setAskMode={setAskMode}
                asking={asking}
                ask={ask}
              />
            </div>
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
          <div key="view-dashboard" className="animate-in fade-in duration-200 ease-out">
            <DashboardPanel
              onOpenInbox={() => setInboxOpen(true)}
              onGoto={(tab) => gotoTop("workbench", tab as typeof workTab)}
              onNewTask={() => gotoTop("workbench", "kanban")}
              onOpenProject={(id) => {
                setOpenProjectId(id);
                gotoTop("workbench", "projects");
              }}
            />
          </div>
        ) : workTab === "projects" ? (
          <div key="view-projects" className="animate-in fade-in duration-200 ease-out">
            <ProjectPanel
              openTask={(id) => setDetailTaskId(id)}
              onTasksChanged={loadTasks}
              initialProjectId={openProjectId}
            />
          </div>
        ) : workTab === "table" ? (
          <div key="view-table" className="animate-in fade-in duration-200 ease-out">
            <TableAnalysisPage />
          </div>
        ) : (
        <div key="view-workbench" className="grid grid-cols-1 gap-6 animate-in fade-in duration-200 ease-out">
          {/* ============ 左列 · 工作台（全宽，概览已移至浮层） ============ */}
          <div className="space-y-6">
            {/* 大脑工作台（整理/提问 Tab 切换） */}
            <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
{workTab === "snippets" ? (
                <SnippetsTab
                  snippetLang={snippetLang}
                  setSnippetLang={setSnippetLang}
                  snippetQuery={snippetQuery}
                  setSnippetQuery={setSnippetQuery}
                  snippetFiltered={snippetFiltered}
                  expandedSnippet={expandedSnippet}
                  setExpandedSnippet={setExpandedSnippet}
                  copiedCode={copiedCode}
                  copyCode={copyCode}
                />
              ) : workTab === "strategies" ? (
                <StrategiesTab
                  strategies={strategies}
                  expandedStrategy={expandedStrategy}
                  setExpandedStrategy={setExpandedStrategy}
                  strategyTaskStats={strategyTaskStats}
                  tasks={tasks}
                  cycleStrategyStatus={cycleStrategyStatus}
                  confirmDeleteStrategy={confirmDeleteStrategy}
                  setConfirmDeleteStrategy={setConfirmDeleteStrategy}
                  deleteStrategy={deleteStrategy}
                />
              ) : workTab === "kanban" ? (
                <KanbanTab
                  kanbanView={kanbanView}
                  setKanbanView={setKanbanView}
                  kanbanGroup={kanbanGroup}
                  setKanbanGroup={setKanbanGroup}
                  tasks={tasks}
                  projects={projects}
                  notes={notes}
                  strategies={strategies}
                  strategyFilter={strategyFilter}
                  setStrategyFilter={setStrategyFilter}
                  strategyMap={strategyMap}
                  tasksByStrategyGroup={tasksByStrategyGroup}
                  boardTasks={boardTasks}
                  overdueTasks={overdueTasks}
                  cycleTask={cycleTask}
                  setDetailTaskId={setDetailTaskId}
                  loadTasks={loadTasks}
                  loadProjects={loadProjects}
                />
              ) : (
                <InputTab
                  text={text}
                  setText={setText}
                  organize={organize}
                  organizing={organizing}
                  placeholders={PLACEHOLDERS}
                  placeholderIndex={phIdx}
                  setBatchOpen={setBatchOpen}
                  setRaw={setRaw}
                />
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
                      <div
                        key={n.id}
                        className="[content-visibility:auto] [contain-intrinsic-size:auto_220px]"
                      >
                      <NoteCard
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
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ============ 右列 · 概览（浮层面板：不占布局宽度，可开关） ============ */}
  {overviewOpen && (
    <OverviewPanel
      onClose={() => setOverviewOpen(false)}
      thickness={thickness}
      activity={activity}
      activityShowAll={activityShowAll}
      setActivityShowAll={setActivityShowAll}
      dueReviews={dueReviews}
      doReview={doReview}
      reviewingId={reviewingId}
      nextReview={nextReview}
      report={report}
      reportError={reportError}
      generateReport={generateReport}
      reporting={reporting}
      weekActionItems={weekActionItems}
      graphEntries={graphEntries}
      centerEntry={centerEntry}
      learningTopics={learningTopics}
      openTopic={openTopic}
      setOpenTopic={setOpenTopic}
    />
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

