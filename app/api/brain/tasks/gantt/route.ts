import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listBrainTasks, listBrainProjects, type BrainTask } from "@/lib/brain-db";

export const runtime = "nodejs";

function toDayStr(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}
function progressOf(t: BrainTask): number {
  if (t.status === "done") return 100;
  if (t.status === "in_progress") return 50;
  return 0;
}
function milestoneStatus(tasks: BrainTask[]): "completed" | "doing" | "not_started" {
  if (tasks.length && tasks.every((t) => t.status === "done")) return "completed";
  if (tasks.some((t) => t.status === "in_progress")) return "doing";
  return "not_started";
}

// GET /api/brain/tasks/gantt
// 只返回有 startDate 或 dueDate 的任务（含顶层 + 子任务），附里程碑汇总。
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [tasks, projects] = await Promise.all([listBrainTasks(user.sub), listBrainProjects(user.sub)]);
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const dated = tasks
    .filter((t) => t.startDate || t.dueDate)
    .map((t) => {
      const p = t.projectId ? projectMap.get(t.projectId) : undefined;
      return {
        id: t.id,
        title: t.title,
        startDate: t.startDate ?? toDayStr(t.createdAt),
        dueDate: t.dueDate ?? t.startDate ?? toDayStr(t.createdAt),
        status: t.status,
        projectId: t.projectId,
        projectName: p?.name ?? null,
        projectColor: p?.color ?? null,
        milestone: t.milestone,
        parentTaskId: t.parentTaskId,
        priority: t.priority,
        progress: progressOf(t),
      };
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.dueDate.localeCompare(b.dueDate));

  // 里程碑汇总：按 milestone 名聚合有日期的任务
  const milestonesMap = new Map<string, { name: string; dueDate: string; tasks: BrainTask[] }>();
  for (const t of tasks) {
    if (!t.milestone?.trim()) continue;
    if (!milestonesMap.has(t.milestone)) milestonesMap.set(t.milestone, { name: t.milestone, dueDate: "", tasks: [] });
    const group = milestonesMap.get(t.milestone)!;
    group.tasks.push(t);
    if (t.dueDate && (!group.dueDate || t.dueDate > group.dueDate)) group.dueDate = t.dueDate;
  }
  const milestones = Array.from(milestonesMap.values())
    .map((g) => ({
      name: g.name,
      dueDate: g.dueDate,
      status: milestoneStatus(g.tasks),
      taskCount: g.tasks.length,
      completedCount: g.tasks.filter((t) => t.status === "done").length,
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return NextResponse.json({ tasks: dated, milestones });
}