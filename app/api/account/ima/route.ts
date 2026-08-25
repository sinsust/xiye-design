import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  getImaConfig,
  upsertImaConfig,
  deleteImaConfig,
} from "@/lib/ima-config";
import { listKnowledgeBases } from "@/lib/ima";

export const runtime = "nodejs";

// 个人中心 · 腾讯 ima 凭证管理。
// GET  /api/account/ima        → { bound: boolean }
// PUT  /api/account/ima        → body { clientId, apiKey }，保存前用真实 API 验证凭证可用
// DELETE /api/account/ima      → 解绑（已导入第二大脑的条目保留）
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const cfg = await getImaConfig(user.email);
  return NextResponse.json({ bound: Boolean(cfg) });
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const body = await req.json().catch(() => null);
    const clientId =
      typeof body?.clientId === "string" ? body.clientId.trim() : "";
    const apiKey =
      typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
    if (!clientId || !apiKey) {
      return NextResponse.json(
        { error: "clientId_apiKey_required" },
        { status: 400 },
      );
    }

    // 真实 API 验证：能列出知识库才算凭证有效，避免存无效凭证
    try {
      await listKnowledgeBases({ clientId, apiKey });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ima_verify_failed";
      return NextResponse.json(
        { error: "ima_verify_failed", detail: msg },
        { status: 400 },
      );
    }

    await upsertImaConfig(user.email, clientId, apiKey);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // 不要把 drizzle 原始 SQL 泄给前端（既不安全也会撑爆布局），真实异常只在服务端日志留痕
    const msg = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error && err.cause ? String(err.cause) : undefined;
    console.error("[account/ima PUT] 保存失败:", msg, "| cause:", cause);
    return NextResponse.json(
      {
        error: "internal",
        detail: "凭证已通过 ima 验证，但保存到数据库失败。请稍后重试（本地开发可重启 dev server）。",
      },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await deleteImaConfig(user.email);
  return NextResponse.json({ ok: true });
}
