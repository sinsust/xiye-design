import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { accessCodes, isPublicDeploy } from "@/lib/deploy-mode";
import { signProfileCookie } from "@/lib/profile-signature";
import { ensureLocalUser } from "@/lib/local-scope";
import { newProfileId } from "@/lib/local-profile";

export const runtime = "nodejs";
// 门户发放是轻量操作（校验 + 建档 + 种 cookie），无需长超时
export const maxDuration = 60;

/** 常数时间比较，防时序侧信道 */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * POST /api/enter —— 邀请码门户：校验邀请码 → 建档案 → 种签名 cookie。
 *
 * body: { code: string }
 * 200 { ok: true }                        + Set-Cookie: xiye_profile=<id>.<sig>
 * 403 { error: "invalid_code" }           邀请码错误
 * 403 { error: "access_disabled" }        未配置 ACCESS_CODE
 * 404 { error: "not_public" }             非 public 模式（本地部署无门户）
 * 500 { error: "server_misconfigured" }   PROFILE_HMAC_KEY 缺失/非法
 */
export async function POST(req: NextRequest) {
  if (!isPublicDeploy()) {
    return NextResponse.json({ error: "not_public" }, { status: 404 });
  }

  const codes = accessCodes();
  if (codes.length === 0) {
    return NextResponse.json(
      { error: "access_disabled", message: "站点未配置 ACCESS_CODE，暂不开放进入" },
      { status: 403 },
    );
  }

  let cookieValue: string;
  try {
    const body = await req.json().catch(() => null);
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    if (!code || !codes.some((c) => safeEqual(c, code))) {
      return NextResponse.json({ error: "invalid_code" }, { status: 403 });
    }

    // 验过码才建档案：避免未认证访客在 users 表里堆垃圾行
    const id = newProfileId();
    await ensureLocalUser(id);
    cookieValue = await signProfileCookie(id);
  } catch (err) {
    console.error("[api/enter] 发放入户凭证失败:", err);
    return NextResponse.json(
      { error: "server_misconfigured", message: "PROFILE_HMAC_KEY 未配置或非法（≥32 字符）" },
      { status: 500 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("xiye_profile", cookieValue, {
    httpOnly: true,
    // 本地 http 模拟 public 模式时浏览器会拒收 Secure cookie，故按协议判断；
    // Vercel 线上恒为 https，Secure 生效
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

/**
 * DELETE /api/enter —— 退出当前档案（清签名 cookie）。
 *
 * cookie 是 HttpOnly，前端 JS 清不掉，必须走服务端。
 * 200 { ok: true }            + Set-Cookie: xiye_profile=<空>, maxAge=0
 * 404 { error: "not_public" } 非 public 模式
 */
export async function DELETE(req: NextRequest) {
  if (!isPublicDeploy()) {
    return NextResponse.json({ error: "not_public" }, { status: 404 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("xiye_profile", "", {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
