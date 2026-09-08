import {
  STRATEGY_COLOR,
  STRATEGY_LABEL,
  STRATEGY_NEXT,
  nowDateStr,
  formatDueDate,
} from "../brain-utils";
import { useState } from "react";
import { Trash2, ClipboardList, RotateCcw } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { BrainStrategy, BrainTask } from "@/lib/brain-db";

export interface StrategiesTabProps {
  strategies: BrainStrategy[];
  expandedStrategy: string | null;
  setExpandedStrategy: (value: string | null) => void;
  strategyTaskStats: Map<string, { total: number; done: number }>;
  tasks: BrainTask[];
  cycleStrategyStatus: (id: string) => Promise<void>;
  deleteStrategy: (id: string) => Promise<void>;
}

export function StrategiesTab({
  strategies,
  expandedStrategy,
  setExpandedStrategy,
  strategyTaskStats,
  tasks,
  cycleStrategyStatus,
  deleteStrategy,
}: StrategiesTabProps) {
  // 待确认删除的策略（弹窗二次确认）
  const [pendingDelete, setPendingDelete] = useState<BrainStrategy | null>(null);
  return (
    <div className="mt-3">
      {strategies.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
          还没有策略。在「记一笔」里投入一份会议纪要，AI 会自动拆解出长期策略与任务。
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {strategies.map((s) => {
            const open = expandedStrategy === s.id;
            const stats = strategyTaskStats.get(s.id) ?? { total: 0, done: 0 };
            const sTasks = tasks.filter((t) => t.strategyId === s.id);
            return (
              <div key={s.id} className="rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setExpandedStrategy(open ? null : s.id)}
                  >
                    <div className="flex items-center gap-2">
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
                      {stats.total} 个任务 · {stats.done} 已完成
                    </span>
                  </div>
                </div>
                <div className="mt-1.5 flex items-start justify-between gap-2">
                  <p className="line-clamp-2 min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
                    {s.description || "暂无描述"}
                  </p>
                  <div className="flex shrink-0 items-center gap-0.5">
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
                {open && (
                  <div className="mt-3 border-t border-border/70 pt-2.5">
                    <div className="mb-1.5 text-[11px] font-semibold text-foreground">
                      关联任务（{sTasks.length}）
                    </div>
                    {sTasks.length === 0 && (
                      <div className="text-[11px] text-muted-foreground">暂无关联任务</div>
                    )}
                    <ul className="space-y-1">
                      {sTasks.map((tk) => (
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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
                删除后关联任务仍会保留（其策略归属将被清空），<span className="text-destructive">该操作不可撤销</span>。
              </p>
            </div>
          }
        />
      )}
    </div>
  );
}