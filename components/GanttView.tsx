"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Gantt, ViewMode } from "gantt-task-react";
import type { Task } from "gantt-task-react";
import "gantt-task-react/dist/index.css";

type TaskStatus = "todo" | "in_progress" | "done";

interface GanttTask {
  id: string;
  title: string;
  startDate: string;
  dueDate: string;
  status: TaskStatus;
  projectId: string | null;
  projectName: string | null;
  projectColor: string | null;
  milestone: string | null;
  parentTaskId: string | null;
  progress: number;
}

interface GanttData {
  tasks: GanttTask[];
  milestones: { name: string; dueDate: string; status: string; taskCount: number; completedCount: number }[];
}

const STATUS_LABEL: Record<TaskStatus, string> = { todo: "待处理", in_progress: "进行中", done: "已完成" };

function dayStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayStr(): string {
  return dayStr(new Date());
}

export interface GanttViewProps {
  openTask: (id: string) => void;
  onChanged: () => void;
}

export default function GanttView({ openTask, onChanged }: GanttViewProps) {
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [undatedCount, setUndatedCount] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Week);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/brain/tasks/gantt");
      if (res.ok) {
        const d: GanttData = await res.json();
        if (Array.isArray(d.tasks)) setTasks(d.tasks);
      }
      const allRes = await fetch("/api/brain/tasks");
      if (allRes.ok) {
        const all = await allRes.json();
        if (Array.isArray(all.tasks)) {
          setUndatedCount(all.tasks.filter((t: GanttTask) => !t.startDate && !t.dueDate).length);
        }
      }
    } catch {
      /* 忽略 */
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const ganttTasks = useMemo<Task[]>(() => {
    const today = todayStr();
    const byProject = new Map<string, GanttTask[]>();
    // 未设置日期的任务不进甘特图（按 startDate / dueDate 是否可解析过滤）
    for (const t of tasks) {
      if (!t.startDate || !t.dueDate) continue;
      const key = t.projectId ?? "__none__";
      if (!byProject.has(key)) byProject.set(key, []);
      byProject.get(key)!.push(t);
    }

    const out: Task[] = [];
    for (const [pid, list] of byProject) {
      const projName = list[0].projectName ?? "无项目";
      // 排序后取项目跨度
      const sorted = [...list].sort((a, b) => a.startDate.localeCompare(b.startDate));
      const projStart = new Date(sorted[0].startDate + "T00:00:00");
      const projEnd = new Date(
        sorted.reduce((max, t) => (t.dueDate > max ? t.dueDate : max), list[0].dueDate) + "T00:00:00",
      );
      const color = sorted[0].projectColor ?? "#3B82F6";
      out.push({
        id: `prj-${pid}`,
        type: "project",
        name: projName,
        start: projStart,
        end: projEnd,
        progress: 0,
        hideChildren: false,
        styles: { backgroundColor: color, progressColor: "#10B981" },
      });
      for (const t of sorted) {
        const start = new Date(t.startDate + "T00:00:00");
        const end = new Date(t.dueDate + "T00:00:00");
        const overdue = t.status !== "done" && t.dueDate < today;
        const isMilestone = !!t.milestone;
        out.push({
          id: t.id,
          type: isMilestone ? "milestone" : "task",
          name: isMilestone ? `◆ ${t.milestone}` : t.title,
          start,
          end,
          progress: t.progress,
          project: pid,
          isDisabled: t.status === "done",
          styles: {
            backgroundColor: overdue ? "#EF4444" : color,
            progressColor: "#10B981",
          },
          ...(t.parentTaskId ? { dependencies: [t.parentTaskId] } : {}),
        });
      }
    }
    return out;
  }, [tasks]);

  const handleDateChange = useCallback(
    async (task: Task) => {
      setSavingId(task.id);
      try {
        const res = await fetch(`/api/brain/tasks?id=${task.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: dayStr(task.start), dueDate: dayStr(task.end) }),
        });
        if (res.ok) {
          await load();
          onChanged();
        }
      } catch {
        /* 忽略 */
      } finally {
        setSavingId(null);
      }
    },
    [load, onChanged],
  );

  if (loading) {
    return <div className="rounded-xl border border-border bg-white p-6 text-sm text-muted-foreground shadow-sm">加载甘特图…</div>;
  }

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      {/* 顶部工具栏：缩放 + 未设置日期提示 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-foreground">📊 甘特图</span>
        <div className="ml-auto flex items-center gap-1">
          {[
            { v: ViewMode.Day, label: "日" },
            { v: ViewMode.Week, label: "周" },
            { v: ViewMode.Month, label: "月" },
          ].map((m) => (
            <button
              key={m.v}
              onClick={() => setViewMode(m.v)}
              className={"rounded-md px-2.5 py-1 text-[11px] font-medium transition " +
                (viewMode === m.v ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {ganttTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 py-10 text-center text-xs text-muted-foreground">
          还没有带日期的任务。为任务设置开始/结束日期后，即可在甘特图上规划排期。
        </div>
      ) : (
        <>
          {undatedCount > 0 && (
            <div className="mb-3 rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-700">
              {undatedCount} 个任务未设置日期，不会显示在甘特图中。可在「任务看板」打开任务详情补充日期。
            </div>
          )}
          <div style={{ overflowX: "auto", maxWidth: "100%" }}>
          <Gantt
            tasks={ganttTasks}
            viewMode={viewMode}
            onDateChange={handleDateChange}
            onDoubleClick={(t) => {
              if (!t.id.startsWith("prj-")) openTask(t.id);
            }}
            onExpanderClick={handleDateChangeNoop}
            todayColor="#EF4444"
            barFill={70}
            columnWidth={viewMode === ViewMode.Month ? 240 : viewMode === ViewMode.Week ? 60 : 40}
            listCellWidth="160px"
          />
          </div>
        </>
      )}
      {savingId && <div className="mt-2 text-[11px] text-muted-foreground">正在保存排期…</div>}
    </div>
  );
}

// gantt-task-react 要求提供 expander 回调；我们允许折叠/展开项目行（保持默认无副作用）
function handleDateChangeNoop() {
  /* 交给组件默认行为 */
}