import type { ReactNode } from "react";
import { Cloud, Code2, FolderKanban, Home, Inbox, ListTodo, Loader2, PenLine, Search, Shuffle, Sparkles, Target, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AskMode, QaItem, SearchHits } from "./types";

const ASK_MODE_LABEL: { value: AskMode; label: string; icon: ReactNode; hint: string }[] = [
  { value: "local", label: "本地", icon: <Home className="size-3" />, hint: "仅检索你自己的笔记" },
  { value: "ima", label: "ima", icon: <Cloud className="size-3" />, hint: "仅实时检索你的 ima 知识库" },
  { value: "mixed", label: "混合", icon: <Shuffle className="size-3" />, hint: "本地笔记 + ima 合并检索（默认）" },
];

interface SearchPanelProps {
  open: boolean;
  query: string;
  setQuery: (v: string) => void;
  hits: SearchHits | null;
  onClose: () => void;
  goto: (view: string, tab?: string) => void;
  onInbox: () => void;
  jumpToNote: (id: string) => void;
  openSnippet: (id: string) => void;
  qa: QaItem[];
  question: string;
  setQuestion: (v: string) => void;
  askMode: AskMode;
  setAskMode: (m: AskMode) => void;
  asking: boolean;
  ask: () => void;
}

export function SearchPanel({
  open,
  query,
  setQuery,
  hits,
  onClose,
  goto,
  onInbox,
  jumpToNote,
  openSnippet,
  qa,
  question,
  setQuestion,
  askMode,
  setAskMode,
  asking,
  ask,
}: SearchPanelProps) {
  if (!open) return null;
  return (
    <div className="absolute right-0 top-11 z-40 w-[380px] origin-top-right animate-in fade-in-0 zoom-in-95 duration-150 overflow-hidden rounded-xl border border-border bg-white shadow-2xl shadow-primary/15">
      <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2.5">
        <Search className="size-3.5 text-muted-foreground" />
        <input
          value={query}
          onChange={(ev) => setQuery(ev.target.value)}
          placeholder="搜索笔记 / 任务 / 策略 / 代码片段…"
          autoFocus
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          onClick={onClose}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="关闭搜索"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="max-h-[50vh] space-y-3 overflow-y-auto p-3">
        {/* 关键词结果 */}
        {(() => {
          if (!hits) {
            const quickCmds = [
              { label: "首页", icon: Home, run: () => goto("dashboard") },
              { label: "记一笔", icon: PenLine, run: () => goto("workbench", "input") },
              { label: "任务看板", icon: ListTodo, run: () => goto("workbench", "kanban") },
              { label: "项目", icon: FolderKanban, run: () => goto("workbench", "projects") },
              { label: "策略", icon: Target, run: () => goto("workbench", "strategies") },
              { label: "代码片段", icon: Code2, run: () => goto("workbench", "snippets") },
              { label: "收件箱", icon: Inbox, run: () => onInbox() },
            ];
            return (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {quickCmds.map((c) => (
                    <button
                      key={c.label}
                      onClick={() => { c.run(); onClose(); }}
                      className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/20 px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                    >
                      <c.icon className="size-3.5" />
                      {c.label}
                    </button>
                  ))}
                </div>
                <p className="px-1 pb-1 text-[11px] leading-relaxed text-muted-foreground">
                  输入关键词即时搜索全部内容；需要综合多个笔记给结论时，在下方「智能问答」提问。
                </p>
              </div>
            );
          }
          const { noteHits, taskHits, strategyHits, snippetHits, total } = hits;
          if (!total) {
            return (
              <p className="px-1 py-1 text-[11px] text-muted-foreground">
                没有找到「{query}」相关内容，试试在下方交给智能问答。
              </p>
            );
          }
          return (
            <div className="space-y-2.5">
              {noteHits.length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] font-medium text-primary">笔记</div>
                  {noteHits.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => { jumpToNote(n.id); onClose(); }}
                      className="block w-full truncate rounded-md px-2 py-1 text-left text-xs text-foreground transition hover:bg-muted"
                    >
                      {n.title || "（未命名）"} <span className="text-muted-foreground">· {n.category || "随手记"}</span>
                    </button>
                  ))}
                </div>
              )}
              {taskHits.length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] font-medium text-primary">任务</div>
                  {taskHits.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { goto("workbench", "kanban"); onClose(); }}
                      className="block w-full truncate rounded-md px-2 py-1 text-left text-xs text-foreground transition hover:bg-muted"
                    >
                      {t.title}
                    </button>
                  ))}
                </div>
              )}
              {strategyHits.length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] font-medium text-primary">策略</div>
                  {strategyHits.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { goto("workbench", "strategies"); onClose(); }}
                      className="block w-full truncate rounded-md px-2 py-1 text-left text-xs text-foreground transition hover:bg-muted"
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              )}
              {snippetHits.length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] font-medium text-primary">代码片段</div>
                  {snippetHits.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { openSnippet(s.id); onClose(); }}
                      className="block w-full truncate rounded-md px-2 py-1 text-left text-xs text-foreground transition hover:bg-muted"
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* 智能问答（并入全局搜索） */}
        <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            <span className="text-[11px] font-medium text-foreground">智能问答 · 基于全部笔记</span>
          </div>
          {qa.length > 0 && (
            <div className="mb-2 max-h-40 space-y-1.5 overflow-y-auto">
              {qa.slice(-3).map((item, i) => (
                <div key={i} className="rounded-md bg-white/70 p-2">
                  <div className="text-xs font-medium text-foreground">{item.q}</div>
                  <div className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">{item.a}</div>
                  {item.sources.length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {item.sources.map((s, si) =>
                        s.source === "ima" ? (
                          <span key={si} className="truncate rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-600">{s.title} · ima</span>
                        ) : (
                          <button
                            key={si}
                            type="button"
                            onClick={() => { jumpToNote(s.noteId); onClose(); }}
                            className="max-w-full truncate rounded-full bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground transition hover:text-primary"
                          >
                            {s.title} · 本地
                          </button>
                        ),
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1">
            <div className="flex shrink-0 overflow-hidden rounded-md border border-border/70 bg-white text-[11px] shadow-sm backdrop-blur">
              {ASK_MODE_LABEL.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setAskMode(m.value)}
                  title={m.hint}
                  className={
                    "flex items-center gap-1 px-2 py-1 transition " +
                    (askMode === m.value
                      ? "bg-gradient-to-r from-primary to-primary/85 text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>
            <input
              value={question}
              onChange={(ev) => setQuestion(ev.target.value)}
              onKeyDown={(ev) => ev.key === "Enter" && ask()}
              placeholder="例如：上次会议关于用户增长的结论？"
              className="min-w-0 flex-1 rounded-md border border-border bg-white px-2 py-1 text-xs outline-none focus:border-primary"
            />
            <Button onClick={ask} disabled={!question.trim() || asking} className="shrink-0 text-[11px]">
              {asking ? <Loader2 className="size-3 animate-spin" /> : "提问"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}