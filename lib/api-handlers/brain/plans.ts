import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  applyProcessingPlan,
  parsePlanBody,
  listRecoverablePlans,
  listPendingRecoveryPlans,
  compensateProcessingPlan,
  markPlanHandled,
  retryProcessingPlan,
  cleanupProcessingPlans,
  type ProcessingEdits,
} from "@/lib/brain-plan";
import {
  getBrainProcessingPlan,
  getBrainNote,
  listBrainTasks,
  listBrainStrategies,
  listPendingBrainReminderItems,
  getBrainProject,
} from "@/lib/brain-db";

export const runtime = "nodejs";

// GET /api/brain/plans?id=<id>
// 审计/恢复：返回 plan + 解析后的 body + 已应用的产出对象（笔记/任务/策略/提醒/项目），拼出「原始来源→产出」链路。
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  const recoveryMode = req.nextUrl.searchParams.get("recovery") === "1";
  try {
    if (recoveryMode) {
      const recoveries = await listPendingRecoveryPlans(user.sub);
      return NextResponse.json({ recoveries });
    }
    if (id) {
      const plan = await getBrainProcessingPlan(user.sub, id);
      if (!plan) return NextResponse.json({ error: "not_found" }, { status: 404 });
      const produced = await resolveProduced(user.sub, plan);
      return NextResponse.json({ plan, body: parsePlanBody(plan), produced });
    }
    // 未传 id → 返回当前用户可恢复的待确认/失败 plan（刷新/重登后恢复草稿）
    const plans = await listRecoverablePlans(user.sub, ["pending_confirmation", "failed"]);
    return NextResponse.json({ plans });
  } catch (err) {
    console.error("brain plan get failed:", err);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}

// POST /api/brain/plans
// body: { planId; edits? }
// 用户点击「确认保存」后统一由该服务写入笔记/任务/提醒/项目/审计。
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const planId = typeof body?.planId === "string" ? body.planId : "";
    // 运维动作：重试 / 补偿回滚 / 标记人工处理 / 触发清理策略
    if (typeof body?.action === "string") {
      switch (body.action) {
        case "retry_apply": {
          if (!planId) return NextResponse.json({ error: "plan_id_required" }, { status: 400 });
          const r = await retryProcessingPlan(user.sub, planId);
          return r.ok
            ? NextResponse.json({ ok: true, plan: r.plan, noteId: r.note?.id, taskIds: r.taskIds, strategyIds: r.strategyIds, reminderIds: r.reminderIds })
            : NextResponse.json({ error: r.error, reason: r.reason }, { status: r.error === "not_found" ? 404 : 409 });
        }
        case "compensate": {
          if (!planId) return NextResponse.json({ error: "plan_id_required" }, { status: 400 });
          const c = await compensateProcessingPlan(user.sub, planId);
          return c.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: c.error }, { status: 422 });
        }
        case "mark_handled": {
          if (!planId) return NextResponse.json({ error: "plan_id_required" }, { status: 400 });
          const m = await markPlanHandled(user.sub, planId);
          return m.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: m.error }, { status: 422 });
        }
        case "run_cleanup": {
          const c = await cleanupProcessingPlans(user.sub);
          return NextResponse.json({ ok: true, archived: c.archived, skipped: c.skipped });
        }
        default:
          return NextResponse.json({ error: "unknown_action" }, { status: 400 });
      }
    }
    const edits: ProcessingEdits | null =
      body?.edits && typeof body.edits === "object" ? (body.edits as ProcessingEdits) : null;
    if (!planId) return NextResponse.json({ error: "plan_id_required" }, { status: 400 });

    const plan = await getBrainProcessingPlan(user.sub, planId);
    if (!plan) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (plan.status === "applied") {
      return NextResponse.json({ error: "already_applied", plan }, { status: 409 });
    }

    const result = await applyProcessingPlan(user.sub, plan, edits);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, reason: result.reason, plan: result.plan },
        { status: 422 },
      );
    }
    return NextResponse.json({
      ok: true,
      plan: result.plan,
      noteId: result.note?.id,
      note: result.note,
      taskIds: result.taskIds,
      strategyIds: result.strategyIds,
      reminderIds: result.reminderIds,
    });
  } catch (err) {
    console.error("brain plan apply failed:", err);
    return NextResponse.json({ error: "apply_failed", reason: "服务异常，请重试" }, { status: 500 });
  }
}

async function resolveProduced(
  userId: string,
  plan: Awaited<ReturnType<typeof getBrainProcessingPlan>> & object,
) {
  const tasks = await listBrainTasks(userId);
  const reminders = await listPendingBrainReminderItems(userId);
  const project = plan?.projectId ? await getBrainProject(userId, plan.projectId) : null;
  return {
    note: plan?.noteId ? await getBrainNote(userId, plan.noteId) : null,
    tasks: tasks.filter((t) => (plan?.taskIds ?? []).includes(t.id)),
    strategies: plan?.strategyIds?.length
      ? (await listBrainStrategies(userId)).filter((s) => (plan.strategyIds ?? []).includes(s.id))
      : [],
    reminders: reminders.filter((r) => (plan?.reminderIds ?? []).includes(r.id) || r.planId === plan?.id),
    project,
  };
}