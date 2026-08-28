"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Flag,
  FileText,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  Timer,
  XCircle,
} from "lucide-react";
import { ProvenancePanel } from "@/components/brain/ProvenancePanel";

type Severity = "high" | "medium" | "low";
type PrimaryAction =
  | "open_task"
  | "view_milestone"
  | "confirm_plan"
  | "view_note"
  | "update_project";

interface WorkbenchMilestone {
  name: string;
  dueDate: string | null;
  overdue: boolean;
  isUpcoming: boolean;
  status: "not_started" | "doing" | "completed";
  taskCount: number;
  completedCount: number;
  representativeTaskId: string | null;
}
interface WorkbenchRisk {
  id: string;
  code: string;
  severity: Severity;
  title: string;
  reasons: string[];
  relatedType: "task" | "milestone" | "project" | "plan" | "note";
  relatedId: string | null;
  relatedTitle: string | null;
  primaryAction: PrimaryAction;
}
interface NextAction {
  code: string;
  score: number;
  seq: number;
  title: string;
  reasons: string[];
  primaryAction: PrimaryAction;
  targetType: "task" | "milestone" | "plan" | "project" | "note";
  targetId: string | null;
  targetTitle: string | null;
  createdAt: number;
}
interface KeyKnowledgeItem {
  noteId: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  sourceLabel: string;
  hasPlan: boolean;
  createdAt: number;
  updatedAt: number;
}
interface ActivityItem {
  id: string;
  type: "task" | "note" | "reminder" | "relation" | "comment" | "plan" | "outcome";
  action: string;
  title: string;
  refId: string | null;
  refType: string | null;
  ts: number;
}
interface WorkbenchVM {
  project: {
    id: string;
    name: string;
    description: string | null;
    objective: string | null;
    status: "active" | "paused" | "completed" | "archived";
    priority: "high" | "medium" | "low";
    priorityLabel: string;
    color: string;
    startDate: string | null;
    dueDate: string | null;
    createdAt: number;
    updatedAt: number;
  };
  objective: string | null;
  progress: {
    totalTasks: number;
    todo: number;
    doing: number;
    done: number;
    blocked: number;
    overdue: number;
    completionRate: number;
  };
  nextActions: NextAction[];
  milestones: WorkbenchMilestone[];
  risks: WorkbenchRisk[];
  keyKnowledge: KeyKnowledgeItem[];
  recentActivity: ActivityItem[];
  linkedItems: { tasks: number; notes: number; reminders: number };
  config: { milestoneWindowDays: number; inactivityDays: number; staleNoteDays: number; nextMaxItems: number };
}

