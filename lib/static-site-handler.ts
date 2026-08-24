import { NextRequest } from "next/server";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, normalize, extname, relative, isAbsolute } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".bin": "application/octet-stream",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

export function createStaticSiteHandler(rootDir: string) {
  const ROOT = normalize(join(process.cwd(), rootDir));

  function safeResolve(segments: string[]): string | null {
    const abs = normalize(join(ROOT, ...segments.filter(Boolean)));
    const rel = relative(ROOT, abs);
    if (!rel || rel.startsWith("..") || isAbsolute(rel)) return null;
    return abs;
  }

  return async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ path?: string[] }> },
  ) {
    const { path } = await params;
    const segs = path && path.length > 0 ? path : ["index.html"];
    const abs = safeResolve(segs);
    if (!abs || !existsSync(abs) || !statSync(abs).isFile()) {
      return new Response("Not Found", { status: 404 });
    }
    const buf = readFileSync(abs);
    const type = MIME[extname(abs).toLowerCase()] ?? "application/octet-stream";
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  };
}
