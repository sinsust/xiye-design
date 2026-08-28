// P4-C：主动风险简报 API（"今天值得关注"推送层）。
//  GET   → 生成并返回今日最多 3 条主动建议（不填数；无高优返回空）
//  POST  → { briefId, action, scope?, projectId? } 执行控制动作
//         action ∈ handle_now | tomorrow | silence_week | ignore
//         scope 仅在 ignore 时生效（type | object | project）
// 严格按 userId 隔离；只写简报状态 / 偏好 / 审计与通知，绝不动业务对象。
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getProactiveBrief, applyProactiveBriefAction } from "@/lib/brain-proactive-brief";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const items = await getProactiveBrief(user.sub);
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[active-brief] get failed:", err);
    return NextResponse.json({ error: "active_brief_failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = (await req.json().catch(() => null)) ?? {};
    const briefId = typeof body.briefId === "string" ? body.briefId : "";
    const action = typeof body.action === "string" ? body.action : "";
    if (!briefId || !["handle_now", "tomorrow", "silence_week", "ignore"].includes(action)) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }
    const scope = typeof body.scope === "string" ? body.scope : undefined;
    if (action === "ignore" && scope !== "object" && scope !== "project" && scope !== "type") {
      return NextResponse.json({ error: "scope_required" }, { status: 400 });
    }
    const result = await applyProactiveBriefAction(user.sub, {
      briefId,
      action: action as "handle_now" | "tomorrow" | "silence_week" | "ignore",
      scope: scope as "type" | "object" | "project" | "none" | undefined,
      projectId: typeof body.projectId === "string" ? body.projectId : null,
    });
    if (!result.updated) {
      return NextResponse.json({ error: result.reason ?? "action_failed" }, { status: 404 });
    }
    return NextResponse.json({ items: result.items, updated: true });
  } catch (err) {
    console.error("[active-brief] post failed:", err);
    return NextResponse.json({ error: "active_brief_action_failed" }, { status: 500 });
  }
}