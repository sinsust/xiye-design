import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { organizeToPlan, organizeInboxToPlan } from "@/lib/brain-plan";

export const runtime = "nodejs";

// POST /api/brain/organize
// body: { content; source?; inboxId? }
// 对用户随手丢进来的原始文本做 AI 转译，生成并持久化一条「待确认」ProcessingPlan（pending_confirmation）。
// AI 阶段绝不直接创建任务/提醒/项目关系——只写 plan_json，等待用户确认后由统一写入服务落库。
// 传入 inboxId 时走「收件箱闭环」：pending → processing → pending_confirmation，并把 plan 链接回收件箱条目。
// 返回 { plan, body, duplicate }，刷新/重登后仍可按 plan.id 恢复。
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    const inboxId = typeof body?.inboxId === "string" && body.inboxId ? body.inboxId : "";
    const source =
      typeof body?.source === "string" && body.source.trim()
        ? body.source.trim().slice(0, 40)
        : "workbench";

    // P5-A：产品流程结论沉淀 — 预填建议（标题/分类/标签/关联项目名），确认权仍在用户
    const preset =
      body?.preset && typeof body.preset === "object"
        ? {
            title: typeof body.preset.title === "string" ? body.preset.title.trim() : "",
            category: typeof body.preset.category === "string" ? body.preset.category.trim() : "",
            tags: Array.isArray(body.preset.tags)
              ? body.preset.tags.filter((t: unknown) => typeof t === "string").map((t: string) => t.trim()).filter(Boolean).slice(0, 8)
              : [],
            suggestedProjectName:
              typeof body.preset.suggestedProjectName === "string"
                ? body.preset.suggestedProjectName.trim()
                : "",
          }
        : undefined;

    // 收件箱入口：以条目原文生成计划，并推进收件箱状态机
    if (inboxId) {
      const r = await organizeInboxToPlan(user.sub, inboxId, { source });
      if (!r.ok) {
        return NextResponse.json(
          { error: r.error ?? "organize_failed", inboxId },
          { status: r.error === "not_found" ? 404 : r.error === "already_processed" ? 409 : 500 },
        );
      }
      return NextResponse.json({ plan: r.plan, body: r.body, duplicate: r.duplicate ?? null, inboxId });
    }

    if (!content) return NextResponse.json({ error: "content_required" }, { status: 400 });

    const { plan, body: planBody, duplicate } = await organizeToPlan(user.sub, {
      rawContent: content,
      source,
      preset,
    });
    if (!plan) return NextResponse.json({ error: "plan_create_failed" }, { status: 500 });
    return NextResponse.json({ plan, body: planBody, duplicate });
  } catch (err) {
    console.error("brain organize failed:", err);
    return NextResponse.json({ error: "organize_failed" }, { status: 500 });
  }
}