import { Columns3, LayoutList } from "lucide-react";
import GanttView from "@/components/GanttView";
import GroupedBoard from "@/components/tasks/GroupedBoard";
import {
  STRATEGY_COLOR,
  STATUS_LABEL,
  PRIORITY_RANK,
  inputCls,
} from "../brain-utils";
import type { BrainStrategy, BrainTask, BrainTaskStatus } from "@/lib/brain-db";
import type { BrainNote } from "../types";
import { TaskCard } from "../task-card";

export interface KanbanTabProps {
  kanbanView: "board" | "gantt";
  setKanbanView: (value: "board" | "gantt") => void;
  kanbanGroup: "status" | "project" | "milestone" | "assignee" | "strategy";
  setKanbanGroup: (value: "status" | "project" | "milestone" | "assignee" | "strategy") => void;
  tasks: BrainTask[];
  projects: { id: string; name: string; color: string }[];
  notes: BrainNote[];
  strategies: BrainStrategy[];
  strategyFilter: string;
  setStrategyFilter: (value: string) => void;
  strategyMap: Map<string, BrainStrategy>;
  tasksByStrategyGroup: { groups: Map<string, BrainTask[]>; unassigned: BrainTask[] };
  boardTasks: BrainTask[];
  overdueTasks: BrainTask[];
  cycleTask: (id: string) => Promise<void>;
  setDetailTaskId: (id: string | null) => void;
  loadTasks: () => Promise<void>;
  loadProjects: () => Promise<void>;
}

