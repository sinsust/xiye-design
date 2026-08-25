"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, ArrowLeft, Trash2, Check, X } from "lucide-react";
import MilestoneView from "@/components/MilestoneView";

type TaskStatus = "todo" | "in_progress" | "done";
interface TaskLite {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  milestone: string | null;
  priority: string;
  assignee: string | null;
  projectId: string | null;
}
interface Project {
  id: string;
  name: string;
  status: "active" | "paused" | "completed" | "archived";
  color: string;
  description: string | null;
  startDate: string | null;
  dueDate: string | null;
  totalTasks: number;
  completedTasks: number;
  progress: number;
  daysRemaining: number | null;
}

const P_STATUS_LABEL: Record<Project["status"], string> = {
  active: "进行中",
  paused: "已暂停",
  completed: "已完成",
  archived: "已归档",
};
const P_STATUS_COLOR: Record<Project["status"], string> = {
  active: "#22c55e",
  paused: "#f59e0b",
  completed: "#3b82f6",
  archived: "#94a3b8",
};
const STATUS_LABEL: Record<TaskStatus, string> = { todo: "待处理", in_progress: "进行中", done: "已完成" };
const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
const PRIORITY_COLOR: Record<string, string> = { high: "#ef4444", medium: "#f59e0b", low: "#94a3b8" };

