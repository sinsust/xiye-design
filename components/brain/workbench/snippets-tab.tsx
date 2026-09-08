import { Check, Copy, Star } from "lucide-react";
import {
  inputCls,
  langColor,
  langLabel,
  snippetPreview,
  highlightCode,
  relativeTime,
} from "../brain-utils";
import type { BrainNote } from "../types";

/** 语言归一：别名/方言映射到主语言，未知归「其他」 */
const LANG_HOME: Record<string, string> = {
  javascript: "javascript", js: "javascript", node: "javascript",
  typescript: "javascript", ts: "javascript",
  python: "python", py: "python",
  sql: "sql", postgresql: "sql", mysql: "sql",
  shell: "shell", bash: "shell", sh: "shell", zsh: "shell", powershell: "shell", batch: "shell",
};
const KNOWN = new Set(["python", "javascript", "sql", "shell"]);
const LANG_ORDER = ["python", "javascript", "sql", "shell"];

function home(language: string | null): string {
  const k = (language || "").toLowerCase().replace(/^\./, "");
  return LANG_HOME[k] ?? k;
}
function groupKey(language: string | null): string {
  const h = home(language);
  return KNOWN.has(h) ? h : "其他";
}
function sortLangs(a: string, b: string): number {
  if (a === "其他") return 1;
  if (b === "其他") return -1;
  const ia = LANG_ORDER.indexOf(a);
  const ib = LANG_ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

export interface SnippetsTabProps {
  snippets: BrainNote[];
  snippetLang: string;
  setSnippetLang: (value: string) => void;
  snippetQuery: string;
  setSnippetQuery: (value: string) => void;
  favoriteIds: Set<string>;
  toggleFavorite: (id: string) => void;
  showFavOnly: boolean;
  setShowFavOnly: (value: boolean) => void;
  expandedSnippet: string | null;
  setExpandedSnippet: (value: string | null) => void;
  copiedCode: string | null;
  copyCode: (code: string, id: string) => void;
  jumpToNote: (id: string) => void;
}

export function SnippetsTab({
  snippets,
  snippetLang,
  setSnippetLang,
  snippetQuery,
  setSnippetQuery,
  favoriteIds,
  toggleFavorite,
  showFavOnly,
  setShowFavOnly,
  expandedSnippet,
  setExpandedSnippet,
  copiedCode,
  copyCode,
  jumpToNote,
}: SnippetsTabProps) {
  // 实际出现的语言（动态），决定过滤 chip 与统计
  const langOptions = (() => {
    const set = new Set<string>();
    for (const s of snippets) set.add(groupKey(s.language));
    return [...set].sort(sortLangs);
  })();

  // 过滤 + 分组
  const groups = (() => {
    let arr = snippets;
    if (snippetLang !== "全部") {
      arr = arr.filter((s) =>
        snippetLang === "其他" ? !KNOWN.has(home(s.language)) : home(s.language) === snippetLang.toLowerCase(),
      );
    }
    if (showFavOnly) arr = arr.filter((s) => favoriteIds.has(s.id));
    if (snippetQuery.trim()) {
      const q = snippetQuery.trim().toLowerCase();
      arr = arr.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.codeContent ?? "").toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    const map = new Map<string, BrainNote[]>();
    for (const s of arr) {
      const k = groupKey(s.language);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return [...map.keys()].sort(sortLangs).map((k) => ({ lang: k, items: map.get(k)! }));
  })();

  const totalCount = snippets.length;

  return (
    <div className="mt-3">
      {/* 工具栏：语言过滤 + 收藏 + 搜索 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-[var(--radius)] border border-border bg-muted/40 p-0.5">
          {["全部", ...langOptions].map((lang) => (
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
              {lang === "全部" ? "全部" : (langLabel(lang) || lang)}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowFavOnly(!showFavOnly)}
          className={
            "inline-flex items-center gap-1 rounded-[var(--radius)] border px-2 py-1 text-xs transition " +
            (showFavOnly
              ? "border-warning/30 bg-warning/10 text-warning"
              : "border-border text-muted-foreground hover:text-foreground")
          }
          title="仅看收藏"
        >
          <Star className={"size-3.5 " + (showFavOnly ? "fill-amber-400 text-warning" : "")} />
          收藏
        </button>
        <div className="relative ml-auto min-w-0 flex-1">
          <input
            value={snippetQuery}
            onChange={(ev) => setSnippetQuery(ev.target.value)}
            placeholder="搜索代码 / 标题 / 标签…"
            className={inputCls + " w-full text-xs"}
          />
        </div>
      </div>

      {/* 语言索引统计 */}
      {totalCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            共 <span className="font-medium text-foreground">{totalCount}</span> 段代码
          </span>
          {langOptions.map((l) => (
            <span key={l} className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full" style={{ background: langColor(l === "其他" ? null : l) }} />
              {langLabel(l) || l}
              <span className="text-foreground/80">
                {snippets.filter((s) => groupKey(s.language) === l).length}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* 分组列表 */}
      {groups.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
          {totalCount === 0
            ? "还没有代码片段。在「记一笔」里粘贴一段代码，AI 会自动识别并分类保存。"
            : "没有匹配的代码片段。"}
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.lang} className="mb-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: langColor(g.lang === "其他" ? null : g.lang) }} />
              <h3 className="text-sm font-semibold text-foreground">{langLabel(g.lang) || g.lang}</h3>
              <span className="rounded-full bg-muted px-1.5 py-px text-[11px] text-muted-foreground">{g.items.length}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {g.items.map((s) => {
                const open = expandedSnippet === s.id;
                const fav = favoriteIds.has(s.id);
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
                        {langLabel(s.language) || s.language || "代码"}
                      </span>
                      <button
                        className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground transition hover:text-primary"
                        onClick={() => jumpToNote(s.id)}
                        title="跳转到原笔记"
                      >
                        {s.title}
                      </button>
                      <button
                        className={
                          "inline-flex shrink-0 items-center rounded-[var(--radius)] border border-border px-1.5 py-0.5 text-[11px] transition " +
                          (fav ? "border-warning/30 text-warning" : "text-muted-foreground hover:text-foreground")
                        }
                        onClick={() => toggleFavorite(s.id)}
                        title={fav ? "取消收藏" : "收藏"}
                      >
                        <Star className={"size-3 " + (fav ? "fill-amber-400 text-warning" : "")} />
                      </button>
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
                      <code>{highlightCode(open ? s.codeContent ?? "" : snippetPreview(s.codeContent ?? "", 3), snippetQuery)}</code>
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
                      <button
                        className="rounded-[var(--radius)] px-1 py-0.5 text-muted-foreground transition hover:text-primary"
                        onClick={() => jumpToNote(s.id)}
                      >
                        查看原笔记 ↗
                      </button>
                      <span className="ml-auto">{relativeTime(s.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
