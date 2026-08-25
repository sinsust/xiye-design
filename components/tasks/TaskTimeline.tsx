"use client";

type TaskStatus = "todo" | "in_progress" | "done";

export interface TimelineItem {
  id: string;
  action: string;
  detail: string | null;
  createdAt: number;
}

const STATUS_LABEL: Record<TaskStatus, string> = { todo: "待处理", in_progress: "进行中", done: "已完成" };

function fmtFull(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

interface Entry {
  icon: string;
  text: string;
  tone: string;
}
function describe(a: string, detail: string | null): Entry {
  if (a === "created") return { icon: "📌", text: "创建任务", tone: "text-foreground" };
  if (a === "status_changed") {
    try {
      const d = detail ? JSON.parse(detail) : null;
      const from = STATUS_LABEL[(d?.from as TaskStatus) ?? "todo"];
      const to = STATUS_LABEL[(d?.to as TaskStatus) ?? "todo"];
      return { icon: "🔄", text: `状态变更：${from} → ${to}`, tone: "text-foreground" };
    } catch {
      return { icon: "🔄", text: "状态变更", tone: "text-foreground" };
    }
  }
  if (a === "comment_added") return { icon: "💬", text: "添加备注", tone: "text-foreground" };
  if (a === "subtask_added") {
    try {
      const d = detail ? JSON.parse(detail) : null;
      return d?.parentTitle ? { icon: "➕", text: `完成/添加子任务：${d.parentTitle}`, tone: "text-foreground" } : { icon: "➕", text: "添加子任务", tone: "text-foreground" };
    } catch {
      return { icon: "➕", text: "添加子任务", tone: "text-foreground" };
    }
  }
  if (a === "dueDate_changed") {
    try {
      const d = detail ? JSON.parse(detail) : null;
      return { icon: "📅", text: `截止日期从 ${d?.from ?? "?"} 改为 ${d?.to ?? "?"}`, tone: "text-foreground" };
    } catch {
      return { icon: "📅", text: "截止日期变更", tone: "text-foreground" };
    }
  }
  return { icon: "●", text: a, tone: "text-foreground" };
}

export default function TaskTimeline({ items }: { items: TimelineItem[] }) {
  const sorted = [...items].reverse(); // 最新在上
  return (
    <div className="relative pl-5">
      <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border/70" />
      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 py-6 text-center text-[11px] text-muted-foreground">
          暂无历史记录
        </div>
      ) : (
        <div className="space-y-3.5">
          {sorted.map((it) => {
            const e = describe(it.action, it.detail);
            return (
              <div key={it.id} className="relative">
                <span className="absolute -left-[19px] top-0.5 size-2.5 rounded-full border border-white bg-primary shadow-sm" />
                <div className="text-[10px] text-muted-foreground">{fmtFull(it.createdAt)}</div>
                <div className={"text-xs " + e.tone}>
                  <span className="mr-1">{e.icon}</span>
                  {e.text}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}