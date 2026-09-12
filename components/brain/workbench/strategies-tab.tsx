import {
  STRATEGY_COLOR,
  STRATEGY_LABEL,
  STRATEGY_NEXT,
  nowDateStr,
  formatDueDate,
} from "../brain-utils";
import { useState } from "react";
import { Trash2, ClipboardList, RotateCcw, ChevronRight } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { BrainStrategy, BrainTask } from "@/lib/brain-db";

export interface StrategiesTabProps {
  strategies: BrainStrategy[];
  expandedStrategy: string | null;
  setExpandedStrategy: (value: string | null) => void;
  tasks: BrainTask[];
  cycleStrategyStatus: (id: string) => Promise<void>;
  deleteStrategy: (id: string) => Promise<void>;
}

/**
 * 策略工作台：主题（目标 + 取舍）→ 子策略 → 任务 两层展示。
 * 只把 kind==="theme" 的条目作为顶层卡片，子策略嵌在主题内，不再平铺成一堆并列条目。
 */
export function StrategiesTab({
  strategies,
  expandedStrategy,
  setExpandedStrategy,
  tasks,
  cycleStrategyStatus,
  deleteStrategy,
}: StrategiesTabProps) {
  // 待确认删除的策略（弹窗二次确认）
  const [pendingDelete, setPendingDelete] = useState<BrainStrategy | null>(null);

  const themes = strategies.filter((s) => s.kind === "theme");
  const subsOf = (themeId: string) =>
    strategies.filter((s) => s.parentId === themeId).sort((a, b) => a.sortOrder - b.sortOrder);
  const tasksOf = (id: string) => tasks.filter((t) => t.strategyId === id);
  const doneCount = (list: BrainTask[]) => list.filter((t) => t.status === "done").length;

  if (themes.length === 0) {
    return (
      <div className="mt-3">
        <div className="rounded-[var(--radius)] border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
          还没有策略。AI 只在识别到「明确目标 + 取舍判断 + 需要多步骤推进」时才会提炼策略主题，
          观点与一次性动作不会进这里。
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="grid grid-cols-1 gap-3">
        {themes.map((s) => {
          const open = expandedStrategy === s.id;
          const subs = subsOf(s.id);
          const ownTasks = tasksOf(s.id);
          const subTasks = subs.flatMap((sub) => tasksOf(sub.id));
          const all = [...ownTasks, ...subTasks];

          return (
            <div key={s.id} className="rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setExpandedStrategy(open ? null : s.id)}
                >
                  <div className="flex items-center gap-2">
                    <ChevronRight
                      className={"size-3.5 shrink-0 text-muted-foreground transition " + (open ? "rotate-90" : "")}
                    />
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
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <ClipboardList className="size-3.5" />
                    {doneCount(all)}/{all.length}
                  </span>
                  <button
                    onClick={() => cycleStrategyStatus(s.id)}
                    title={`切换为 ${STRATEGY_LABEL[STRATEGY_NEXT[s.status]]}`}
                    className="rounded-[var(--radius)] p-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                  >
                    <RotateCcw className="size-3.5" />
                  </button>
                  <button
                    onClick={() => setPendingDelete(s)}
                    title="删除策略"
                    className="rounded-[var(--radius)] p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-2 space-y-1">
                {s.goal && (
                  <p className="text-xs leading-relaxed text-foreground">
                    <span className="text-muted-foreground">目标 · </span>
                    {s.goal}
                  </p>
                )}
                {s.rationale && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    <span className="text-muted-foreground">判断 · </span>
                    {s.rationale}
                  </p>
                )}
              </div>

              {subs.length > 0 && (
                <ul className="mt-2.5 space-y-1.5 border-l border-border pl-3">
                  {subs.map((sub) => {
                    const st = tasksOf(sub.id);
                    return (
                      <li key={sub.id} className="text-xs">
                        <div className="flex items-baseline gap-2">
                          <span className="min-w-0 flex-1 text-foreground">{sub.title}</span>
                          {st.length > 0 && (
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {doneCount(st)}/{st.length}
                            </span>
                          )}
                        </div>
                        {sub.description && (
                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                            {sub.description}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {open && (
                <div className="mt-3 border-t border-border/70 pt-2.5">
                  {all.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground">
                      暂无关联任务（原文没识别到明确待办时不会硬造任务）
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {ownTasks.length > 0 && (
                        <div>
                          <div className="mb-1 text-[11px] font-semibold text-foreground">
                            主题级任务（{ownTasks.length}）
                          </div>
                          <TaskList items={ownTasks} />
                        </div>
                      )}
                      {subs
                        .filter((sub) => tasksOf(sub.id).length > 0)
                        .map((sub) => (
                          <div key={sub.id}>
                            <div className="mb-1 text-[11px] font-semibold text-foreground">
                              {sub.title}（{tasksOf(sub.id).length}）
                            </div>
                            <TaskList items={tasksOf(sub.id)} />
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 删除策略确认弹窗（统一二次确认样式） */}
      {pendingDelete && (
        <ConfirmDialog
          open
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            void deleteStrategy(pendingDelete.id);
            setPendingDelete(null);
          }}
          title={
            <span className="flex items-center gap-2 text-sm">
              <Trash2 className="size-4 text-destructive" /> 删除这个策略？
            </span>
          }
          body={
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <p className="line-clamp-2 text-sm font-medium text-foreground">{pendingDelete.title}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {subsOf(pendingDelete.id).length > 0
                  ? `连同其下 ${subsOf(pendingDelete.id).length} 条子策略一并删除；`
                  : ""}
                关联任务仍会保留（其策略归属将被清空），
                <span className="text-destructive">该操作不可撤销</span>。
              </p>
            </div>
          }
        />
      )}
    </div>
  );
}

function TaskList({ items }: { items: BrainTask[] }) {
  return (
    <ul className="space-y-1">
      {items.map((tk) => (
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
  );
}
