import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { decideSimilar } from "@/lib/brain-curate";

export const runtime = "nodejs";

// POST /api/brain/curate/similar  body: { id, action: "related"|"independent"|"ignored" }
//   相似内容的用户决策：仅记录决策与关系，绝不静默合并/删除/覆盖原笔记。
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id : "";
    const action = body?.action;
    if (!id || !["related", "independent", "ignored"].includes(action)) {
      return NextResponse.json({ error: "id_or_action_required" }, { status: 400 });
    }
    const ok = await decideSimilar(user.sub as string, id, action);
    if (!ok) return NextResponse.json({ error: "not_found_or_not_owner" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("brain curate similar decision failed:", err);
    return NextResponse.json({ error: "action_failed" }, { status: 500 });
  }
}