const PALETTE = ["#3B82F6", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#14B8A6", "#6366F1", "#EF4444"];

function fmtDate(v: string | null): string {
  if (!v) return "未设置";
  const d = new Date(v + "T00:00:00");
  return isNaN(d.getTime()) ? v : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export interface ProjectPanelProps {
  openTask: (taskId: string) => void;
  onTasksChanged: () => void;
  initialProjectId?: string | null;
}

export default function ProjectPanel({ openTask, onTasksChanged, initialProjectId }: ProjectPanelProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<TaskLite[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialProjectId ?? null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);

  // 来自外部（如每日助理点项目卡片）的跳转目标
  const prevTarget = useRef(initialProjectId);
  useEffect(() => {
    if (initialProjectId && initialProjectId !== prevTarget.current) {
      prevTarget.current = initialProjectId;
      setSelectedId(initialProjectId);
    }
  }, [initialProjectId]);

  // 新建表单
  const [nName, setNName] = useState("");
  const [nDesc, setNDesc] = useState("");
  const [nColor, setNColor] = useState(PALETTE[0]);
  const [nDue, setNDue] = useState("");

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/brain/projects");
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d.projects)) setProjects(d.projects);
      }
    } catch {
      /* 忽略 */
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/brain/tasks");
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d.tasks)) setTasks((d.tasks as (TaskLite & { parentTaskId?: string | null })[]).filter((t) => !t.parentTaskId));
      }
    } catch {
      /* 忽略 */
    }
  }, []);

  useEffect(() => {
    loadProjects();
    loadTasks();
  }, [loadProjects, loadTasks]);

  const selected = useMemo(() => projects.find((p) => p.id === selectedId) ?? null, [projects, selectedId]);

  const createProject = async () => {
    const name = nName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/brain/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: nDesc, color: nColor, dueDate: nDue || null }),
      });
      if (res.ok) {
        const d = await res.json();
        setShowNew(false);
        setNName(""); setNDesc(""); setNDue(""); setNColor(PALETTE[0]);
        await loadProjects();
        if (d?.project?.id) setSelectedId(d.project.id);
      }
    } catch {
      /* 忽略 */
    } finally {
      setBusy(false);
    }
  };

  const saveProject = async (patch: Record<string, unknown>) => {
    if (!selectedId || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/brain/projects/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) await loadProjects();
    } catch {
      /* 忽略 */
    } finally {
      setBusy(false);
    }
  };

  const archiveProject = async () => {
    if (!selectedId) return;
    if (!window.confirm("归档该项目？关联任务将从项目中解绑（不删除任务）。")) return;
    setBusy(true);
    try {
      await fetch(`/api/brain/projects/${selectedId}`, { method: "DELETE" });
      setSelectedId(null);
      await loadProjects();
    } finally {
      setBusy(false);
    }
  };

  const cycleTask = async (id: string) => {
    const cur = tasks.find((t) => t.id === id);
    if (!cur) return;
    const next = cur.status === "todo" ? "in_progress" as TaskStatus : cur.status === "in_progress" ? "done" : "todo";
    await fetch(`/api/brain/tasks?id=${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }),
    });
    await loadTasks();
    onTasksChanged();
  };

  // ---- 详情视图内任务分组 ----
  const [detailGroup, setDetailGroup] = useState<"milestone" | "status">("milestone");
  const [detailTab, setDetailTab] = useState<"tasks" | "milestone">("tasks");
  const projTasks = useMemo(
    () => tasks.filter((t) => t.projectId === selectedId).sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]),
    [tasks, selectedId],
  );
  const milestoneGroups = useMemo(() => {
    const map = new Map<string, TaskLite[]>();
    for (const t of projTasks) {
      const k = t.milestone?.trim() || "无里程碑";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    return Array.from(map.entries()).map(([key, list]) => ({ key, tasks: list }));
  }, [projTasks]);

  if (loading) {
    return <div className="rounded-xl border border-border bg-white p-6 text-sm text-muted-foreground shadow-sm">加载项目…</div>;
  }

  // ---------- 项目详情视图 ----------
  if (selected) {
    const ring = 2 * Math.PI * 30;
    const ringDone = (selected.progress / 100) * ring;
    return (
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        {/* 顶栏 */}
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedId(null)} className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground">
            <ArrowLeft className="size-4" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: selected.color }} />
              <input
                defaultValue={selected.name}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== selected.name) saveProject({ name: v }); }}
                className="w-auto max-w-[320px] rounded-md border border-transparent bg-transparent text-sm font-semibold text-foreground transition hover:border-border focus:border-primary focus:outline-none px-1"
              />
              <span className="text-[13px] text-muted-foreground">📁 {selected.name}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <select
                value={selected.status}
                onChange={(e) => saveProject({ status: e.target.value })}
                className="rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px]"
              >
                {(Object.keys(P_STATUS_LABEL) as Project["status"][]).map((s) => <option key={s} value={s}>{P_STATUS_LABEL[s]}</option>)}
              </select>
              <span>截止：{fmtDate(selected.dueDate)}</span>
              {selected.daysRemaining !== null && selected.status === "active" && (
                <span className={selected.daysRemaining < 0 ? "font-medium text-destructive" : ""}>
                  {selected.daysRemaining < 0 ? `已逾期 ${-selected.daysRemaining} 天` : `剩余 ${selected.daysRemaining} 天`}
                </span>
              )}
              <button onClick={archiveProject} disabled={busy} className="ml-auto inline-flex items-center gap-1 rounded-md text-destructive transition hover:bg-destructive/10 px-1.5 py-0.5">
                <Trash2 className="size-3" /> 归档
              </button>
            </div>
          </div>
        </div>

        {/* 进度 + 任务 */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3">
            <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
              <circle cx="36" cy="36" r="30" fill="none" stroke="currentColor" strokeWidth="7" className="text-muted" />
              <circle cx="36" cy="36" r="30" fill="none" stroke={selected.color} strokeWidth="7" strokeLinecap="round"
                strokeDasharray={`${ringDone} ${ring}`} />
            </svg>
            <div>
              <div className="text-xl font-bold" style={{ color: selected.color }}>{selected.progress}%</div>
              <div className="text-[11px] text-muted-foreground">
                已完成 <b>{selected.completedTasks}</b> / {selected.totalTasks} 个任务
              </div>
            </div>
          </div>
          <div className="sm:col-span-2 rounded-xl border border-border bg-card p-3">
            <div className="mb-2 text-xs font-semibold text-foreground">项目备注</div>
            {selected.description ? <p className="text-xs text-muted-foreground">{selected.description}</p> : <p className="text-xs text-muted-foreground">暂无描述</p>}
          </div>
        </div>

        {/* 任务列表：按里程碑 / 按状态 */}
        <div className="mt-4">
          <div className="mb-3 flex items-center gap-1 border-b border-border/60 pb-2">
            {(["tasks", "milestone"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setDetailTab(tab)}
                className="relative px-1.5 pb-1 text-xs transition"
              >
                <span className={detailTab === tab ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"}>
                  {tab === "tasks" ? "任务列表" : "里程碑"}
                </span>
                {detailTab === tab && <span className="absolute inset-x-0 -bottom-[9px] h-0.5 rounded-full bg-primary" />}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-muted-foreground">{projTasks.length} 个任务</span>
          </div>

          {detailTab === "milestone" ? (
            <MilestoneView
              projectName={selected.name}
              tasks={projTasks.map((t) => ({ id: t.id, title: t.title, status: t.status, dueDate: t.dueDate, milestone: t.milestone, priority: t.priority }))}
              openTask={openTask}
              onCycle={cycleTask}
            />
          ) : (
          <>
          <div className="mb-2 flex items-center gap-1">
            {(["milestone", "status"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setDetailGroup(g)}
                className={"rounded-md px-2 py-1 text-[11px] transition " + (detailGroup === g ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted")}
              >
                {g === "milestone" ? "按里程碑" : "按状态"}
              </button>
            ))}
          </div>

          {projTasks.length === 0 && (
            <div className="rounded-xl border border-dashed border-border/60 py-8 text-center text-xs text-muted-foreground">
              该项目还没有任务。可在任务卡片的详情抽屉里把任务指到该项目，或在看板新建。
            </div>
          )}

          {detailGroup === "milestone" ? (
            <div className="space-y-3">
              {milestoneGroups.map((g) => {
                const done = g.tasks.filter((t) => t.status === "done").length;
                const pct = g.tasks.length ? Math.round((done / g.tasks.length) * 100) : 0;
                return (
                  <div key={g.key} className="rounded-xl border border-border bg-card p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">🔖 {g.key}</span>
                      <span className="text-[10px] text-muted-foreground">{done}/{g.tasks.length} · {pct}%</span>
                    </div>
                    <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="space-y-1.5">
                      {g.tasks.map((t) => (
                        <div key={t.id} className="group flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5">
                          <span className="h-4 w-1 rounded" style={{ background: PRIORITY_COLOR[t.priority] }} />
                          <button onClick={() => openTask(t.id)} className="min-w-0 flex-1 truncate text-left text-xs text-foreground transition hover:text-primary">
                            {t.title}
                          </button>
                          {t.assignee && <span className="shrink-0 text-[10px] text-muted-foreground">👤 {t.assignee}</span>}
                          <button
                            onClick={() => cycleTask(t.id)}
                            className={"shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium transition " +
                              (t.status === "done" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground hover:bg-primary/10")}
                          >
                            {STATUS_LABEL[t.status]}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(["todo", "in_progress", "done"] as TaskStatus[]).map((st) => {
                const col = projTasks.filter((t) => t.status === st);
                return (
                  <div key={st} className="rounded-xl border border-border bg-muted/20 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">{STATUS_LABEL[st]}</span>
                      <span className="rounded-full bg-card px-1.5 py-px text-[10px] text-muted-foreground">{col.length}</span>
                    </div>
                    <div className="space-y-1.5">
                      {col.length === 0 && <div className="rounded-lg border border-dashed border-border/60 py-4 text-center text-[11px] text-muted-foreground">暂无</div>}
                      {col.map((t) => (
                        <button key={t.id} onClick={() => openTask(t.id)} className="flex w-full items-center gap-2 rounded-lg border border-border/60 bg-card px-2 py-1.5 text-left">
                          <span className="h-4 w-1 rounded" style={{ background: PRIORITY_COLOR[t.priority] }} />
                          <span className="min-w-0 flex-1 truncate text-xs text-foreground">{t.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </>
          )}
        </div>
      </div>
    );
  }

  // ---------- 项目列表视图 ----------
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">📁 项目</h2>
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90">
          <Plus className="size-3.5" /> 新项目
        </button>
      </div>

      {projects.length === 0 && !showNew && (
        <div className="rounded-xl border border-dashed border-border/60 py-10 text-center text-sm text-muted-foreground">
          还没有项目。创建一个项目来组织你的任务、里程碑与进度。
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedId(p.id)}
            className="group overflow-hidden rounded-xl border border-border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                <span className="size-2.5 rounded-full" style={{ background: p.color }} />
                <span className="truncate">{p.name}</span>
              </span>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: `${P_STATUS_COLOR[p.status]}1a`, color: P_STATUS_COLOR[p.status] }}>
                {P_STATUS_LABEL[p.status]}
              </span>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{p.completedTasks}/{p.totalTasks} 个任务</span>
                <span className="font-medium" style={{ color: p.color }}>{p.progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${p.progress}%`, background: p.color }} />
              </div>
            </div>
            <div className="mt-3 text-[11px] text-muted-foreground">
              {p.totalTasks === 0 ? "暂无任务" : p.status === "active" && p.daysRemaining !== null ? (p.daysRemaining < 0 ? <span className="text-destructive">已逾期 {-p.daysRemaining} 天</span> : `剩余 ${p.daysRemaining} 天`) : `截止 ${fmtDate(p.dueDate)}`}
            </div>
          </button>
        ))}
      </div>

      {/* 新建项目弹层 */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowNew(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">新建项目</h3>
              <button onClick={() => setShowNew(false)} className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
            </div>
            <div className="space-y-3">
              <input value={nName} onChange={(e) => setNName(e.target.value)} placeholder="项目名称（必填）"
                className="h-9 w-full rounded-lg border border-border bg-card px-2.5 text-xs focus:border-primary focus:outline-none" />
              <textarea value={nDesc} onChange={(e) => setNDesc(e.target.value)} placeholder="项目描述（可选）" rows={2}
                className="w-full rounded-lg border border-border bg-card px-2.5 py-2 text-xs focus:border-primary focus:outline-none" />
              <div className="flex items-center gap-2">
                {PALETTE.map((c) => (
                  <button key={c} onClick={() => setNColor(c)} className={"size-6 rounded-full transition " + (nColor === c ? "ring-2 ring-offset-1" : "opacity-70 hover:opacity-100")}
                    style={{ background: c, ...(nColor === c ? { boxShadow: `0 0 0 2px ${c}` } : {}) }} />
                ))}
                <input type="date" value={nDue} onChange={(e) => setNDue(e.target.value)} className="h-8 rounded-lg border border-border bg-card px-2 text-xs" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowNew(false)} className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-muted">取消</button>
                <button onClick={createProject} disabled={!nName.trim() || busy}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40">
                  <Check className="size-3.5" /> 创建
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}