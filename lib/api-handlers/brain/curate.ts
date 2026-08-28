import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getCurateView, scanSimilarNotes, proposeRelations, getCurateConfig } from "@/lib/brain-curate";

export const runtime = "nodejs";

// GET /api/brain/curate?noteId=…  当前用户某条笔记的「整理」视图
//   { noteId, stale, similar[], relations[] }
//   只读当前用户数据；找不到或无权限返回空视图，不泄露其他用户数据。
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const noteId = req.nextUrl.searchParams.get("noteId");
  if (!noteId) return NextResponse.json({ error: "note_required" }, { status: 400 });
  try {
    const view = await getCurateView(user.sub as string, noteId);
    return NextResponse.json(view);
  } catch (err) {
    console.error("brain curate view failed:", err);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}

// POST /api/brain/curate  body: { action: "scan" }
//   扫描相似 + 推导关系建议（触发式整理，供前端「重新整理」/后台刷新使用）。
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const action = body?.action;
    if (action === "scan") {
      const similar = await scanSimilarNotes(user.sub as string);
      const relations = await proposeRelations(user.sub as string);
      return NextResponse.json({
        ok: true,
        similar,
        relations,
        config: getCurateConfig(),
      });
    }
    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  } catch (err) {
    console.error("brain curate scan failed:", err);
    return NextResponse.json({ error: "scan_failed" }, { status: 500 });
  }
}