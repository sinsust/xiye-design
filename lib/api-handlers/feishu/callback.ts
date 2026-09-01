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

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  console.log("[feishu] callback entered");
  const user = await getSessionUser();
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const home = process.env.FEISHU_FRONTEND_HOME ?? "/";

  console.log("[feishu] callback state", {
    hasUser: Boolean(user),
    userSub: user?.sub,
    hasCode: Boolean(code),
    codeLen: code?.length ?? 0,
    hasState: Boolean(state),
    stateMatches: state && user ? state === user.sub : null,
  });

  if (!user) return NextResponse.redirect(`${home}?feishu=error&reason=unauthorized`);
  if (!code) return NextResponse.redirect(`${home}?feishu=error&reason=no_code`);
  if (state && state !== user.sub) {
    return NextResponse.redirect(`${home}?feishu=error&reason=state_mismatch`);
  }

  try {
    console.log("[feishu] exchanging code for token...");
    const token = await exchangeCodeForToken(code);
    console.log("[feishu] token exchanged", {
      hasAccess: Boolean(token.accessToken),
      hasRefresh: Boolean(token.refreshToken),
      expiresIn: token.expiresIn,
      scope: token.scope,
    });
    const expiresAt = token.expiresIn > 0 ? Date.now() + token.expiresIn * 1000 : 0;
    console.log("[feishu] upserting config for user", user.sub);
    await upsertFeishuConfig(
      user.sub,
      token.accessToken,
      token.refreshToken ?? "",
      expiresAt,
      token.scope,
    );
    console.log("[feishu] upsert OK, redirecting to connected");
    return NextResponse.redirect(`${home}?feishu=connected`);
  } catch (err) {
    console.error("[feishu] callback failed (full):", err);
    console.error("[feishu] err.stack:", (err as Error)?.stack);
    console.error("[feishu] err.name:", (err as Error)?.name);
    console.error("[feishu] err.cause:", (err as { cause?: unknown })?.cause);
    const reason = encodeURIComponent((err as Error).message).slice(0, 200);
    return NextResponse.redirect(`${home}?feishu=error&reason=${reason}`);
  }
}
