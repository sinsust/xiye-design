"use client";

import { useCallback, useEffect, useMemo, useState, type FC } from "react";
import { Gantt, ViewMode } from "gantt-task-react";
import type { Task } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import "./gantt-overrides.css";

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

// 柔和、设计感调色板（Emerald→Teal 为主线，辅以低饱和冷色），按项目分配，避免生硬大红亮蓝
const PROJ_PALETTE = [
  "#10B981", // emerald
  "#14B8A6", // teal
  "#6366F1", // indigo
  "#0EA5E9", // sky
  "#8B5CF6", // violet
  "#F59E0B", // amber
  "#EC4899", // pink
  "#84CC16", // lime
  "#06B6D4", // cyan
  "#F43F5E", // rose
];
const OVERDUE_BG = "#F87171"; // 逾期：柔和红，区别于普通任务的品牌色
const OVERDUE_PROGRESS = "#EF4444";
const TODAY_LINE = "#14B8A6"; // 今日线：teal，信息性而非告警

function dayStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayStr(): string {
  return dayStr(new Date());
}
// 中文日期：2026年8月26日（清晰无歧义，不依赖 locale 缓存）
function fmtDateCN(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export interface GanttViewProps {
  openTask: (id: string) => void;
  onChanged: () => void;
}

// —— 自定义任务列表表头：Name / From / To → 名称 / 开始 / 结束 ——
const TaskListHeaderCN: FC<{
  headerHeight: number;
  rowWidth: string;
  fontFamily: string;
  fontSize: string;
}> = ({ headerHeight, rowWidth, fontFamily, fontSize }) => (
  <div
    className="gantt-cn-header"
    style={{ fontFamily, fontSize, height: headerHeight }}
  >
    <div className="gantt-cn-header-cell" style={{ minWidth: rowWidth }}>名称</div>
    <div className="gantt-cn-header-sep" style={{ height: headerHeight * 0.5, marginTop: headerHeight * 0.25 }} />
    <div className="gantt-cn-header-cell" style={{ minWidth: rowWidth }}>开始</div>
    <div className="gantt-cn-header-sep" style={{ height: headerHeight * 0.5, marginTop: headerHeight * 0.25 }} />
    <div className="gantt-cn-header-cell" style={{ minWidth: rowWidth }}>结束</div>
  </div>
);

// —— 自定义任务列表表格：日期中文化 + 展开符号保留 ——
const TaskListTableCN: FC<{
  rowHeight: number;
  rowWidth: string;
  fontFamily: string;
  fontSize: string;
  locale: string;
  tasks: Task[];
  selectedTaskId: string;
  setSelectedTask: (taskId: string) => void;
  onExpanderClick: (task: Task) => void;
}> = ({ rowHeight, rowWidth, tasks, onExpanderClick }) => (
  <div className="gantt-cn-table">
    {tasks.map((t) => {
      const expander = t.hideChildren === false ? "▼" : t.hideChildren === true ? "▶" : "";
      return (
        <div className="gantt-cn-row" style={{ height: rowHeight }} key={t.id + "row"}>
          <div className="gantt-cn-cell gantt-cn-name" style={{ minWidth: rowWidth, maxWidth: rowWidth }} title={t.name}>
            <span
              className={expander ? "gantt-cn-expander" : "gantt-cn-expander-empty"}
              onClick={() => onExpanderClick(t)}
            >
              {expander}
            </span>
            <span className="gantt-cn-name-text">{t.name}</span>
          </div>
          <div className="gantt-cn-cell" style={{ minWidth: rowWidth, maxWidth: rowWidth }}>
            {fmtDateCN(t.start)}
          </div>
          <div className="gantt-cn-cell" style={{ minWidth: rowWidth, maxWidth: rowWidth }}>
            {fmtDateCN(t.end)}
          </div>
        </div>
      );
    })}
  </div>
);

// —— 自定义悬停提示：英文日期 + Duration/Progress → 中文 ——
const TooltipCN: FC<{ task: Task; fontSize: string; fontFamily: string }> = ({
  task,
  fontSize,
  fontFamily,
}) => {
  const days = ~~((task.end.getTime() - task.start.getTime()) / (1000 * 60 * 60 * 24));
  return (
    <div className="gantt-cn-tooltip" style={{ fontSize, fontFamily }}>
      <b className="gantt-cn-tooltip-title">
        {task.name}：{fmtDateCN(task.start)} - {fmtDateCN(task.end)}
      </b>
      {task.end.getTime() - task.start.getTime() !== 0 && (
        <p className="gantt-cn-tooltip-line">工期：{days} 天</p>
      )}
      {!!task.progress && <p className="gantt-cn-tooltip-line">进度：{task.progress}%</p>}
    </div>
  );
};

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
    for (const t of tasks) {
      if (!t.startDate || !t.dueDate) continue;
      const key = t.projectId ?? "__none__";
      if (!byProject.has(key)) byProject.set(key, []);
      byProject.get(key)!.push(t);
    }

    // 按项目顺序分配柔和调色板
    const projColorMap = new Map<string, string>();
    Array.from(byProject.keys()).forEach((pid, i) => {
      projColorMap.set(pid, PROJ_PALETTE[i % PROJ_PALETTE.length]);
    });

    const out: Task[] = [];
    for (const [pid, list] of byProject) {
      const projName = list[0].projectName ?? "无项目";
      const sorted = [...list].sort((a, b) => a.startDate.localeCompare(b.startDate));
      const projStart = new Date(sorted[0].startDate + "T00:00:00");
      const projEnd = new Date(
        sorted.reduce((max, t) => (t.dueDate > max ? t.dueDate : max), list[0].dueDate) + "T00:00:00",
      );
      const color = projColorMap.get(pid) ?? PROJ_PALETTE[0];
      out.push({
        id: `prj-${pid}`,
        type: "project",
        name: projName,
        start: projStart,
        end: projEnd,
        progress: 0,
        hideChildren: false,
        styles: { backgroundColor: color, progressColor: "#0F766E" },
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
            backgroundColor: overdue ? OVERDUE_BG : color,
            progressColor: overdue ? OVERDUE_PROGRESS : "#0F766E",
            backgroundSelectedColor: overdue ? "#FCA5A5" : "#0D9488",
            progressSelectedColor: "#0F766E",
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
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        加载甘特图…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
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
              className={
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition " +
                (viewMode === m.v
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted dark:hover:bg-slate-800")
              }
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {ganttTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 py-10 text-center text-xs text-muted-foreground dark:border-slate-700">
          还没有带日期的任务。为任务设置开始/结束日期后，即可在甘特图上规划排期。
        </div>
      ) : (
        <>
          {undatedCount > 0 && (
            <div className="mb-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-1.5 text-[11px] text-warning dark:border-warning/30 dark:bg-warning/10 dark:text-warning">
              {undatedCount} 个任务未设置日期，不会显示在甘特图中。可在「任务看板」打开任务详情补充日期。
            </div>
          )}
          <div className="gantt-cn" style={{ overflowX: "auto", maxWidth: "100%" }}>
            <Gantt
              tasks={ganttTasks}
              viewMode={viewMode}
              locale="zh-CN"
              onDateChange={handleDateChange}
              onDoubleClick={(t) => {
                if (!t.id.startsWith("prj-")) openTask(t.id);
              }}
              onExpanderClick={handleDateChangeNoop}
              todayColor={TODAY_LINE}
              rowHeight={56}
              headerHeight={48}
              barCornerRadius={6}
              barFill={58}
              fontSize="12px"
              fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
              columnWidth={viewMode === ViewMode.Month ? 240 : viewMode === ViewMode.Week ? 64 : 44}
              listCellWidth="180px"
              TaskListHeader={TaskListHeaderCN}
              TaskListTable={TaskListTableCN}
              TooltipContent={TooltipCN}
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
