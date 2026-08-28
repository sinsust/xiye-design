import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { applyProcessingPlan, type ProcessingPlanBody } from "@/lib/brain-plan";
import type { ProcessingEdits } from "@/lib/brain-plan";
import type { BrainProcessingPlan } from "@/lib/brain-db";

export const runtime = "nodejs";

// POST /api/brain/organize-save
// 逃生通道：当「AI 整理」的计划持久化失败（罕见，多为 DB 瞬时故障）时，
// 用客户端已有的人工编辑 + AI 建议 body 直接落库一条笔记（复用统一写入服务），
// 从而彻底避免「只能重新生成」死胡同。不产生处理计划记录。
// body: { raw: string; body?: ProcessingPlanBody | null; edits?: ProcessingEdits }
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let payload: { raw?: unknown; body?: unknown; edits?: unknown };
  try {
    payload = await req.json().catch(() => null) ?? {};
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const raw = typeof payload.raw === "string" ? payload.raw.trim() : "";
  if (!raw) return NextResponse.json({ error: "content_required" }, { status: 400 });

  const aiBody = payload.body && typeof payload.body === "object" ? (payload.body as ProcessingPlanBody) : null;
  const edits = payload.edits && typeof payload.edits === "object" ? (payload.edits as ProcessingEdits) : {};

  const now = Date.now();
  // 合成一个仅存在于内存的 plan：applyProcessingPlan 对不存在 planId 的 update/sync 均为 no-op，
  // 因而可直接复用其「笔记 + 策略 + 任务 + 提醒 + 复习」整套写入与回滚逻辑。
  const syntheticPlan: BrainProcessingPlan = {
    id: `bd-${now.toString(36)}-direct`,
    userId: user.sub,
    rawContent: raw,
    inputType: aiBody?.inputType ?? null,
    planJson: JSON.stringify(
      aiBody
        ? {
            ...aiBody,
            suggestedTasks: Array.isArray(aiBody.suggestedTasks) ? aiBody.suggestedTasks : [],
            suggestedReminders: Array.isArray(aiBody.suggestedReminders) ? aiBody.suggestedReminders : [],
          }
        : { suggestedTasks: [], suggestedReminders: [] },
    ),
    editsJson: null,
    status: "pending_confirmation",
    source: "workbench",
    noteId: null,
    taskIds: [],
    strategyIds: [],
    reminderIds: [],
    projectId: null,
    failureReason: null,
    recovery: null,
    createdAt: now,
    applyAt: null,
    updatedAt: now,
    archivedAt: null,
  };

  try {
    const res = await applyProcessingPlan(user.sub, syntheticPlan, edits);
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: res.error, reason: res.reason },
        { status: 500 },
      );
    }
    return NextResponse.json({
      ok: true,
      note: res.note,
      taskIds: res.taskIds,
      strategyIds: res.strategyIds,
      reminderIds: res.reminderIds,
    });
  } catch (err) {
    console.error("[brain] organize-save failed:", err);
    return NextResponse.json(
      { ok: false, error: "direct_save_failed", reason: err instanceof Error ? err.message : "保存失败" },
      { status: 500 },
    );
  }
}