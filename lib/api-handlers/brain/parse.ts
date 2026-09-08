/**
 * POST /api/brain/parse
 * body: multipart/form-data, field "file"
 *
 * 服务端文档解析（B 部分：后端高质解析）：
 *  - PDF：pdfjs-dist/legacy 提取文本层（Node 无 canvas 也能跑，文本提取不依赖 canvas）
 *  - Word(.docx)：mammoth 转 HTML → 清洗为纯文本（保留段落/标题/列表结构）
 *  - 扫描版检测：PDF 文本层稀薄（<50 字）标记 ocrNeeded=true，由前端接手 tesseract.js OCR
 * 返回：{ text, meta:{ fileName, type, pages, ocrNeeded }, warning? }
 *
 * 后加工（A 部分）不在此做：解析文本返回前端后，用户点「帮我整理」走现有 organize（Qwen）链路，
 * 经 organizeToPlan 落库，整条复用。
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { safeDetail } from "@/lib/api-error";

// pdfjs-dist/legacy 为 ESM 构建，Node 下无需 canvas 即可做文本提取
declare module "pdfjs-dist/legacy/build/pdf.mjs";

export const runtime = "nodejs";

/** 文档大小上限（50MB，文档普遍比表格小） */
const MAX_FILE_SIZE = 50 * 1024 * 1024;
/** 判定为扫描版（文本层稀薄）的字符阈值 */
const SCAN_THRESHOLD = 50;

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized", message: "未登录" }, { status: 401 });
  // 限流：同一用户每分钟最多 10 次文档解析
  if (!await rateLimit(`brain-parse:${user.sub}`, 10, 60_000)) {
    return NextResponse.json({ error: "rate_limited", message: "操作过于频繁，请稍后再试" }, { status: 429 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file) {
      return NextResponse.json({ error: "file_required", message: "请选择要上传的文件" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "empty_file", message: "文件内容为空，请重新选择" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "file_too_large", maxMB: 50, message: `文件超过 50MB 上限（当前 ${(file.size / 1024 / 1024).toFixed(1)}MB）` },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name || "未命名文档";
    const ext = fileName.split(".").pop()?.toLowerCase();

    let text = "";
    let pages = 0;
    let ocrNeeded = false;

    if (ext === "pdf") {
      const r = await parsePdf(buffer);
      text = r.text;
      pages = r.pages;
      ocrNeeded = text.trim().length < SCAN_THRESHOLD;
    } else if (ext === "docx") {
      text = await parseDocx(buffer);
    } else {
      return NextResponse.json(
        { error: "unsupported_type", message: "仅支持 PDF 与 Word (.docx) 文件" },
        { status: 400 },
      );
    }

    // 彻底无文本：扫描版/空文档/加密文档
    if (!text.trim()) {
      return NextResponse.json({
        text: "",
        meta: { fileName, type: ext, pages, ocrNeeded: true },
        warning: "未能从文件中提取到文本，可能是扫描版图片 PDF 或加密文档。扫描版请在客户端进行 OCR 识别。",
      });
    }

    return NextResponse.json({
      text,
      meta: { fileName, type: ext, pages, ocrNeeded },
    });
  } catch (err) {
    console.error("brain parse failed:", err);
    return NextResponse.json(
      { error: "parse_failed", message: `文件解析失败：${safeDetail(err)}` },
      { status: 500 },
    );
  }
}

/** PDF 文本层提取（Node 版 pdfjs，不需要 canvas） */
async function parsePdf(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const getDocument = (pdfjs as any).getDocument ?? (pdfjs as any).default?.getDocument;
  const doc = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  const lines: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const t = content.items.map((it: any) => it.str).join(" ").trim();
    if (t) lines.push(t);
    page.cleanup();
  }
  await doc.destroy();
  return { text: lines.join("\n\n"), pages: doc.numPages };
}

/** DOCX → 纯文本（mammoth 转 HTML 后清洗，保留段落/标题/列表结构） */
async function parseDocx(buffer: Buffer): Promise<string> {
  const mod = await import("mammoth");
  const mammoth = (mod as any).default ?? mod;
  const result = await mammoth.convertToHtml({ buffer });
  const text = result.value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<h[1-6][^>]*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text;
}
