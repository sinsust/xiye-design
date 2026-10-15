import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { accessCodes, isPublicDeploy } from "@/lib/deploy-mode";
import { signProfileCookie } from "@/lib/profile-signature";
import { ensureLocalUser } from "@/lib/local-scope";
import { newProfileId } from "@/lib/local-profile";

// 邀请码门户 API：校验邀请码 → 建档案 → 种签名 cookie（POST）；
// 退出当前档案、清签名 cookie（DELETE）。
// 原 app/api/enter/route.ts 抽出，并入根分发器 app/api/[[...path]]（Hobby 函数数削减）。

/** 常数时间比较，防时序侧信道 */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

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
