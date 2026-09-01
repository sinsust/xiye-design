/**
 * POST /api/feishu/disconnect
 *
 * 解绑飞书：删除用户加密存储的 token（userFeishuConfig）。
 * 后续访问飞书数据需重新授权。
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { deleteFeishuConfig } from "@/lib/feishu/feishu-config";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "未登录" }, { status: 401 });
  }
  await deleteFeishuConfig(user.sub);
  return NextResponse.json({ ok: true });
}
