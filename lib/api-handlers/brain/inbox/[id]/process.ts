import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { processInboxItem, type InboxProcessAction, type InboxOverrides } from "@/lib/inbox-process";
import { safeDetail } from "@/lib/api-error";

export const runtime = "nodejs";

// POST /api/brain/inbox/:id/process
// body: { action: "confirm" | "edit" | "dismiss"; overrides?: { title?; category?; tags?; intent? } }
// confirm/edit → 把条目落库为正式笔记（+任务/策略按意图）；dismiss → 标记忽略不落库。
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const action: InboxProcessAction =
      body?.action === "edit" || body?.action === "dismiss" ? body.action : "confirm";
    const overrides: InboxOverrides = body?.overrides && typeof body.overrides === "object" ? body.overrides : {};
    const result = await processInboxItem(user.sub, id, action, overrides);
    if (!result.ok) return NextResponse.json({ ...result }, { status: 400 });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[inbox] process failed:", err);
    return NextResponse.json({ error: "process_failed", detail: safeDetail(err) }, { status: 500 });
  }
}