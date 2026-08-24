import { NextRequest } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { packBrand, packBrandWithCopy } from "@/lib/brand-pack";

export const runtime = "nodejs";

// GET  /api/brand/zip?site=Outstand        → 下载该品牌【原始完整】可运行项目（#1 高保真 + #2 完整）
// POST /api/brand/zip  body { site, copyMap } → 在完整原始之上叠加【文案覆盖层】后打包（#3）
export async function GET(req: NextRequest) {
  if (!rateLimit(`ai:${getClientIp(req)}`, 10, 60_000)) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { "Content-Type": "application/json" } });
  }
  try {
    const site = req.nextUrl.searchParams.get("site") ?? "Outstand";
    const { zip, filename, fileCount } = packBrand(site);
    return new Response(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "X-File-Count": String(fileCount),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(req: NextRequest) {
  if (!rateLimit(`ai:${getClientIp(req)}`, 10, 60_000)) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { "Content-Type": "application/json" } });
  }
  try {
    const body = (await req.json().catch(() => ({}))) as {
      site?: string;
      copyMap?: Record<string, string>;
    };
    const site =
      (body.site && typeof body.site === "string" ? body.site : null) ??
      req.nextUrl.searchParams.get("site") ??
      "Outstand";
    const copyMap =
      body.copyMap && typeof body.copyMap === "object" ? body.copyMap : undefined;
    const { zip, filename, fileCount, applied } = packBrandWithCopy(site, copyMap);
    return new Response(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "X-File-Count": String(fileCount),
        "X-Applied": String(applied),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}