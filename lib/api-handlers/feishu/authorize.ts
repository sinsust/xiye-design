/**
 * GET /api/feishu/authorize
 *
 * 发起飞书 OAuth 授权：302 重定向到飞书授权页。
 * state 用当前登录用户 sub（回调时校验一致性防 CSRF）。
 * 飞书应用凭证（FEISHU_APP_ID 等）缺失时清晰报错，不依赖 key 即可 tsc。
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { buildAuthorizeUrl } from "@/lib/feishu/client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "未登录" }, { status: 401 });
  }
  try {
    const url = buildAuthorizeUrl(user.sub);
    return NextResponse.redirect(url);
  } catch (err) {
    return NextResponse.json(
      { error: "feishu_config_missing", message: (err as Error).message },
      { status: 500 },
    );
  }
}
