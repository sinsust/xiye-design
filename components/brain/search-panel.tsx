"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import {
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Cloud,
  Code2,
  FolderKanban,
  Home,
  Inbox,
  ListTodo,
  Loader2,
  PenLine,
  Search,
  Shuffle,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import type { AskMode, QaItem, SearchHits } from "./types";
import { ASK_SOURCE_LABEL } from "./types";

/** 命中词高亮：把 text 中首次出现的 query 包成 <mark>，一眼判断是否命中（P1-2） */
function highlight(text: string, q: string) {
  const key = q.trim();
  if (!key) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(key.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-primary/25 px-0.5 text-primary">{text.slice(idx, idx + key.length)}</mark>
      {text.slice(idx + key.length)}
    </>
  );
}

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
  // P1-3：问答存为笔记后的回调（父级刷新列表，让新笔记立即可见）
  onNoteSaved?: () => void;
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
  onNoteSaved,
}: SearchPanelProps) {
  // P1-2：回答默认三行截断，可展开看全文
  const [openQa, setOpenQa] = useState<number | null>(null);
  // P1-3：问答落库为笔记（此前只在内存，刷新即丢）
  const [savingQa, setSavingQa] = useState<number | null>(null);
  const [savedQa, setSavedQa] = useState<number | null>(null);

  const saveAsNote = async (item: QaItem, i: number) => {
    setSavingQa(i);
    try {
      const res = await fetch("/api/brain/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `问答：${item.q}`.slice(0, 60),
          content: [
            `【问题】\n${item.q}`,
            `\n【回答】\n${item.a}`,
            item.sources.length
              ? `\n【参考来源】\n${item.sources
                  .map((s) => `- ${s.title}（${ASK_SOURCE_LABEL[s.source] ?? s.source}）`)
                  .join("\n")}`
              : "",
          ].join("\n"),
          summary: item.a.slice(0, 200),
          category: "问答",
          tags: ["问答"],
        }),
      });
      if (res.ok) {
        setSavedQa(i);
        window.setTimeout(() => setSavedQa(null), 2000);
        onNoteSaved?.();
      }
    } catch {
      /* 保存失败静默，用户可重试 */
    }
    setSavingQa(null);
  };

  if (!open) return null;
  return (
    <div className="absolute right-0 top-11 z-40 w-[380px] origin-top-right animate-in fade-in-0 zoom-in-95 duration-150 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
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
                  输入关键词即时搜索全部内容；需要综合多个笔记给结论时，在下方「问我的记忆」提问。
                </p>
              </div>
            );
          }
          const { noteHits, taskHits, strategyHits, snippetHits, total } = hits;
          if (!total) {
            return (
              <p className="px-1 py-1 text-[11px] text-muted-foreground">
                没有找到「{query}」相关内容，试试在下方交给问我的记忆。
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
                      className="block w-full rounded-md px-2 py-1.5 text-left transition hover:bg-muted"
                    >
                      <div className="truncate text-xs text-foreground">
                        {highlight(n.title || "（未命名）", query)}{" "}
                        <span className="text-muted-foreground">· {n.category || "随手记"}</span>
                      </div>
                      {/* P1-2：露出摘要/原文片段，不必逐条点开就能判断是否命中 */}
                      {(n.summary || n.content) && (
                        <div className="mt-0.5 line-clamp-1 text-[10px] leading-relaxed text-muted-foreground">
                          {highlight((n.summary || n.content).replace(/\s+/g, " ").slice(0, 80), query)}
                        </div>
                      )}
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
                      {highlight(s.title, query)}
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
                      {highlight(s.title, query)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* 问我的记忆（并入全局搜索，命名与今日空间一致） */}
        <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            <span className="text-[11px] font-medium text-foreground">问我的记忆 · 基于全部笔记</span>
          </div>
          {qa.length > 0 && (
            <div className="mb-2 max-h-40 space-y-1.5 overflow-y-auto">
              {qa.slice(-3).map((item, i) => (
                <div key={i} className="rounded-md bg-card/70 p-2">
                  <div className="flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{item.q}</span>
                    {item.semantic === false && (
                      <span
                        className="shrink-0 rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-normal text-warning"
                        title="语义向量未启用（未配置 EMBEDDING_ENABLED 或模型不可用），已用关键词匹配"
                      >
                        关键词匹配
                      </span>
                    )}
                    <CopyButton
                      text={item.a}
                      size="xs"
                      iconOnly
                      title="复制回答全文"
                      className="ml-auto inline-flex shrink-0 items-center rounded-md border border-border/70 px-1 py-0.5 text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                    />
                    {/* P1-3：把这条问答存为笔记（此前只在内存，刷新即丢） */}
                    <button
                      type="button"
                      onClick={() => saveAsNote(item, i)}
                      disabled={savingQa === i}
                      title="把这条问答存为笔记"
                      className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-border/70 px-1 py-0.5 text-[10px] text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary disabled:opacity-60"
                    >
                      {savedQa === i ? (
                        <>
                          <Check className="size-3 text-success" />
                          已存
                        </>
                      ) : savingQa === i ? (
                        <>
                          <Loader2 className="size-3 animate-spin" />
                          存入
                        </>
                      ) : (
                        <>
                          <BookmarkPlus className="size-3" />
                          存为笔记
                        </>
                      )}
                    </button>
                  </div>
                  <div
                    className={
                      "mt-0.5 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground " +
                      (openQa === i ? "" : "line-clamp-3")
                    }
                  >
                    {item.a}
                  </div>
                  {/* P1-2：长回答可展开看全文（此前 line-clamp-3 砍掉后无法查看） */}
                  {item.a.length > 120 && (
                    <button
                      type="button"
                      onClick={() => setOpenQa(openQa === i ? null : i)}
                      className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-primary transition hover:opacity-80"
                    >
                      {openQa === i ? (
                        <>
                          <ChevronUp className="size-3" />
                          收起
                        </>
                      ) : (
                        <>
                          <ChevronDown className="size-3" />
                          展开全文
                        </>
                      )}
                    </button>
                  )}
                  {item.sources.length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {item.sources.map((s, si) => {
                        const label = ASK_SOURCE_LABEL[s.source] ?? s.source;
                        // ima 实时检索的 noteId 指向远端文档（格式 ima-xxx），无本地笔记可跳转
                        const external = s.source === "ima";
                        const cls =
                          s.source === "ima" || s.source === "ima-synced"
                            ? "bg-info/10 text-info"
                            : s.source === "obsidian"
                              ? "bg-primary/10 text-primary"
                              : "bg-muted/70 text-muted-foreground";
                        return external ? (
                          <span
                            key={si}
                            className={`truncate rounded-full px-1.5 py-0.5 text-[10px] ${cls}`}
                          >
                            {s.title} · {label}
                            {s.sourceName ? ` · ${s.sourceName}` : ""}
                          </span>
                        ) : (
                          <button
                            key={si}
                            type="button"
                            onClick={() => { jumpToNote(s.noteId); onClose(); }}
                            className={`max-w-full truncate rounded-full px-1.5 py-0.5 text-[10px] transition hover:text-primary ${cls}`}
                          >
                            {s.title} · {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1">
            <div className="flex shrink-0 overflow-hidden rounded-md border border-border/70 bg-card text-[11px] shadow-sm backdrop-blur">
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
              className="min-w-0 flex-1 rounded-md border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary"
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