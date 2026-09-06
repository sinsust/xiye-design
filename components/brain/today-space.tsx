"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronRight,
  Lightbulb,
  Loader2,
  NotebookPen,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// —— 与 GET /api/brain/today 响应对齐的本地类型 ——
interface TodayCard {
  kind: "sm2" | "learning";
  reviewId: string;
  noteId: string;
  noteTitle: string;
  noteCategory: string;
  nextTs: number;
}
interface RecentNoteMeta {
  id: string;
  title: string;
  category: string;
  tags: string[];
  source: string;
  summary: string;
  createdAt: number;
}
interface WeeklySummary {
  weekLabel: string;
  periodEnd: number;
  summary: string;
  updatedAt: number;
}
interface TodayResponse {
  todayReviews: TodayCard[];
  recentNotes: RecentNoteMeta[];
  weeklySummary: WeeklySummary | null;
}
interface AskSource {
  noteId: string;
  title: string;
  source: "local" | "ima";
  sourceName?: string;
  relevance?: number;
}

export function TodaySpace({ onOpenDashboard }: { onOpenDashboard?: () => void }) {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 顶部即时收录
  const [batchText, setBatchText] = useState("");
  const [composing, setComposing] = useState(false);
  const [composeError, setComposeError] = useState("");
  const [receipt, setReceipt] = useState<{ noteId: string; title: string }[]>([]);

  // 复习动作中
  const [busyReview, setBusyReview] = useState<string | null>(null);

  // 周摘要
  const [weeklyLoading, setWeeklyLoading] = useState(false);

  // 问我的记忆
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [askAnswer, setAskAnswer] = useState("");
  const [askSources, setAskSources] = useState<AskSource[]>([]);
  const [askError, setAskError] = useState("");

  // 笔记详情弹层
  const [openNote, setOpenNote] = useState<RecentNoteMeta | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/brain/today");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "加载今日空间失败");
      setData(json as TodayResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载今日空间失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // —— 顶部即时收录：默认 auto-apply 入库（决策 15/16）——
  const submit = async () => {
    const blocks = batchText
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean);
    if (!blocks.length || composing) return;
    setComposing(true);
    setComposeError("");
    try {
      const res = await fetch("/api/brain/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: blocks.map((rawContent) => ({ rawContent })), autoApply: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "收录失败");
      const applied = Array.isArray(json.items)
        ? json.items
            .filter((a: { noteId?: string }) => a?.noteId)
            .map((a: { noteId: string; suggestedTitle?: string; rawContent?: string }) => ({
              noteId: a.noteId,
              title: a.suggestedTitle || String(a.rawContent || "").slice(0, 40) || "已收录",
            }))
        : [];
      setReceipt((prev) => [...applied, ...prev].slice(0, 6));
      setBatchText("");
      await load();
    } catch (e) {
      setComposeError(e instanceof Error ? e.message : "收录失败");
    } finally {
      setComposing(false);
    }
  };

  const undoNote = async (noteId: string) => {
    try {
      await fetch(`/api/brain/notes?id=${encodeURIComponent(noteId)}`, { method: "DELETE" });
      setReceipt((prev) => prev.filter((a) => a.noteId !== noteId));
    } catch {
      /* 忽略 */
    }
  };

  // —— 复习动作 ——
  const actSm2 = async (id: string, action: "complete" | "skip") => {
    setBusyReview(id);
    try {
      await fetch(`/api/brain/reviews?id=${encodeURIComponent(id)}&action=${action}`, { method: "POST" });
      await load();
    } finally {
      setBusyReview(null);
    }
  };
  const actLearning = async (id: string, action: "mastered" | "not_sure" | "snooze") => {
    setBusyReview(id);
    try {
      await fetch(`/api/brain/learning-reviews/${encodeURIComponent(id)}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await load();
    } finally {
      setBusyReview(null);
    }
  };

  // —— 周摘要生成 ——
  const genWeekly = async () => {
    setWeeklyLoading(true);
    try {
      await fetch("/api/brain/weekly-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ at: Date.now() }),
      });
      await load();
    } finally {
      setWeeklyLoading(false);
    }
  };

  // —— 问我的记忆 ——
  const ask = async () => {
    if (!question.trim() || asking) return;
    setAsking(true);
    setAskError("");
    setAskAnswer("");
    setAskSources([]);
    try {
      const res = await fetch("/api/brain/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, mode: "mixed" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "提问失败");
      setAskAnswer(json.answer || "");
      setAskSources(Array.isArray(json.sources) ? json.sources : []);
    } catch (e) {
      setAskError(e instanceof Error ? e.message : "提问失败");
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      {/* —— 顶部：随手记 + 即时收录 —— */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-foreground">
          <NotebookPen className="size-4 text-primary" />
          随手记
        </div>
        <textarea
          value={batchText}
          onChange={(e) => setBatchText(e.target.value)}
          placeholder="今天想记点什么？粘贴一段内容，AI 自动整理、分类并入库。多段之间空一行可一次收录多条。"
          className="max-h-[160px] min-h-[72px] w-full resize-y rounded-lg border border-muted bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
          rows={3}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">AI 即时收录进记忆，可随时撤销</span>
          <Button size="sm" onClick={submit} disabled={!batchText.trim() || composing}>
            {composing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            即时收录
          </Button>
        </div>
        {composeError && <p className="mt-2 text-xs text-destructive">{composeError}</p>}
        {receipt.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-border pt-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-600">已收录 {receipt.length} 条</span>
              <button onClick={() => setReceipt([])} className="text-[11px] text-muted-foreground transition hover:text-foreground">
                清空
              </button>
            </div>
            {receipt.map((a) => (
              <div key={a.noteId} className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs">
                <BookOpen className="size-3.5 shrink-0 text-emerald-600" />
                <span className="flex-1 truncate text-foreground">{a.title}</span>
                <button onClick={() => undoNote(a.noteId)} className="shrink-0 text-muted-foreground transition hover:text-destructive" aria-label="撤销">
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* —— 今日复习 —— */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
            <RefreshCw className="size-4 text-primary" />
            今日复习
            {data && data.todayReviews.length > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{data.todayReviews.length}</span>
            )}
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> 加载中…
          </div>
        ) : data && data.todayReviews.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">今天没有待复习的卡片，继续保持 🎉</p>
        ) : (
          <div className="space-y-2">
            {data?.todayReviews.map((c) => (
              <div key={c.reviewId} className="rounded-lg border border-border bg-background px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[11px] font-medium " +
                      (c.kind === "sm2" ? "bg-sky-500/10 text-sky-600" : "bg-violet-500/10 text-violet-600")
                    }
                  >
                    {c.kind === "sm2" ? "间隔复习" : "学习复习"}
                  </span>
                  {c.noteCategory && <span className="text-[11px] text-muted-foreground">{c.noteCategory}</span>}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{c.noteTitle}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.kind === "sm2" ? (
                    <>
                      <Button
                        size="sm"
                        disabled={busyReview === c.reviewId}
                        onClick={() => actSm2(c.reviewId, "complete")}
                      >
                        {busyReview === c.reviewId ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                        记得
                      </Button>
                      <Button size="sm" variant="outline" disabled={busyReview === c.reviewId} onClick={() => actSm2(c.reviewId, "skip")}>
                        稍后
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        disabled={busyReview === c.reviewId}
                        onClick={() => actLearning(c.reviewId, "mastered")}
                      >
                        {busyReview === c.reviewId ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                        已掌握
                      </Button>
                      <Button size="sm" variant="outline" disabled={busyReview === c.reviewId} onClick={() => actLearning(c.reviewId, "not_sure")}>
                        不确定
                      </Button>
                      <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={busyReview === c.reviewId} onClick={() => actLearning(c.reviewId, "snooze")}>
                        稍后
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* —— 最近记录 —— */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-foreground">
          <BookOpen className="size-4 text-primary" />
          最近记录
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> 加载中…
          </div>
        ) : data && data.recentNotes.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">还没有记录，从上方「随手记」开始吧</p>
        ) : (
          <div className="space-y-1.5">
            {data?.recentNotes.map((n) => (
              <button
                key={n.id}
                onClick={() => setOpenNote(n)}
                className="flex w-full items-start gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left transition hover:border-border hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {n.category && <span className="rounded-full bg-muted px-1.5 py-px text-[11px] text-muted-foreground">{n.category}</span>}
                    <span className="truncate text-sm font-medium text-foreground">{n.title}</span>
                  </div>
                  {n.summary && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.summary}</p>}
                </div>
                <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/50" />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* —— 本周摘要 —— */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
            <Lightbulb className="size-4 text-primary" />
            本周摘要
          </div>
          <Button size="sm" variant="outline" disabled={weeklyLoading} onClick={genWeekly}>
            {weeklyLoading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            生成 / 刷新
          </Button>
        </div>
        {data?.weeklySummary ? (
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">{data.weeklySummary.weekLabel}</div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{data.weeklySummary.summary}</p>
          </div>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">尚未生成本周摘要，点「生成 / 刷新」让 AI 总结本周收获。</p>
        )}
      </section>

      {/* —— 问我的记忆 —— */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-foreground">
          <Sparkles className="size-4 text-primary" />
          问我的记忆
        </div>
        <div className="flex items-end gap-2">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask();
            }}
            placeholder="问我任何关于你笔记里的内容，例如「上周会议里关于上线时间的结论是什么？」"
            className="max-h-[120px] min-h-[44px] flex-1 resize-y rounded-lg border border-muted bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
            rows={2}
          />
          <Button size="sm" onClick={ask} disabled={!question.trim() || asking}>
            {asking ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            提问
          </Button>
        </div>
        {askError && <p className="mt-2 text-xs text-destructive">{askError}</p>}
        {askAnswer && (
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{askAnswer}</p>
            {askSources.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {askSources.map((s) => (
                  <span key={s.noteId} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {s.source === "ima" ? "ima" : "本地"}
                    {s.sourceName ? ` · ${s.sourceName}` : ""}
                    <span className="text-foreground">· {s.title}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* —— 入口：完整看板（高级工具） —— */}
      <div className="flex justify-center pb-4">
        <Button variant="ghost" className="text-muted-foreground" onClick={onOpenDashboard}>
          打开完整看板
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* —— 笔记详情弹层 —— */}
      {openNote && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setOpenNote(null)}>
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                {openNote.category && <span className="rounded-full bg-muted px-1.5 py-px text-[11px] text-muted-foreground">{openNote.category}</span>}
                <h3 className="mt-1 text-base font-semibold text-foreground">{openNote.title}</h3>
              </div>
              <button onClick={() => setOpenNote(null)} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="关闭">
                <X className="size-4" />
              </button>
            </div>
            {openNote.tags.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {openNote.tags.map((t) => (
                  <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                    {t}
                  </span>
                ))}
              </div>
            )}
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {openNote.summary || "（暂无摘要）"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
