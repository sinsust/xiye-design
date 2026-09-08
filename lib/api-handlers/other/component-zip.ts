import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { packComponent } from "@/lib/component-pack";
import { safeDetail } from "@/lib/api-error";

export const runtime = "nodejs";

// GET /api/component-zip?id=<compId> → 下载该组件完整包（源码 + 素材，保目录结构）。
// 需登录（组件包含完整源码，不应匿名导出）。
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!(await rateLimit(`ai:${getClientIp(req)}`, 10, 60_000))) {
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    const id = req.nextUrl.searchParams.get("id") ?? "";
    const { zip, filename, fileCount } = packComponent(id);
    return new Response(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "X-File-Count": String(fileCount),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[component-zip] 打包失败:", e);
    return new Response(JSON.stringify({ error: safeDetail(e, "打包失败") }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}