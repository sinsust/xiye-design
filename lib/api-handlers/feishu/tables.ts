/**
 * GET /api/feishu/tables?appToken=xxx
 *
 * 列出某多维表应用（appToken）下的所有数据表，供前端「数据引擎」选择导入。
 * 需先授权飞书（userFeishuConfig 存在）；token 过期则刷新后回写。
 * 不返回任何 token 明文。
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getFeishuConfig, upsertFeishuConfig } from "@/lib/feishu/feishu-config";
import { listTables, refreshUserAccessToken, FeishuApiError } from "@/lib/feishu/client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "未登录" }, { status: 401 });
  }

  const appToken = req.nextUrl.searchParams.get("appToken");
  if (!appToken) {
    return NextResponse.json(
      { error: "params_required", message: "请提供 appToken（多维表 URL 中的 app 部分）" },
      { status: 400 },
    );
  }

  const cfg = await getFeishuConfig(user.sub);
  if (!cfg) {
    return NextResponse.json(
      { error: "feishu_not_connected", message: "尚未绑定飞书，请先授权" },
      { status: 400 },
    );
  }

  // token 过期则刷新（refresh_token 轮换后回写）
  let accessToken = cfg.accessToken;
  if (cfg.expiresAt > 0 && cfg.expiresAt < Date.now() && cfg.refreshToken) {
    try {
      const refreshed = await refreshUserAccessToken(cfg.refreshToken);
      accessToken = refreshed.accessToken;
      const expiresAt =
        refreshed.expiresIn > 0 ? Date.now() + refreshed.expiresIn * 1000 : cfg.expiresAt;
      await upsertFeishuConfig(
        user.sub,
        refreshed.accessToken,
        refreshed.refreshToken ?? cfg.refreshToken,
        expiresAt,
        refreshed.scope ?? cfg.scope,
      );
    } catch (e) {
      console.error("[feishu] refresh failed:", e);
      return NextResponse.json(
        { error: "feishu_token_refresh_failed", message: "飞书授权已过期，请重新授权" },
        { status: 401 },
      );
    }
  }

  try {
    const tables = await listTables(appToken, accessToken);
    return NextResponse.json({ tables });
  } catch (err) {
    console.error("[feishu] list tables failed:", err);
    const message =
      err instanceof FeishuApiError ? `飞书接口错误 code=${err.code}` : (err as Error).message;
    return NextResponse.json({ error: "feishu_list_tables_failed", message }, { status: 500 });
  }
}
