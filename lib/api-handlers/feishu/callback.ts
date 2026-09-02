/**
 * GET /api/feishu/callback
 *
 * 飞书 OAuth 回调：用授权码换 user_access_token + refresh_token，
 * 加密入库（userFeishuConfig），302 回前端并带结果参数（?feishu=connected|error）。
 * 前端据此刷新「数据引擎」绑定状态。
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { exchangeCodeForToken } from "@/lib/feishu/client";
import { upsertFeishuConfig } from "@/lib/feishu/feishu-config";
import { safeDetail } from "@/lib/api-error";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const home = process.env.FEISHU_FRONTEND_HOME ?? "/";

  if (!user) return NextResponse.redirect(`${home}?feishu=error&reason=unauthorized`);
  if (!code) return NextResponse.redirect(`${home}?feishu=error&reason=no_code`);
  // CSRF：state 由 /authorize 写入（= 当前用户 sub），回调必须原样带回且匹配。
  // 此前 `state && state !== user.sub` 会在 state 缺省时整段跳过校验，
  // 攻击者可构造不带 state 的回调 URL 完成绑定劫持；此处改为必填强校验。
  if (!state || state !== user.sub) {
    return NextResponse.redirect(`${home}?feishu=error&reason=state_mismatch`);
  }

  try {
    const token = await exchangeCodeForToken(code);
    const expiresAt = token.expiresIn > 0 ? Date.now() + token.expiresIn * 1000 : 0;
    await upsertFeishuConfig(
      user.sub,
      token.accessToken,
      token.refreshToken ?? "",
      expiresAt,
      token.scope,
    );
    return NextResponse.redirect(`${home}?feishu=connected`);
  } catch (err) {
    console.error("[feishu] callback failed (full):", err);
    console.error("[feishu] err.stack:", (err as Error)?.stack);
    console.error("[feishu] err.name:", (err as Error)?.name);
    console.error("[feishu] err.cause:", (err as { cause?: unknown })?.cause);
    const reason = encodeURIComponent(safeDetail(err)).slice(0, 200);
    return NextResponse.redirect(`${home}?feishu=error&reason=${reason}`);
  }
}
