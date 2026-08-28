import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  getBrainTaskById,
  listBrainTasks,
  getBrainProject,
  getBrainNote,
  getBrainStrategy,
  listBrainTaskTimeline,
  listBrainTaskComments,
  listBrainRelations,
  listBrainProcessingPlans,
  listBrainTaskOutcomes,
  taskQualifiesForOutcome,
} from "@/lib/brain-db";

export const runtime = "nodejs";

// GET /api/brain/tasks/:id/detail
// 返回任务 + 项目 + 子任务 + 父任务 + 关联笔记/策略 + 时间线 + 评论
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const task = await getBrainTaskById(user.sub, id);
  if (!task) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const all = await listBrainTasks(user.sub);
  const subtasks = all
    .filter((t) => t.parentTaskId === id && !t.archived)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
  const parentTask = task.parentTaskId
    ? all.find((t) => t.id === task.parentTaskId) ?? null
    : null;
  const project = task.projectId ? await getBrainProject(user.sub, task.projectId) : null;
  const sourceNote = task.noteId ? await getBrainNote(user.sub, task.noteId) : null;
  // 其他引用该任务来源笔记的关联（策略来自任务自身或来源笔记）
  const strategy = task.strategyId ? await getBrainStrategy(user.sub, task.strategyId) : null;
  const timeline = await listBrainTaskTimeline(user.sub, id);
  const comments = await listBrainTaskComments(user.sub, id);
  const outcomes = await listBrainTaskOutcomes(user.sub, id);

  const completedSubtasks = subtasks.filter((t) => t.status === "done").length;

  // —— P3-B：是否满足“记录结果”入口条件（复用可解释规则，避免与 lib 复制分叉）——
  const riskRelations = await listBrainRelations(user.sub, { kind: "task", id });
  const hasRiskRelation = riskRelations.some((r) =>
    r.type === "blocks_task" || r.type === "depends_on_task",
  );
  const plans = await listBrainProcessingPlans(user.sub, undefined, true);
  const hasSourcePlan = plans.some(
    (p) =>
      (p.taskIds?.includes(id) ?? false) ||
      (p.noteId !== null && p.noteId === task.noteId),
  );
  const canRecordOutcome = taskQualifiesForOutcome({
    hasProject: Boolean(task.projectId),
    priority: task.priority,
    commentCount: comments.length,
    hasRiskRelation,
    hasSourcePlan,
  });

  return NextResponse.json({
    task: {
      id: task.id,
      title: task.title,
      status: task.status,
      dueDate: task.dueDate,
      assignee: task.assignee,
      milestone: task.milestone,
      projectId: task.projectId,
      noteId: task.noteId,
      priority: task.priority,
    },
    project: project ? { id: project.id, name: project.name, color: project.color, status: project.status } : null,
    subtasks: subtasks.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      dueDate: s.dueDate,
      sortOrder: s.sortOrder,
      priority: s.priority,
    })),
    subtaskProgress: {
      total: subtasks.length,
      completed: completedSubtasks,
    },
    parentTask: parentTask ? { id: parentTask.id, title: parentTask.title, status: parentTask.status } : null,
    relatedNotes: sourceNote ? [{ id: sourceNote.id, title: sourceNote.title, source: sourceNote.source }] : [],
    relatedStrategy: strategy ? { id: strategy.id, name: strategy.title } : null,
    timeline,
    comments,
    canRecordOutcome,
    outcomes: outcomes.map((o) => ({
      id: o.id,
      taskId: o.taskId,
      status: o.status,
      summary: o.summary,
      detail: o.detail,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    })),
  });
}