export function KanbanTab({
  kanbanView,
  setKanbanView,
  kanbanGroup,
  setKanbanGroup,
  tasks,
  projects,
  notes,
  strategies,
  strategyFilter,
  setStrategyFilter,
  strategyMap,
  tasksByStrategyGroup,
  boardTasks,
  overdueTasks,
  cycleTask,
  setDetailTaskId,
  loadTasks,
  loadProjects,
}: KanbanTabProps) {
  return (
    <div className="mt-3">
      {/* 看板 / 甘特图 视图切换 */}
      <div className="mb-3 flex items-center gap-1">
        {[
          { k: "board" as const, label: "看板", icon: <Columns3 className="size-3" /> },
          { k: "gantt" as const, label: "甘特图", icon: <LayoutList className="size-3" /> },
        ].map((v) => (
          <button
            key={v.k}
            onClick={() => setKanbanView(v.k)}
            className={
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition " +
              (kanbanView === v.k ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")
            }
          >
            {v.icon}
            {v.label}
          </button>
        ))}
      </div>

      {kanbanView === "gantt" ? (
        <GanttView
          openTask={(id) => setDetailTaskId(id)}
          onChanged={() => {
            loadTasks();
            loadProjects();
          }}
        />
      ) : (
        <>
          {/* 分组切换：状态 / 项目 / 里程碑 / 负责人 / 策略（唯一的“分组”维度） */}
          <div className="mb-2 flex flex-wrap items-center gap-1">
            {[
              { k: "status" as const, label: "按状态" },
              { k: "project" as const, label: "按项目" },
              { k: "milestone" as const, label: "按里程碑" },
              { k: "assignee" as const, label: "按负责人" },
              { k: "strategy" as const, label: "按策略" },
            ].map((g) => (
              <button
                key={g.k}
                onClick={() => setKanbanGroup(g.k)}
                className={
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition " +
                  (kanbanGroup === g.k ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")
                }
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* 全局策略过滤：仅看某策略（对所有分组生效，不随分组切换消失） */}
          <div className="mb-3 flex items-center gap-1.5">
            <span className="shrink-0 text-[11px] text-muted-foreground">仅看</span>
            <select
              value={strategyFilter}
              onChange={(ev) => setStrategyFilter(ev.target.value)}
              className={inputCls + " w-auto text-xs"}
            >
              <option value="all">全部策略</option>
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>

          {/* 分组渲染：按策略 / 按状态 / 项目·里程碑·负责人 */}
          {kanbanGroup === "strategy" ? (
            (() => {
              // 仅看某策略时只显示该策略的分组（未关联策略随之归零）
              const view =
                strategyFilter === "all"
                  ? tasksByStrategyGroup
                  : {
                      groups: new Map(
                        tasksByStrategyGroup.groups.has(strategyFilter)
                          ? [[strategyFilter, tasksByStrategyGroup.groups.get(strategyFilter)!]]
                          : [],
                      ),
                      unassigned: [] as BrainTask[],
                    };
              return (
                <div className="space-y-3">
                  {[...view.groups.entries()].map(([sid, st]) => {
                    const s = strategyMap.get(sid);
                    const grouped = st.filter((t) => t.status !== "done").length;
                    const doneCount = st.length - grouped;
                    return (
                      <div key={sid} className="rounded-[var(--radius)] border border-border bg-card p-3">
                        <div className="mb-2 flex items-center gap-2">
                          <span
                            className="inline-block size-1.5 rounded-full"
                            style={{ background: s ? STRATEGY_COLOR[s.status] : "#94a3b8" }}
                          />
                          <span className="text-xs font-semibold text-foreground">{s?.title ?? "未知策略"}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            {grouped} 待办 · {doneCount} 已完成
                          </span>
                        </div>
                        <div className="space-y-2">
                          {st.length === 0 && (
                            <div className="rounded-[var(--radius)] border border-dashed border-border/60 py-4 text-center text-[11px] text-muted-foreground">
                              暂无任务
                            </div>
                          )}
                          {st.map((t) => (
                            <TaskCard
                              key={t.id}
                              task={t}
                              note={notes.find((n) => n.id === t.noteId)}
                              strategyName={s?.title}
                              onCycle={() => cycleTask(t.id)}
                              onOpen={() => setDetailTaskId(t.id)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {view.unassigned.length > 0 && (
                    <div className="rounded-[var(--radius)] border border-dashed border-border/60 bg-muted/20 p-3">
                      <div className="mb-2 text-xs font-semibold text-muted-foreground">未关联策略</div>
                      <div className="space-y-2">
                        {view.unassigned.map((t) => (
                          <TaskCard
                            key={t.id}
                            task={t}
                            note={notes.find((n) => n.id === t.noteId)}
                            onCycle={() => cycleTask(t.id)}
                            onOpen={() => setDetailTaskId(t.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          ) : kanbanGroup === "status" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(["todo", "in_progress", "done"] as BrainTaskStatus[]).map((st) => {
                const col = boardTasks
                  .filter((t) => t.status === st)
                  .sort(
                    (a, b) =>
                      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
                      a.createdAt - b.createdAt,
                  );
                return (
                  <div key={st} className="rounded-[var(--radius)] border border-border bg-muted/20 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">{STATUS_LABEL[st]}</span>
                      <span className="rounded-full bg-card px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                        {col.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {col.length === 0 && (
                        <div className="rounded-[var(--radius)] border border-dashed border-border/60 py-5 text-center text-[11px] text-muted-foreground">
                          暂无
                        </div>
                      )}
                      {col.map((t) => (
                        <TaskCard
                          key={t.id}
                          task={t}
                          note={notes.find((n) => n.id === t.noteId)}
                          strategyName={strategyMap.get(t.strategyId ?? "")?.title}
                          onCycle={() => cycleTask(t.id)}
                          onOpen={() => setDetailTaskId(t.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <GroupedBoard
              groupBy={kanbanGroup}
              tasks={boardTasks
                .filter((t) => !t.parentTaskId)
                .map((t) => ({ id: t.id, title: t.title, status: t.status, dueDate: t.dueDate, priority: t.priority, projectId: t.projectId, milestone: t.milestone, assignee: t.assignee }))}
              projects={projects}
              openTask={(id) => setDetailTaskId(id)}
              onCycle={cycleTask}
            />
          )}

          {overdueTasks.length > 0 && (
            <div className="mt-3 rounded-[var(--radius)] border border-dashed border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              ⚠️ {overdueTasks.length} 项任务已过截止日，建议尽快处理
            </div>
          )}

          {tasks.length === 0 && (
            <div className="mt-4 rounded-[var(--radius)] border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
              还提取不到任务。在「记一笔」里投入含待办内容的对话或想法，AI 会自动识别出任务。
            </div>
          )}
        </>
      )}
    </div>
  );
}