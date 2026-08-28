import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { decideRelation } from "@/lib/brain-curate";

export const runtime = "nodejs";

// POST /api/brain/curate/relation  body: { id, action: "confirmed"|"ignored" }
//   关系建议的用户决策：确认 → 纳入详情页已有关系；忽略 → 仅记录，不删对象。
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id : "";
    const action = body?.action;
    if (!id || !["confirmed", "ignored"].includes(action)) {
      return NextResponse.json({ error: "id_or_action_required" }, { status: 400 });
    }
    const ok = await decideRelation(user.sub as string, id, action);
    if (!ok) return NextResponse.json({ error: "not_found_or_not_owner" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("brain curate relation decision failed:", err);
    return NextResponse.json({ error: "action_failed" }, { status: 500 });
  }
}