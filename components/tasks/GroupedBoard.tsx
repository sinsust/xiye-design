"use client";

import { useMemo } from "react";
import { ArrowRight } from "lucide-react";

type TaskStatus = "todo" | "in_progress" | "done";
type GroupBy = "status" | "project" | "milestone" | "assignee";

interface GroupTask {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  priority: string;
  projectId: string | null;
  milestone?: string | null;
  assignee?: string | null;
}
interface ProjectLite {
  id: string;
  name: string;
  color: string;
}

const STATUS_LABEL: Record<TaskStatus, string> = { todo: "待处理", in_progress: "进行中", done: "已完成" };
const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
const PRIORITY_COLOR: Record<string, string> = { high: "#ef4444", medium: "#f59e0b", low: "#94a3b8" };
const STATUS_NEXT: Record<TaskStatus, TaskStatus> = { todo: "in_progress", in_progress: "done", done: "todo" };

function fmtDate(v: string | null): string {
  if (!v) return "";
  const d = new Date(v + "T00:00:00");
  return isNaN(d.getTime()) ? v : `${d.getMonth() + 1}/${d.getDate()}`;
}
function nowDate() {
  return new Date().toISOString().slice(0, 10);
}

export interface GroupedBoardProps {
  groupBy: GroupBy;
  tasks: GroupTask[];
  projects: ProjectLite[];
  openTask: (id: string) => void;
  onCycle: (id: string) => void;
}

export default function GroupedBoard({ groupBy, tasks, projects, openTask, onCycle }: GroupedBoardProps) {
  const projectName = useMemo(() => {
    const m = new Map(projects.map((p) => [p.id, p]));
    return (id: string | null) => (id ? m.get(id) : undefined);
  }, [projects]);

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; color: string | null; tasks: GroupTask[] }>();
    if (groupBy === "project") {
      for (const t of tasks) {
        const p = projectName(t.projectId);
        const key = p?.name || "无项目";
        if (!map.has(key)) map.set(key, { key, color: p?.color ?? "#94a3b8", tasks: [] });
        map.get(key)!.tasks.push(t);
      }
    } else if (groupBy === "milestone") {
      for (const t of tasks) {
        const key = t.milestone?.trim() || "无里程碑";
        if (!map.has(key)) map.set(key, { key, color: "#6366f1", tasks: [] });
        map.get(key)!.tasks.push(t);
      }
    } else {
      // assignee
      for (const t of tasks) {
        const key = t.assignee?.trim() || "未分配";
        if (!map.has(key)) map.set(key, { key, color: "#0ea5e9", tasks: [] });
        map.get(key)!.tasks.push(t);
      }
    }
    const arr = Array.from(map.values());
    arr.forEach((g) => g.tasks.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.id.localeCompare(b.id)));
    return arr;
  }, [tasks, groupBy, projectName]);

  const today = nowDate();

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {groups.length === 0 ? (
        <div className="w-full rounded-xl border border-dashed border-border/60 py-10 text-center text-xs text-muted-foreground">
          没有任务可按此维度分组
        </div>
      ) : (
        groups.map((g) => {
          const done = g.tasks.filter((t) => t.status === "done").length;
          const pct = g.tasks.length ? Math.round((done / g.tasks.length) * 100) : 0;
          return (
            <div key={g.key} className="flex min-w-[240px] max-w-[280px] flex-1 flex-col rounded-xl border border-border bg-muted/20 p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: g.color ?? "#94a3b8" }} />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{g.key}</span>
                <span className="text-[10px] text-muted-foreground">{g.tasks.length}</span>
              </div>
              {g.tasks.length > 0 && (
                <div className="mb-2 h-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: g.color ?? "#6366f1" }} />
                </div>
              )}
              <div className="space-y-2">
                {g.tasks.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border/60 py-4 text-center text-[11px] text-muted-foreground">暂无</div>
                )}
                {g.tasks.map((t) => {
                  const overdue = t.status !== "done" && !!t.dueDate && t.dueDate < today;
                  return (
                    <div key={t.id} className="group relative cursor-pointer rounded-lg border border-border bg-card p-2.5 pl-3.5 shadow-sm transition hover:border-primary/30"
                      onClick={() => openTask(t.id)}>
                      <span className="absolute inset-y-1.5 left-0 w-1 rounded-r" style={{ background: PRIORITY_COLOR[t.priority] }} />
                      <div className={"truncate pr-5 text-xs " + (t.status === "done" ? "text-muted-foreground line-through" : "text-foreground")}>
                        {t.title}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full" style={{ background: t.status === "done" ? "#22c55e" : t.status === "in_progress" ? "#3b82f6" : "#f59e0b" }} />
                        <span className="text-[10px] text-muted-foreground">{STATUS_LABEL[t.status]}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); onCycle(t.id); }}
                          title="切换状态"
                          className="ml-auto rounded p-0.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                        >
                          <ArrowRight className="size-3" />
                        </button>
                      </div>
                      {t.dueDate && (
                        <div className={"text-[10px] " + (overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                          {overdue ? "⚠ " : ""}{fmtDate(t.dueDate)}{overdue ? " 已过期" : ""}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}