const STATUS_LABEL: Record<WorkbenchVM["project"]["status"], string> = {
  active: "进行中",
  paused: "已暂停",
  completed: "已完成",
  archived: "已归档",
};
const SEV_STYLE: Record<Severity, string> = {
  high: "bg-red-50 text-red-600 border-red-200",
  medium: "bg-amber-50 text-amber-600 border-amber-200",
  low: "bg-slate-50 text-slate-500 border-slate-200",
};
const SEV_ICON: Record<Severity, typeof AlertTriangle> = {
  high: XCircle,
  medium: Timer,
  low: CircleDot,
};
const ACT_TYPE_ICON: Record<ActivityItem["type"], typeof Bell> = {
  task: CheckCircle2,
  note: Layers,
  reminder: Bell,
  relation: Sparkles,
  comment: ChevronRight,
  plan: Target,
  outcome: FileText,
};
const NEXT_PRIMARY: Record<PrimaryAction, { label: string; icon: typeof ChevronRight }> = {
  open_task: { label: "打开任务", icon: ChevronRight },
  view_milestone: { label: "查看里程碑", icon: CalendarClock },
  confirm_plan: { label: "确认计划", icon: Flag },
  view_note: { label: "查看笔记", icon: Layers },
  update_project: { label: "更新项目", icon: Target },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} 个月前`;
  return `${Math.floor(mo / 12)} 年前`;
}
function fmtDate(v: string | null): string {
  if (!v) return "未设置";
  const d = new Date(v + "T00:00:00");
  return isNaN(d.getTime()) ? v : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export interface ProjectWorkbenchProps {
  projectId: string;
  onOpenTask?: (taskId: string) => void;
  onBack?: () => void;
  onChanged?: () => void;
  /** 进入完整任务/里程碑列表视图 */
  onViewTasks?: () => void;
}

export function ProjectWorkbench({ projectId, onOpenTask, onBack, onChanged, onViewTasks }: ProjectWorkbenchProps) {
  const [data, setData] = useState<WorkbenchVM | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [editingObjective, setEditingObjective] = useState(false);
  const [objectiveDraft, setObjectiveDraft] = useState("");
  const [savingObjective, setSavingObjective] = useState(false);

  const mileRef = useRef<HTMLDivElement>(null);
  const riskRef = useRef<HTMLDivElement>(null);
  const knowRef = useRef<HTMLDivElement>(null);
  const objectiveRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    let disposed = false;
    setLoading(true);
    setError("");
    fetch(`/api/brain/projects/${encodeURIComponent(projectId)}/workbench`)
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (disposed) return;
        if (!r.ok) {
          setError(r.status === 401 ? "登录已过期，请重新登录" : r.status === 404 ? "项目不存在或无权限访问" : "加载项目失败");
          setData(null);
          return;
        }
        if (d?.workbench) setData(d.workbench as WorkbenchVM);
        else setError("返回数据异常");
      })
      .catch(() => {
        if (!disposed) setError("网络异常，加载失败");
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [projectId, retryToken]);

  useEffect(load, [load]);

  const refresh = () => {
    setRetryToken((t) => t + 1);
  };

  const runAction = async (action: PrimaryAction, item: { targetId: string | null; targetTitle?: string | null }) => {
    if (action === "open_task" && item.targetId && onOpenTask) {
      onOpenTask(item.targetId);
      return;
    }
    if (action === "view_milestone") {
      mileRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "confirm_plan" && item.targetId) {
      setPendingAction("confirm_plan");
      try {
        const res = await fetch("/api/brain/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: item.targetId }),
        });
        const d = await res.json().catch(() => null);
        if (!res.ok) {
          if (d?.error === "already_applied") {
            refresh();
          }
          return;
        }
        refresh();
        onChanged?.();
      } catch {
        /* 网络异常忽略 */
      } finally {
        setPendingAction(null);
      }
      return;
    }
    if (action === "view_note" && item.targetId) {
      setActiveNoteId(item.targetId);
      knowRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "update_project") {
      if (!editingObjective) {
        setObjectiveDraft(data?.objective ?? data?.project?.description ?? "");
        setEditingObjective(true);
        setTimeout(() => objectiveRef.current?.focus(), 60);
      } else {
        objectiveRef.current?.focus();
      }
      return;
    }
  };

  const saveObjective = async () => {
    if (!data || savingObjective) return;
    setSavingObjective(true);
    try {
      const res = await fetch(`/api/brain/projects/${data.project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective: objectiveDraft.trim() || null }),
      });
      if (res.ok) {
        setEditingObjective(false);
        refresh();
        onChanged?.();
      }
    } catch {
      /* 忽略 */
    } finally {
      setSavingObjective(false);
    }
  };

  const title = data?.project.name ?? "";
  const ring = 2 * Math.PI * 30;
  const ringDone = ((data?.progress.completionRate ?? 0) / 100) * ring;
  const ready = data !== null;

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> 正在加载项目工作台…
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        {onBack && (
          <button onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 rounded-md p-1.5 text-muted-foreground transition hover:bg-muted">
            <ArrowLeft className="size-4" /> 返回项目列表
          </button>
        )}
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          {error === "项目不存在或无权限访问" ? (
            <LockIcon />
          ) : (
            <AlertTriangle className="size-8 text-destructive" />
          )}
          <p className="text-sm text-foreground">{error || "加载失败"}</p>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90"
          >
            <RefreshCw className="size-3.5" /> 重试
          </button>
        </div>
      </div>
    );
  }

  const p = data!.project;
  const idle = data!.risks.length === 0 && data!.nextActions.length === 0 && data!.milestones.length === 0 && data!.keyKnowledge.length === 0;

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      {/* 顶栏：返回 + 名称 + 状态/优先级/日期 */}
      <div className="flex items-center gap-2">
        {onBack && (
          <button onClick={onBack} className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground">
            <ArrowLeft className="size-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: p.color }} />
            <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: `${p.color}1a`, color: p.color }}>
              {STATUS_LABEL[p.status]}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              优先级 {p.priorityLabel}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>最近更新 {timeAgo(p.updatedAt)}</span>
            {p.dueDate && <span>截止 {fmtDate(p.dueDate)}</span>}
            <span className="text-muted-foreground/70">{data!.linkedItems.tasks} 任务 · {data!.linkedItems.notes} 笔记 · {data!.linkedItems.reminders} 提醒</span>
          </div>
        </div>
      </div>

      {/* 项目目标（可编辑） */}
      <div className="mt-4 rounded-xl border border-border bg-muted/20 p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Target className="size-3.5 text-primary" /> 项目目标
        </div>
        {editingObjective ? (
          <div className="mt-2 flex items-center gap-2">
            <input
              ref={objectiveRef}
              value={objectiveDraft}
              onChange={(e) => setObjectiveDraft(e.target.value)}
              placeholder="一句话描述这个项目的目标…"
              onKeyDown={(e) => { if (e.key === "Enter") saveObjective(); if (e.key === "Escape") setEditingObjective(false); }}
              className="h-9 w-full rounded-lg border border-border bg-card px-2.5 text-xs focus:border-primary focus:outline-none"
            />
            <button onClick={saveObjective} disabled={savingObjective} className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40">
              {savingObjective ? "保存中…" : "保存"}
            </button>
          </div>
        ) : (
          <button onClick={() => { setObjectiveDraft(data!.objective ?? p.description ?? ""); setEditingObjective(true); }} className="mt-1 block w-full text-left text-xs text-foreground">
            {data!.objective || p.description ? (
              <span className="text-foreground">{data!.objective || p.description}</span>
            ) : (
              <span className="text-muted-foreground">尚未填写目标摘要，点击补充</span>
            )}
          </button>
        )}
      </div>

      {/* 空态：没有任何任务/笔记/里程碑 */}
      {idle ? (
        <div className="mt-4 rounded-xl border border-dashed border-border/60 py-10 text-center text-sm text-muted-foreground">
          这个项目还没有任务、笔记或里程碑。
          <div className="mt-1 text-xs">开始记录笔记并整理出任务，或在看板新建任务并归属到该项目。</div>
        </div>
      ) : (
        <>
          {/* 第一屏：下一步 + 进展 + 风险 + 里程碑 */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* 下一步 */}
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Flag className="size-3.5 text-primary" /> 下一步
              </div>
              {data!.nextActions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 py-6 text-center text-[11px] text-muted-foreground">暂无待办，项目一切就绪</div>
              ) : (
                <div className="space-y-2">
                  {data!.nextActions.map((a, i) => (
                    <button
                      key={a.code + i}
                      onClick={() => runAction(a.primaryAction, a)}
                      className="group flex w-full items-start gap-2 rounded-lg border border-border/60 bg-muted/20 p-2.5 text-left transition hover:border-primary/40 hover:bg-primary/5"
                    >
                      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-foreground">{a.title}</span>
                        <span className="mt-0.5 line-clamp-2 block text-[11px] text-muted-foreground">{a.reasons.join(" · ")}</span>
                        <span className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-medium text-primary">
                          {NEXT_PRIMARY[a.primaryAction].label} <ChevronRight className="size-3" />
                        </span>
                      </span>
                      <span className="mt-0.5 text-[10px] text-muted-foreground">{a.score}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 进展概览 */}
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">进展概览</div>
              <div className="flex items-center gap-3">
                <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90 shrink-0">
                  <circle cx="36" cy="36" r="30" fill="none" stroke="currentColor" strokeWidth="7" className="text-muted" />
                  <circle cx="36" cy="36" r="30" fill="none" stroke={p.color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${ringDone} ${ring}`} />
                </svg>
                <div className="min-w-0 flex-1">
                  <div className="text-xl font-bold" style={{ color: p.color }}>{data!.progress.completionRate}%</div>
                  <div className="text-[11px] text-muted-foreground">完成 {data!.progress.done} / {data!.progress.totalTasks} 个任务</div>
                  <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                    <Stat label="待处理" value={data!.progress.todo} tone={data!.progress.todo ? "text-amber-600" : "text-muted-foreground"} />
                    <Stat label="进行中" value={data!.progress.doing} tone={data!.progress.doing ? "text-blue-600" : "text-muted-foreground"} />
                    <Stat label={data!.progress.overdue ? "逾期" : "阻塞"} value={data!.progress.overdue ? data!.progress.overdue : data!.progress.blocked} tone={data!.progress.overdue ? "text-red-600" : data!.progress.blocked ? "text-red-600" : "text-muted-foreground"} />
                  </div>
                </div>
              </div>
            </div>

            {/* 风险 */}
            <div ref={riskRef} className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <AlertTriangle className="size-3.5 text-destructive" /> 项目风险
              </div>
              {data!.risks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 py-6 text-center text-[11px] text-muted-foreground">暂无风险</div>
              ) : (
                <div className="space-y-2">
                  {data!.risks.map((r) => {
                    const Icon = SEV_ICON[r.severity];
                    return (
                      <button
                        key={r.id}
                        onClick={() => runAction(r.primaryAction, { targetId: r.relatedId, targetTitle: r.relatedTitle })}
                        className="w-full rounded-lg border bg-card px-2.5 py-2 text-left transition hover:opacity-90"
                        style={{ borderColor: r.severity === "high" ? "#fecaca" : r.severity === "medium" ? "#fde68a" : "#e2e8f0" }}
                      >
                        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                          <Icon className="size-3.5" style={{ color: r.severity === "high" ? "#dc2626" : r.severity === "medium" ? "#d97706" : "#64748b" }} />
                          <span className="truncate">{r.title}</span>
                        </span>
                        <span className="mt-1 line-clamp-2 block text-[11px] text-muted-foreground">{r.reasons.join(" · ")}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 即将到期里程碑 */}
          {data!.milestones.length > 0 && (
            <div ref={mileRef} className="mt-4 rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <CalendarClock className="size-3.5 text-primary" /> 即将到期 / 逾期里程碑
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {data!.milestones.map((m) => (
                  <div key={m.name} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">🔖 {m.name}</span>
                      {m.overdue ? (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">已到期</span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">即将到期</span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>截止 {fmtDate(m.dueDate)}</span>
                      <span>{m.completedCount}/{m.taskCount} · {m.status === "doing" ? "进行中" : m.status === "completed" ? "已完成" : "未开始"}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${m.taskCount ? (m.completedCount / m.taskCount) * 100 : 0}%`, background: m.overdue ? "#dc2626" : "#f59e0b" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 第二屏：关键知识 + 近期活动 */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div ref={knowRef} className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Layers className="size-3.5 text-primary" /> 关键知识 / 结论
              </div>
              {data!.keyKnowledge.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 py-6 text-center text-[11px] text-muted-foreground">
                  暂无已确认的关键笔记。把笔记关联到该项目即可沉淀到这里。
                </div>
              ) : (
                <div className="space-y-2">
                  {data!.keyKnowledge.map((n) => (
                    <div key={n.noteId} className={"rounded-lg border px-3 py-2 transition " + (activeNoteId === n.noteId ? "border-primary/50 bg-primary/5" : "border-border/60 bg-muted/20")}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium text-foreground">{n.title}</span>
                        <span className="shrink-0 rounded-full bg-card px-1.5 py-px text-[10px] text-muted-foreground">{n.category}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{n.summary}</p>
                      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{n.sourceLabel}{n.hasPlan ? " · 经 AI 整理" : ""}</span>
                        {n.tags.map((t) => (
                          <span key={t} className="rounded bg-card px-1.5 py-px">{t}</span>
                        ))}
                        <span className="ml-auto">更新于 {timeAgo(n.updatedAt)}</span>
                      </div>
                      <div className="mt-1">
                        <ProvenancePanel anchor={{ noteId: n.noteId }} light />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">近期活动</div>
              {data!.recentActivity.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 py-6 text-center text-[11px] text-muted-foreground">暂无活动记录</div>
              ) : (
                <div className="space-y-1">
                  {data!.recentActivity.map((a) => {
                    const Icon = ACT_TYPE_ICON[a.type];
                    return (
                      <button key={a.id} onClick={() => a.refType === "task" && a.refId ? onOpenTask?.(a.refId) : undefined} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-muted/60">
                        <Icon className="size-3.5 shrink-0 text-primary/70" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs text-foreground">{a.action}</span>
                          {a.title && <span className="block truncate text-[10px] text-muted-foreground">{a.title}</span>}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(a.ts)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 第三屏：详情入口 */}
          <div className="mt-4 rounded-xl border border-border bg-muted/20 p-3">
            <div className="mb-2 text-xs font-semibold text-foreground">详情入口</div>
            <div className="flex flex-wrap gap-2">
              <DetailLink label="任务列表" value={data!.linkedItems.tasks} onClick={() => { if (data!.linkedItems.tasks) { if (onViewTasks) { onViewTasks(); return; } const t = data!.nextActions.find((x) => x.targetType === "task") ?? null; if (t && t.targetId && onOpenTask) onOpenTask(t.targetId); } }} />
              <span
                className="inline-flex cursor-default items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground"
                title="项目笔记在「笔记」视图查看"
              >
                <Layers className="size-3.5" /> 笔记 {data!.linkedItems.notes}
              </span>
              <span
                className="inline-flex cursor-default items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground"
                title="提醒在「提醒中心」查看"
              >
                <Bell className="size-3.5" /> 提醒 {data!.linkedItems.reminders}
              </span>
              <span className="inline-flex cursor-default items-center gap-1 rounded-lg border border-dashed border-border/60 px-3 py-1.5 text-xs text-muted-foreground">
                看板 / 甘特图可经顶部导航进入
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-1 py-1">
      <div className={"text-sm font-semibold " + tone}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function DetailLink({ label, value, onClick }: { label: string; value: number; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground transition hover:border-primary/40 hover:text-primary">
      <CheckCircle2 className="size-3.5" /> {label} {value} <ChevronRight className="size-3" />
    </button>
  );
}

function LockIcon() {
  return (
    <div className="flex size-10 items-center justify-center rounded-full bg-muted">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    </div>
  );
}