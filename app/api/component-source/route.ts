import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { resolve, sep, normalize } from "path";
import { SOURCE_FILES } from "@/data/component-library";

// 允许读取的组件源文件，白名单来自组件源码映射，防止任意路径读取。
const ALLOWED = new Set(Object.values(SOURCE_FILES).flat().map((p) => p.replace(/\\/g, "/")));

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams.get("path") ?? "";
  const rel = p.replace(/\\/g, "/");

  if (!ALLOWED.has(rel)) {
    return new NextResponse("path not allowed", { status: 403 });
  }

  const base = resolve(process.cwd());
  const full = resolve(base, rel);

  if (full !== normalize(full) || !full.startsWith(base + sep)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  try {
    const code = readFileSync(full, "utf8");
    return new NextResponse(code, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
}