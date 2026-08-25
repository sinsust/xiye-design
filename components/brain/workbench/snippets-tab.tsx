import { Check, Copy } from "lucide-react";
import {
  inputCls,
  langColor,
  langLabel,
  snippetPreview,
  highlightCode,
  relativeTime,
} from "../brain-utils";
import type { BrainNote } from "../types";

export interface SnippetsTabProps {
  snippetLang: string;
  setSnippetLang: (value: string) => void;
  snippetQuery: string;
  setSnippetQuery: (value: string) => void;
  snippetFiltered: BrainNote[];
  expandedSnippet: string | null;
  setExpandedSnippet: (value: string | null) => void;
  copiedCode: string | null;
  copyCode: (code: string, id: string) => Promise<void>;
}

export function SnippetsTab({
  snippetLang,
  setSnippetLang,
  snippetQuery,
  setSnippetQuery,
  snippetFiltered,
  expandedSnippet,
  setExpandedSnippet,
  copiedCode,
  copyCode,
}: SnippetsTabProps) {
  return (
    <div className="mt-3">
      {/* 语言过滤 + 搜索 */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-[var(--radius)] border border-border bg-muted/40 p-0.5">
          {["全部", "python", "javascript", "sql", "shell", "其他"].map((lang) => (
            <button
              key={lang}
              onClick={() => setSnippetLang(lang)}
              className={
                "rounded-[var(--radius)] px-2 py-1 text-xs transition " +
                (snippetLang === lang
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {lang === "全部" ? "全部" : lang === "javascript" ? "JS" : lang[0].toUpperCase() + lang.slice(1)}
            </button>
          ))}
        </div>
        <div className="relative ml-auto min-w-0 flex-1">
          <input
            value={snippetQuery}
            onChange={(ev) => setSnippetQuery(ev.target.value)}
            placeholder="搜索代码 / 标题 / 标签…"
            className={inputCls + " w-full text-xs"}
          />
        </div>
      </div>

      {snippetFiltered.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
          没有代码片段。在「整理笔记」里粘贴一段代码，AI 会自动识别并分类保存。
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {snippetFiltered.map((s) => {
            const open = expandedSnippet === s.id;
            return (
              <div
                key={s.id}
                className="group rounded-[var(--radius)] border border-border bg-card p-3 shadow-sm transition hover:border-primary/30"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                    style={{ background: langColor(s.language) }}
                  >
                    {langLabel(s.language)}
                  </span>
                  <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{s.title}</h3>
                  {s.codeContent && (
                    <button
                      className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius)] border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                      onClick={() => copyCode(s.codeContent!, s.id)}
                      title="复制"
                    >
                      {copiedCode === s.id ? (<><Check className="size-3" />已复制</>) : (<><Copy className="size-3" />复制</>)}
                    </button>
                  )}
                </div>
                <pre
                  className={
                    "mt-2 cursor-pointer overflow-auto rounded-md bg-[#0f172a] px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-200 " +
                    (open ? "max-h-80" : "max-h-16")
                  }
                  onClick={() => setExpandedSnippet(open ? null : s.id)}
                >
                  <code>{highlightCode(open ? s.codeContent ?? "" : snippetPreview(s.codeContent ?? "", 3))}</code>
                </pre>
                {s.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {s.tags.slice(0, 3).map((t) => (
                      <span key={t} className="rounded-[var(--radius)] bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="ml-auto">{relativeTime(s.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}