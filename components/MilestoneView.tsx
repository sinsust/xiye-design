"use client";

import { useMemo } from "react";

type TaskStatus = "todo" | "in_progress" | "done";
interface MilestoneTask {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  milestone: string | null;
  priority: string;
}

export interface MilestoneViewProps {
  projectName: string;
  tasks: MilestoneTask[];
  openTask: (id: string) => void;
  onCycle: (id: string) => void;
}

const STATUS_LABEL: Record<TaskStatus, string> = { todo: "待处理", in_progress: "进行中", done: "已完成" };

type Ms = "completed" | "doing" | "not_started";
const M_LABEL: Record<Ms, string> = { completed: "已完成", doing: "进行中", not_started: "未开始" };
const M_COLOR: Record<Ms, string> = { completed: "#22c55e", doing: "#f59e0b", not_started: "#94a3b8" };
const PRIORITY_COLOR: Record<string, string> = { high: "#ef4444", medium: "#f59e0b", low: "#94a3b8" };

function fmtDate(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return isNaN(dt.getTime()) ? d : `${dt.getMonth() + 1}/${dt.getDate()}`;
}
function msOf(items: { status: TaskStatus }[]): Ms {
  if (items.length && items.every((t) => t.status === "done")) return "completed";
  if (items.some((t) => t.status === "in_progress")) return "doing";
  return "not_started";
}

export default function MilestoneView({ projectName, tasks, openTask, onCycle }: MilestoneViewProps) {
  // 按里程碑分组
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; dueDate: string | null; items: MilestoneTask[] }>();
    for (const t of tasks) {
      const name = t.milestone?.trim() || "其他任务";
      if (!map.has(name)) map.set(name, { name, dueDate: t.dueDate, items: [] });
      const g = map.get(name)!;
      g.items.push(t);
      if (t.dueDate && (!g.dueDate || t.dueDate > g.dueDate)) g.dueDate = t.dueDate;
    }
    return Array.from(map.values()).sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  }, [tasks]);

  return (
    <div className="relative pl-6">
      {/* 纵向时间轴竖线 */}
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border/70" />

      <div className="space-y-6">
        {groups.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/60 py-8 text-center text-xs text-muted-foreground">
            该项目暂无里程碑。为任务设置「里程碑」后，可在这里按阶段查看推进进度。
          </div>
        )}
        {groups.map((g) => {
          const st = msOf(g.items);
          const done = g.items.filter((t) => t.status === "done").length;
          const pct = g.items.length ? Math.round((done / g.items.length) * 100) : 0;
          const overdue = st !== "completed" && !!g.dueDate && g.dueDate < new Date().toISOString().slice(0, 10);
          return (
            <div key={g.name} className="relative">
              {/* 节点圆点 */}
              <span className="absolute -left-[24px] top-1 size-3 rounded-full border-2 border-white shadow" style={{ background: M_COLOR[st] }} />
              {/* 里程碑头 */}
              <div className="flex items-center gap-2 rounded-lg px-1">
                <span className="text-sm font-semibold text-foreground">◆ {g.name}</span>
                {g.dueDate && (
                  <span className={"text-[11px] " + (overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                    截止 {fmtDate(g.dueDate)} {overdue ? "· 已逾期" : ""}
                  </span>
                )}
                <span className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ background: `${M_COLOR[st]}1a`, color: M_COLOR[st] }}>
                  {done}/{g.items.length} · {M_LABEL[st]}
                </span>
              </div>
              {/* 里程碑进度 */}
              <div className="mt-1.5 mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: M_COLOR[st] }} />
              </div>
              {/* 里程碑下任务 */}
              <div className="mt-1 space-y-1.5">
                {g.items.map((t) => (
                  <div key={t.id} className="group flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5">
                    <span className="h-4 w-1 rounded" style={{ background: PRIORITY_COLOR[t.priority] ?? "#94a3b8" }} />
                    <button onClick={() => openTask(t.id)} className="min-w-0 flex-1 truncate text-left text-xs text-foreground transition hover:text-primary">
                      {t.title}
                    </button>
                    {t.dueDate && <span className="shrink-0 text-[10px] text-muted-foreground">{fmtDate(t.dueDate)}</span>}
                    <button
                      onClick={() => onCycle(t.id)}
                      className={"shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium transition " +
                        (t.status === "done" ? "bg-primary/10 text-primary" : "bg-card text-muted-foreground hover:bg-primary/10 hover:text-primary")}
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
    </div>
  );
}