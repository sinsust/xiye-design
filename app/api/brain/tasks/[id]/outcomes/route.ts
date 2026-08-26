import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  getBrainTaskById,
  getBrainProject,
  getBrainNote,
  listBrainTaskOutcomes,
  insertTaskOutcome,
  updateBrainTask,
} from "@/lib/brain-db";

export const runtime = "nodejs";

const STATUSES = ["resolved", "partial", "new_issue", "no_record"] as const;
type OutcomeStatus = (typeof STATUSES)[number];

function isStatus(v: unknown): v is OutcomeStatus {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}

// GET /api/brain/tasks/:id/outcomes
// 返回该任务的所有任务结果（严格按当前用户隔离）。
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const task = await getBrainTaskById(user.sub, id);
  if (!task) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const outcomes = await listBrainTaskOutcomes(user.sub, id);
  return NextResponse.json({ outcomes });
}

// POST /api/brain/tasks/:id/outcomes
// body: { status; summary?; detail?; markDone?: boolean }
// 行为：
//   - 校验任务所有权。
//   - 写入 outcome（projectId / noteId 取自任务既有归属）。
//   - 仅当 markDone 显式为 true 且任务未完成时才标记完成（不在隐藏副作用中更新）。
//   - 幂等：同任务+同状态+同摘要+去重窗口内重复提交返回既有结果。
// 约束：绝不直接创建新任务、提醒、笔记或项目关系。
// status = new_issue：只保存结果文本，返回 organize.sourcePayload 供前端走 organizeToPlan()。
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { id } = await ctx.params;
    const task = await getBrainTaskById(user.sub, id);
    if (!task) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const body = await req.json().catch(() => null);
    if (!body || !isStatus(body.status)) {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }
    const status = body.status as OutcomeStatus;
    const summary =
      typeof body.summary === "string" ? body.summary.trim().slice(0, 500) : "";
    // 无需记录仅作语义预留：允许空摘要但更鼓励不写结果
    if (status !== "no_record" && !summary) {
      return NextResponse.json({ error: "summary_required" }, { status: 400 });
    }

    // 唯一显式的任务完成：用户在同一操作中特意传入 markDone=true
    let updatedTask = task;
    if (body.markDone === true && task.status !== "done") {
      updatedTask = (await updateBrainTask(user.sub, id, { status: "done" })) ?? task;
    }

    const outcome = await insertTaskOutcome(user.sub, {
      taskId: id,
      status,
      summary,
      detail:
        typeof body.detail === "string" && body.detail.trim()
          ? body.detail.trim().slice(0, 4000)
          : null,
    });
    if (!outcome) {
      return NextResponse.json({ error: "create_failed" }, { status: 500 });
    }

    // 关联对象摘要（供前端跳转）
    const project = task.projectId
      ? await getBrainProject(user.sub, task.projectId)
      : null;
    const note = task.noteId ? await getBrainNote(user.sub, task.noteId) : null;

    // new_issue：仅保存结果文本，提供可发起 organizeToPlan() 的 source payload
    const organize =
      status === "new_issue"
        ? { content: [summary, outcome.detail].filter(Boolean).join("\n"), source: "task_outcome" }
        : null;

    return NextResponse.json({
      outcome,
      task: {
        id: updatedTask.id,
        status: updatedTask.status,
      },
      project: project ? { id: project.id, name: project.name, color: project.color } : null,
      note: note ? { id: note.id, title: note.title } : null,
      organize,
    });
  } catch (err) {
    console.error("brain task outcome create failed:", err);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}