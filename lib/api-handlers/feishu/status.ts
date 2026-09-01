/**
 * GET /api/feishu/status
 *
 * 返回当前用户飞书绑定状态（是否绑定、授权范围、token 过期时间）。
 * 不返回任何 token 明文。
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getFeishuConfig } from "@/lib/feishu/feishu-config";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "未登录" }, { status: 401 });
  }
  const cfg = await getFeishuConfig(user.sub);
  return NextResponse.json({
    connected: Boolean(cfg),
    scope: cfg?.scope ?? null,
    expiresAt: cfg?.expiresAt ?? null,
  });
}
