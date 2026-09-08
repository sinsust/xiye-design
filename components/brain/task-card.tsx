import { ArrowRight, GripVertical, Target } from "lucide-react";
import type { DragEvent } from "react";
import type { BrainTask } from "@/lib/brain-db";
import {
  PRIORITY_COLOR,
  STATUS_LABEL,
  STATUS_NEXT,
  formatDueDate,
  nowDateStr,
} from "./brain-utils";
import type { BrainNote } from "./types";

export function TaskCard({
  task,
  note,
  strategyName,
  onCycle,
  onOpen,
  draggable,
  onDragStart,
}: {
  task: BrainTask;
  note?: BrainNote;
  strategyName?: string;
  onCycle: () => void;
  onOpen?: () => void;
  /** 看板拖拽换状态：可拖 + 抓手 */
  draggable?: boolean;
  onDragStart?: (e: DragEvent, id: string) => void;
}) {
  const overdue = task.status !== "done" && !!task.dueDate && task.dueDate < nowDateStr();
  return (
    <div
      onClick={onOpen}
      draggable={draggable}
      onDragStart={draggable && onDragStart ? (e) => onDragStart(e, task.id) : undefined}
      className={
        "group relative rounded-[var(--radius)] border border-border bg-card p-3 pl-4 shadow-sm transition hover:border-primary/30 " +
        (onOpen ? "cursor-pointer " : "") +
        (draggable ? "cursor-grab active:cursor-grabbing " : "")
      }
      title={draggable ? "拖拽到目标列以改变任务状态" : undefined}
    >
      {/* 拖拽抓手（仅看板拖拽模式显示） */}
      {draggable && (
        <span className="absolute right-1.5 top-1.5 flex items-center text-muted-foreground/50 transition group-hover:text-muted-foreground" aria-hidden>
          <GripVertical className="size-3" />
        </span>
      )}
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
              <span className="flex min-w-0 items-center gap-1 truncate"><Target className="size-3 shrink-0" />{strategyName}</span>
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
      {/* 「→」切换下一状态（拖拽模式下隐藏，拖拽即为换状态） */}
      {!draggable && (
        <button
          onClick={(ev) => { ev.stopPropagation(); onCycle(); }}
          title={`切换为 ${STATUS_LABEL[STATUS_NEXT[task.status]]}`}
          className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-[var(--radius)] text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
          aria-label="切换状态"
        >
          <ArrowRight className="size-3.5" />
        </button>
      )}
    </div>
  );
}