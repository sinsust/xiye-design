import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getImaConfig } from "@/lib/ima-config";
import {
  listKnowledgeBases,
  searchKnowledge,
  getMediaInfo,
} from "@/lib/ima";
import { importImaNote } from "@/lib/ima-brain";

export const runtime = "nodejs";

// 第二大脑 · 从用户绑定的腾讯 ima 知识库导入。
// 定位「导入通道」：把 ima 资料拉进用户自己的 brain_notes（source="ima"），
// 之后即被现有 RAG（/api/brain/ask）自然检索。不做写回（ima 只进不出）。
//
// GET /api/brain/ima?action=list_kb              → 列出用户 ima 知识库
// GET /api/brain/ima?action=search&kbId=..&q=..  → 库内搜索
// POST /api/brain/ima  body { mediaId, name? }    → 拉原文 → 落 brain_notes

function getAction(req: NextRequest): string {
  return req.nextUrl.searchParams.get("action") ?? "list_kb";
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const cfg = await getImaConfig(user.email);
  if (!cfg) {
    return NextResponse.json({ error: "ima_not_bound" }, { status: 409 });
  }

  const action = getAction(req);
  try {
    if (action === "list_kb") {
      const data = await listKnowledgeBases(cfg);
      return NextResponse.json({
        list: data.list ?? [],
        cursor: data.cursor ?? "",
      });
    }
    if (action === "search") {
      const kbId = req.nextUrl.searchParams.get("kbId") ?? "";
      const q = req.nextUrl.searchParams.get("q") ?? "";
      if (!kbId || !q) {
        return NextResponse.json(
          { error: "kbId_q_required" },
          { status: 400 },
        );
      }
      const data = await searchKnowledge(cfg, kbId, q);
      return NextResponse.json({
        list: data.list ?? [],
        cursor: data.cursor ?? "",
      });
    }
    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ima_request_failed";
    return NextResponse.json(
      { error: "ima_request_failed", detail: msg },
      { status: 502 },
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const cfg = await getImaConfig(user.email);
  if (!cfg) {
    return NextResponse.json({ error: "ima_not_bound" }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const mediaId =
    typeof body?.mediaId === "string" ? body.mediaId.trim() : "";
  if (!mediaId) {
    return NextResponse.json({ error: "mediaId_required" }, { status: 400 });
  }

  try {
    const info = await getMediaInfo(cfg, mediaId);

    const rawContent =
      (info.note_content && info.note_content.trim()) ||
      (typeof info.url === "string" ? info.url : "") ||
      "";
    const title =
      (typeof info.title === "string" && info.title.trim()) ||
      (typeof body?.name === "string" && body.name.trim()) ||
      `ima-${mediaId}`;

    // 走完整 AI 整理管线：organize → 落库 → 任务/策略/代码识别 → 复习记录。
    // 整理失败自动降级（原文落库、category="未分类"），不阻断导入。
    const result = await importImaNote(user.sub, {
      content: rawContent ? rawContent : title,
      title,
      mediaId,
    });

    return NextResponse.json({
      note: result.note,
      source: "ima",
      degraded: result.degraded,
      createdTasks: result.createdTasks,
      createdStrategies: result.createdStrategies,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ima_import_failed";
    return NextResponse.json(
      { error: "ima_import_failed", detail: msg },
      { status: 502 },
    );
  }
}
