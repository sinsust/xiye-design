// M4 决策 8：IMA 双向写——从工作台把内容写入用户的 ima 知识库。
// 能力经 Connector 抽象（lib/connectors/ima.ts → lib/ima.ts createImaNote/appendImaNote）。
// 防御设计：未绑定时分发 409；合约/权限异常抛错时返回 502 + degraded 标记，绝不伪装成功。
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getImaConfig } from "@/lib/ima-config";
import { getConnector } from "@/lib/connectors/registry";

export const runtime = "nodejs";

// POST /api/brain/ima/write
// body: { action: "create"|"append", kbId?, title?, content, noteId? (append 时必填) }
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const action = body?.action === "append" ? "append" : "create";
  const content = typeof body?.content === "string" ? (body.content as string).trim() : "";
  if (!content) return NextResponse.json({ error: "content_required" }, { status: 400 });
  if (action === "append" && !(typeof body?.noteId === "string" && body.noteId)) {
    return NextResponse.json({ error: "noteId_required_for_append" }, { status: 400 });
  }

  let cfg;
  try {
    cfg = await getImaConfig(user.email);
  } catch {
    cfg = null;
  }
  if (!cfg) {
    return NextResponse.json({ error: "ima_not_configured" }, { status: 409 });
  }

  const conn = getConnector("ima");
  if (!conn?.write) {
    return NextResponse.json({ error: "ima_write_unavailable" }, { status: 500 });
  }

  try {
    const r = await conn.write(
      {
        action,
        kbId: typeof body?.kbId === "string" ? body.kbId : undefined,
        title: typeof body?.title === "string" ? body.title : undefined,
        content,
        noteId: typeof body?.noteId === "string" ? body.noteId : undefined,
      },
      cfg,
    );
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, degraded: !!r.degraded, detail: r.detail ?? "ima_write_failed" },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, noteId: r.noteId, noteUrl: r.noteUrl });
  } catch (err) {
    console.error("[brain ima/write] failed:", err);
    return NextResponse.json(
      { ok: false, degraded: true, detail: err instanceof Error ? err.message : "ima_write_failed" },
      { status: 502 },
    );
  }
}