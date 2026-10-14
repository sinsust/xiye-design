import { NextRequest, NextResponse } from "next/server";
import { isPublicDeploy } from "@/lib/deploy-mode";
import { verifyProfileCookie } from "@/lib/profile-signature";

/**
 * public 部署模式（Vercel 公开多用户）的总闸。
 *
 * local 模式（桌面单机）完全不走本文件逻辑，行为零变化。
 *
 * 作用：档案身份只认服务端 HMAC 签名的 cookie（lib/profile-signature.ts）。
 *   - 页面请求验签失败 → 307 跳 /enter 邀请码门户（带 next 回跳）
 *   - /api 请求验签失败 → 401 JSON（前端 fetch 收到后引导去门户）
 *   - PROFILE_HMAC_KEY 缺失/非法 → 500 明确报错，绝不静默放行
 *
 * 注意：本文件会被打包进 edge runtime，只能 import 零依赖模块
 *（deploy-mode / profile-signature 均不 import node:* 与 lib/db）。
 */
export async function middleware(req: NextRequest) {
  if (!isPublicDeploy()) {
    // local / 桌面模式：邀请码门户不适用（POST /api/enter 会返回 404 not_public），
    // 直接送回首页，避免单机用户看到一个输什么都失败的邀请码框。
    // 放在这里而不是只靠 page 内 redirect()：middleware 能给出真正的 307 状态码。
    if (req.nextUrl.pathname === "/enter") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  // 门户自身与登录 API 放行（无 cookie 是它们的正常态）
  if (pathname === "/enter" || pathname.startsWith("/api/enter")) {
    return NextResponse.next();
  }

  let profileId: string | null = null;
  try {
    profileId = await verifyProfileCookie(req.cookies.get("xiye_profile")?.value);
  } catch (err) {
    console.error("[middleware] 档案 cookie 验签异常（配置问题）:", err);
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "server_misconfigured",
          message: "PROFILE_HMAC_KEY 未配置或非法（≥32 字符）",
        },
        { status: 500 },
      );
    }
    // 页面请求：送去门户，由门户 API 暴露真实错误
  }

  if (!profileId) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "unauthenticated",
          redirect: "/enter",
          message: "请先通过邀请码进入",
        },
        { status: 401 },
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = "/enter";
    url.searchParams.set("next", pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // 只排除静态资源与图片优化。
  // 注意：门户页 /enter 与 /api/enter **必须**经过本 middleware ——
  //   local 模式要把 /enter 挡回首页；public 模式要放行它们（见上面显式判断）。
  // 早先这里把 `enter` 前缀一并排除了，导致 local 模式下门户页谁都能打开。
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
