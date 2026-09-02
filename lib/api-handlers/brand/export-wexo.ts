// 导出「修改后的 Wexo 整站」为可独立部署的 zip。
// 前端把整合好的整站 HTML(index) POST 过来，服务端补上 framer.css 与 public 下的图片/字体资源，
// 一并打包。图片在整站 HTML 中已由前端改写为相对路径 images/...。
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { makeZip } from "@/lib/server-zip";
import { collectFilePaths } from "@/lib/brand-pack";

export async function POST(req: NextRequest) {
  if (!rateLimit(`ai:${getClientIp(req)}`, 10, 60_000)) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { "Content-Type": "application/json" } });
  }
  let index: string;
  try {
    const body = await req.json();
    index = typeof body?.index === "string" ? body.index : "";
  } catch {
    return new NextResponse("bad request", { status: 400 });
  }
  if (!index) return new NextResponse("missing index", { status: 400 });

  try {
    const base = join(process.cwd(), "public", "originkit", "wexo");
    const files: { name: string; content: Buffer | string }[] = [
      { name: "index.html", content: index },
    ];

    const cssPath = join(base, "framer.css");
    if (existsSync(cssPath)) {
      files.push({ name: "framer.css", content: readFileSync(cssPath) });
    }

    for (const sub of ["images", "fonts"]) {
      const dir = join(base, sub);
      if (!existsSync(dir)) continue;
      for (const f of collectFilePaths(dir)) {
        files.push({ name: `${sub}/${f.rel}`, content: readFileSync(f.abs) });
      }
    }

    const zip = makeZip(files);
    return new NextResponse(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="wexo-edited.zip"',
      },
    });
  } catch (e) {
    // 资源读取/打包失败（如 public 目录缺失、磁盘 IO 异常）不应裸抛 500 暴露路径
    console.error("[brand/export-wexo] 打包失败:", e);
    return NextResponse.json({ error: "wexo_export_failed" }, { status: 500 });
  }
}