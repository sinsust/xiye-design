"use client";

import { useCallback, useRef, useState } from "react";
import { Check, FileUp, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface InputTabProps {
  text: string;
  setText: (value: string) => void;
  organize: () => Promise<void>;
  organizing: boolean;
  /** 直接入库（保存优先）：原文立即落库，AI 整理转后台，不等「整理中」 */
  quickSave: () => Promise<void>;
  placeholders: string[];
  placeholderIndex: number;
  setBatchOpen: (value: boolean) => void;
  setRaw: (value: string) => void;
}

/* ── 前端 OCR 兜底（仅扫描版 PDF 触发）───────────────────
 * 服务端只能拿文本层；文本层稀薄（扫描版图片 PDF）时，
 * 浏览器端用 pdfjs 渲染页面到 canvas + tesseract.js 识别中英文。 */
async function ocrPdfFallback(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const pdfjsLib = (pdfjs as any).default ?? pdfjs;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  const Tesseract = (await import("tesseract.js")).default;

  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const texts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) { page.cleanup(); continue; }
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const { data } = await Tesseract.recognize(canvas, "chi_sim+eng");
    if (data.text.trim()) texts.push(data.text.trim());
    page.cleanup();
  }
  await doc.destroy();
  return texts.join("\n\n");
}

/* ── 组件 ────────────────────────────────────────────── */

export function InputTab({
  text,
  setText,
  organize,
  organizing,
  quickSave,
  placeholders,
  placeholderIndex,
  setBatchOpen,
  setRaw,
}: InputTabProps) {
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [ocrActive, setOcrActive] = useState(false);
  const [parseErr, setParseErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const appendText = useCallback(
    (extra: string) => {
      setText(text ? `${text}\n\n${extra}` : extra);
      setRaw(text ? `${text}\n\n${extra}` : extra);
    },
    [text, setText, setRaw]
  );

  const processFile = useCallback(
    async (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["pdf", "docx"].includes(ext ?? "")) {
        setParseErr(`不支持的格式：.${ext}，仅支持 PDF 和 Word (.docx)`);
        return;
      }
      setParsing(true);
      setParseErr(null);
      setOcrActive(false);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/brain/parse", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) {
          setParseErr(json.message ?? "解析失败");
          return;
        }

        let extracted = (json.text ?? "") as string;
        // 扫描版：前端 OCR 兜底
        if (json.meta?.ocrNeeded && !extracted.trim()) {
          setOcrActive(true);
          extracted = await ocrPdfFallback(file);
          setOcrActive(false);
        }

        if (!extracted.trim()) {
          setParseErr(json.warning ?? "未能从文件中提取到文本");
          return;
        }
        appendText(`--- 📎 ${file.name} ---\n` + extracted.trim());
      } catch (err: any) {
        console.error("[input-tab] parse error:", err);
        setParseErr(`解析失败：${err?.message ?? String(err)}`);
      } finally {
        setParsing(false);
      }
    },
    [appendText]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) void processFile(f);
    },
    [processFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) void processFile(f);
      e.target.value = "";
    },
    [processFile]
  );

  const busy = parsing || ocrActive;
  const hint = ocrActive
    ? "正在识别扫描版内容（OCR）…"
    : dragOver
      ? "松手以上传"
      : "支持拖入或点击上传 PDF / Word (.docx)，自动提取文本";

  return (
    <div className="mt-3">
      <div className="flex items-center justify-end">
        <span className="text-xs text-muted-foreground">⌘ / Ctrl + Enter 立即整理</span>
      </div>
      <textarea
        value={text}
        onChange={(ev) => {
          setText(ev.target.value);
          ev.target.style.height = "auto";
          ev.target.style.height = `min(${Math.max(ev.target.scrollHeight, 120)}px, 300px)`;
        }}
        onKeyDown={(ev) => {
          if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") organize();
        }}
        placeholder={placeholders[placeholderIndex]}
        className="mt-2 max-h-[300px] min-h-[120px] w-full resize-y rounded-[var(--radius)] border border-muted bg-card px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_12%,transparent)]"
      />

      {/* 文件拖拽 / 点击上传区 */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`mt-3 flex cursor-pointer items-center gap-2 rounded-[var(--radius)] border-2 border-dashed px-3 py-2.5 text-xs transition-colors ${
          dragOver
            ? "border-primary bg-primary/5 text-primary"
            : "border-border bg-muted/30 text-muted-foreground hover:border-muted-foreground/40 hover:bg-muted/50"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        {busy ? (
          <>
            <Loader2 className="size-3.5 shrink-0 animate-spin" />
            {hint}
          </>
        ) : (
          <>
            <FileUp className="size-3.5 shrink-0" />
            {hint}
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={onFileInput}
      />

      {parseErr && (
        <div className="mt-2 flex items-start gap-1.5 rounded-[var(--radius)] border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger dark:border-danger/30 dark:bg-danger dark:text-danger">
          <X className="mt-0.5 size-3 shrink-0" />
          <span>{parseErr}</span>
          <button type="button" className="ml-auto underline" onClick={() => setParseErr(null)}>
            关闭
          </button>
        </div>
      )}

      <div className="mt-3 flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setBatchOpen(true)}>
          <FileUp className="size-3.5" />
          批量导入
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setText("");
            setRaw("");
          }}
          disabled={!text.trim()}
        >
          清空
        </Button>
        {/* 保存优先：跳过 AI 整理直接落库，整理转后台（不想等「整理中」时用） */}
        <Button variant="outline" size="sm" onClick={() => quickSave()} disabled={!text.trim() || organizing}>
          <Check className="size-3.5" />
          直接入库
        </Button>
        <Button
          size="sm"
          onClick={() => organize()}
          disabled={!text.trim() || organizing}
          className="bg-gradient-to-r from-primary to-primary/80 shadow-md shadow-primary/25"
        >
          {organizing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {organizing ? "整理中…" : "帮我整理"}
        </Button>
      </div>
    </div>
  );
}
