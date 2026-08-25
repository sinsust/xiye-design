"use client";

import { useMemo, useRef, useState } from "react";
import { Check, FileUp, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BrainNote } from "@/lib/brain-db";

interface BatchItem {
  title: string;
  content: string;
}

interface BatchResult {
  title: string;
  ok: boolean;
  error?: string;
  note?: BrainNote;
}

/** 多篇文本拆分：`---` 分隔线或 ≥2 个连续空行 */
function splitBatch(text: string): string[] {
  return text
    .split(/\n\s*---+\s*\n|\n\s*={3,}\s*\n|\n\s*\n\s*\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);
}

/** 批量导入：上传 .md/.txt 多文件或粘贴多篇（--- 或连续空行分隔），逐篇走 AI 整理管线落库 */
export default function BatchImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (notes: BrainNote[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<{ name: string; content: string }[]>([]);
  const [paste, setPaste] = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<BatchResult[]>([]);

  const pastedItems = useMemo(() => splitBatch(paste), [paste]);

  const items: BatchItem[] = useMemo(() => {
    const fromFiles = files.map((f) => {
      const first = f.content.split("\n").find((l) => l.trim())?.trim() ?? f.name;
      return { title: first.slice(0, 30), content: f.content };
    });
    const fromPaste = pastedItems.map((s) => {
      const first = s.split("\n").find((l) => l.trim())?.trim() ?? "";
      return { title: first.slice(0, 30), content: s };
    });
    return [...fromFiles, ...fromPaste].slice(0, 10);
  }, [files, pastedItems]);

  const overflow = [...files, ...pastedItems].length > 10;

  const onPickFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const readers: Promise<{ name: string; content: string }>[] = [];
    for (const f of Array.from(list)) {
      if (!/\.(md|txt|markdown)$/i.test(f.name)) continue;
      readers.push(
        new Promise((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve({ name: f.name, content: String(r.result ?? "") });
          r.onerror = () => resolve({ name: f.name, content: "" });
          r.readAsText(f);
        }),
      );
    }
    Promise.all(readers).then((loaded) => {
      setFiles((prev) => [...prev, ...loaded].slice(0, 10));
    });
  };

  const doImport = async () => {
    if (!items.length || importing) return;
    setImporting(true);
    setResults([]);
    try {
      const res = await fetch("/api/brain/import/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "batch_import_failed");
      const list: BatchResult[] = Array.isArray(data.results) ? data.results : [];
      setResults(list);
      const okNotes = list.filter((r) => r.ok && r.note).map((r) => r.note as BrainNote);
      if (okNotes.length) onImported(okNotes);
    } catch {
      setResults([{ title: "批量导入", ok: false, error: "批量导入失败（请稍后重试）" }]);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-white shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileUp className="size-4 text-primary" />
            批量导入
          </h2>
          <Button variant="ghost" size="sm" className="p-1" onClick={onClose} aria-label="关闭">
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-auto space-y-4 p-5">
          {/* 文件上传 */}
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              上传 .md / .txt 文件（可多选）
            </label>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".md,.txt,.markdown"
              className="hidden"
              onChange={(ev) => onPickFiles(ev.target.files)}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="mt-1.5 flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-5 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
            >
              <FileUp className="size-4" />
              点击选择文件，或将文件拖到此处
            </button>
            {files.length > 0 && (
              <ul className="mt-1.5 space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs">
                    <span className="min-w-0 flex-1 truncate text-foreground">{f.name}</span>
                    <span className="text-muted-foreground">{f.content.length} 字</span>
                    <button
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="text-muted-foreground transition hover:text-destructive"
                      aria-label="移除"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 粘贴多篇 */}
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              粘贴多篇文本
            </label>
            <textarea
              value={paste}
              onChange={(ev) => setPaste(ev.target.value)}
              className="mt-1.5 min-h-28 w-full resize-y rounded-md border border-border bg-background px-2.5 py-2 text-xs leading-relaxed outline-none transition focus:border-primary"
              placeholder={"每篇之间用 --- 分隔，或留 2 个以上空行。\n\n第一段内容\n\n---\n\n第二段内容"}
            />
            {pastedItems.length > 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground">识别到 {pastedItems.length} 篇</p>
            )}
          </div>

          {items.length > 0 && (
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                待导入（{items.length} 篇{overflow ? "，超出部分忽略（上限 10）" : ""}）
              </label>
              <ul className="mt-1.5 space-y-1">
                {items.map((it, i) => (
                  <li key={i} className="truncate rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-foreground">
                    {it.title || "未命名"}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 结果 */}
          {results.length > 0 && (
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">导入结果</label>
              <ul className="mt-1.5 space-y-1">
                {results.map((r, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs">
                    {r.ok ? (
                      <Check className="size-3.5 shrink-0 text-emerald-600" />
                    ) : (
                      <X className="size-3.5 shrink-0 text-destructive" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-foreground">{r.title}</span>
                    {!r.ok && <span className="text-destructive">{r.error}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {results.length ? "完成" : "取消"}
          </Button>
          <Button size="sm" onClick={doImport} disabled={!items.length || importing}>
            {importing ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
            {importing ? "导入中…" : `导入 ${items.length} 篇`}
          </Button>
        </div>
      </div>
    </div>
  );
}
