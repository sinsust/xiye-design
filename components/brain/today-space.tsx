"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookmarkPlus,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  Lightbulb,
  Loader2,
  NotebookPen,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { SkeletonRows } from "@/components/ui/skeleton";
import type { OrganizedNote } from "@/lib/brain-organizer";

// —— 与 GET /api/brain/today 响应对齐的本地类型 ——
interface TodayCard {
  kind: "sm2" | "learning";
  reviewId: string;
  noteId: string;
  noteTitle: string;
  noteCategory: string;
  nextTs: number;
  noteSummary: string;
  noteContentPreview: string;
}
interface RecentNoteMeta {
  id: string;
  title: string;
  category: string;
  tags: string[];
  source: string;
  summary: string;
  // M4 修复：原文 + 结构化整理一并透出，详情弹层才能看到当初输入（不再只有摘要）
  content: string;
  struct: string | null;
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

/* ═══ 标签配色：系统标签固定色 + 自定义标签哈希确定性分配 ═══ */
const TAG_PALETTE = [
  { bg: "bg-info", text: "text-info", ring: "ring-info/30" },   // 0 工作
  { bg: "bg-warning", text: "text-warning", ring: "ring-warning/30" }, // 1 阅读
  { bg: "bg-rose-50/80", text: "text-rose-600", ring: "ring-rose-200/60" },    // 2 随手记
  { bg: "bg-slate-100/80", text: "text-slate-600", ring: "ring-slate-200/60" },// 3 文档
  { bg: "bg-success", text: "text-success", ring: "ring-success/30" }, // 4 技术
  { bg: "bg-violet-500/15", text: "text-violet-700 dark:text-violet-300", ring: "ring-violet-500/30" }, // 5 待办
  { bg: "bg-purple-500/15", text: "text-purple-700 dark:text-purple-300", ring: "ring-purple-500/30" }, // 6 学习
  { bg: "bg-cyan-50/80", text: "text-cyan-700", ring: "ring-cyan-200/60" },     // 7 灵感
  { bg: "bg-teal-50/80", text: "text-teal-700", ring: "ring-teal-200/60" },     // 8 问答
  { bg: "bg-warning", text: "text-warning", ring: "ring-warning/30" },// 9 自定义兜底
] as const;

const SYSTEM_TAG_MAP: Record<string, number> = {
  工作: 0, 阅读读: 1, 阅读: 1, 随手记: 2, 文档: 3,
  技术: 4, 待办: 5, 学习: 6, 灵感: 7, 问答: 8,
};

function tagStyle(tag: string): (typeof TAG_PALETTE)[number] {
  const idx = SYSTEM_TAG_MAP[tag];
  if (idx !== undefined) return TAG_PALETTE[idx];
  // 哈希确定性：同一标签每次颜色一致
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = ((h << 5) - h + tag.charCodeAt(i)) | 0;
  return TAG_PALETTE[Math.abs(h) % TAG_PALETTE.length];
}

export function TodaySpace({ onOpenDashboard }: { onOpenDashboard?: () => void }) {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // 已有内容时二次刷新不清空整页：让最近记录/复习保持可见，等新响应回来再替换。
  const dataRef = useRef<TodayResponse | null>(null);
  const loadToken = useRef(0);

  // 顶部即时收录
  const [batchText, setBatchText] = useState("");
  const [composing, setComposing] = useState(false);
  const [composeError, setComposeError] = useState("");
  const [receipt, setReceipt] = useState<{ noteId: string; title: string }[]>([]);

  // 复习动作中
  const [busyReview, setBusyReview] = useState<string | null>(null);
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set());
  const toggleReview = (id: string) =>
    setExpandedReviews((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // 周摘要
  const [weeklyLoading, setWeeklyLoading] = useState(false);

  // 问我的记忆
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [askAnswer, setAskAnswer] = useState("");
  const [askSources, setAskSources] = useState<AskSource[]>([]);
  const [askError, setAskError] = useState("");
  // P1-3：问答存为笔记（此前问答只在内存，刷新即丢）
  const [savingAsk, setSavingAsk] = useState(false);
  const [savedAsk, setSavedAsk] = useState(false);

  // 笔记详情弹层
  const [openNote, setOpenNote] = useState<RecentNoteMeta | null>(null);

  const load = useCallback(async (silent = false) => {
    const token = ++loadToken.current;
    const hadData = dataRef.current !== null;
    if (!hadData || !silent) {
      setLoading(true);
      setError("");
    }
    try {
      const res = await fetch("/api/brain/today");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "加载今日空间失败");
      if (token !== loadToken.current) return;
      setData(json as TodayResponse);
      dataRef.current = json as TodayResponse;
    } catch (e) {
      if (token !== loadToken.current) return;
      if (!dataRef.current) setError(e instanceof Error ? e.message : "加载今日空间失败");
    } finally {
      if (token !== loadToken.current) return;
      if (!dataRef.current || !silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 从完整看板/抽屉操作回来时静默刷新，不整页闪骨架。
  useEffect(() => {
    const refresh = () => void load(true);
    const onFocus = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    window.addEventListener("brain:today-refresh", refresh);
    window.addEventListener("brain:dashboard-refresh", refresh);
    window.addEventListener("focus", onFocus);
    return () => {
      loadToken.current += 1;
      window.removeEventListener("brain:today-refresh", refresh);
      window.removeEventListener("brain:dashboard-refresh", refresh);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  // —— 顶部即时收录：默认 auto-apply 入库（决策 15/16）——
  const submit = async () => {
    const text = batchText.trim();
    if (!text || composing) return;
    setComposing(true);
    setComposeError("");
    try {
      const res = await fetch("/api/brain/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ rawContent: text }], autoApply: true }),
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
      await load(true);
      // AI 整理已转后台（保存优先，决策 15 v2）：延迟刷新两次拉取整理增强结果
      setTimeout(() => { void load(true); }, 6000);
      setTimeout(() => { void load(true); }, 15000);
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
      await load(true);
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
      await load(true);
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
      await load(true);
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

  // —— P1-3：把这条问答存为笔记（此前问答只在内存，刷新即丢）——
  const saveAskAsNote = async () => {
    if (!askAnswer.trim() || savingAsk) return;
    setSavingAsk(true);
    try {
      const res = await fetch("/api/brain/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `问答：${question.trim()}`.slice(0, 60),
          content: [
            `【问题】\n${question.trim()}`,
            `\n【回答】\n${askAnswer}`,
            askSources.length
              ? `\n【参考来源】\n${askSources.map((s) => `- ${s.title}`).join("\n")}`
              : "",
          ].join("\n"),
          summary: askAnswer.slice(0, 200),
          category: "问答",
          tags: ["问答"],
        }),
      });
      if (res.ok) {
        setSavedAsk(true);
        window.setTimeout(() => setSavedAsk(false), 2000);
        await load(true);
      }
    } catch {
      /* 保存失败静默，用户可重试 */
    }
    setSavingAsk(false);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* —— 双栏网格：左侧主内容区(2/3) + 右侧动作栏(1/3) —— */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        {/* ═══ 左栏（2/3）═══ */}
        <div className="space-y-5 lg:col-span-2">
          {/* —— 顶部：随手记 + 即时收录 —— */}
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-foreground">
              <NotebookPen className="size-4 text-primary" />
              随手记
            </div>
            <textarea
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              onKeyDown={(e) => {
                // P3-1：Cmd/Ctrl+Enter 快捷收录（Enter 保持换行，符合多行输入直觉）
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder="今天想记点什么？整段内容会被收录为「一条记录」，AI 自动整理、分类并入库。"
              className="max-h-[160px] min-h-[72px] w-full resize-y rounded-lg border border-muted bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
              rows={3}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">
                AI 即时收录进记忆，可随时撤销 · <kbd className="rounded border border-border px-1 text-[10px]">⌘/Ctrl + Enter</kbd> 收录
              </span>
              <Button size="sm" onClick={submit} disabled={!batchText.trim() || composing}>
                {composing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                即时收录
              </Button>
            </div>
            {composeError && <p className="mt-2 text-xs text-destructive">{composeError}</p>}
            {receipt.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-success">已收录 {receipt.length} 条</span>
                  <button onClick={() => setReceipt([])} className="text-[11px] text-muted-foreground transition hover:text-foreground">
                    清空
                  </button>
                </div>
                {receipt.map((a) => (
                  <div key={a.noteId} className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs">
                    <BookOpen className="size-3.5 shrink-0 text-success" />
                    <span className="flex-1 truncate text-foreground">{a.title}</span>
                    <button onClick={() => undoNote(a.noteId)} className="shrink-0 text-muted-foreground transition hover:text-destructive" aria-label="撤销">
                      <X className="size-3.5" />
                    </button>
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
              <SkeletonRows rows={3} className="py-1" />
            ) : data && data.recentNotes.length === 0 ? (
              <div className="flex min-h-[180px] flex-col items-center justify-center py-6 text-center">
                <BookOpen className="mb-2 size-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">还没有记录，从上方「随手记」开始吧</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {data?.recentNotes.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => setOpenNote(n)}
                    className="flex items-start gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left transition hover:border-border hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {n.category && <span className="rounded-full bg-muted px-1.5 py-px text-[11px] text-muted-foreground">{n.category}</span>}
                        <span className="truncate text-sm font-medium text-foreground">{n.title}</span>
                        {n.struct && (
                          <span title="已 AI 整理" className="shrink-0 text-primary/60">
                            <Sparkles className="size-3" />
                          </span>
                        )}
                      </div>
                      {n.summary && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.summary}</p>}
                      {/* M4 修复：列表直接露出原文片段，用户不必逐条点开就能认出自己记了什么 */}
                      {n.content && (
                        <p className="mt-0.5 line-clamp-1 text-[11px] leading-relaxed text-muted-foreground/70">
                          原文：{n.content}
                        </p>
                      )}
                      {n.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {n.tags.slice(0, 3).map((t) => {
                            const s = tagStyle(t);
                            return (
                              <span key={t} className={`rounded-md ${s.bg} px-1.5 py-px text-[10px] font-medium ring-1 ring-inset ${s.ring} ${s.text}`}>
                                #{t}
                              </span>
                            );
                          })}
                          {n.tags.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{n.tags.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/50" />
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ═══ 右栏（1/3）═══ */}
        <div className="space-y-5">
          {/* —— 今日复习 —— */}
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-foreground">
              <RefreshCw className="size-4 text-primary" />
              今日复习
              {data && data.todayReviews.length > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{data.todayReviews.length}</span>
              )}
            </div>
            {loading ? (
              <SkeletonRows rows={2} className="py-1" />
            ) : data && data.todayReviews.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">今天没有待复习</p>
            ) : (
              <div className="space-y-2">
                {data?.todayReviews.map((c) => {
                  const accent = c.kind === "sm2" ? "border-l-sky-400" : "border-l-violet-400";
                  const badge = c.kind === "sm2" ? "bg-info/10 text-info dark:text-info" : "bg-violet-500/15 text-violet-700 dark:text-violet-300";
                  const preview = c.noteSummary || c.noteContentPreview;
                  const expanded = expandedReviews.has(c.reviewId);
                  return (
                  <div key={c.reviewId} className={`rounded-lg border border-border border-l-2 ${accent} bg-background px-3 py-2.5`}>
                    <div className="flex items-center gap-2">
                      <span className={"rounded-full px-2 py-0.5 text-[11px] font-medium " + badge}>
                        {c.kind === "sm2" ? "间隔复习" : "学习复习"}
                      </span>
                      {c.noteCategory && <span className="text-[11px] text-muted-foreground">{c.noteCategory}</span>}
                    </div>
                    <span className="mt-1 block text-sm font-medium text-foreground">{c.noteTitle}</span>
                    {/* 复习内容预览：让「复习的是啥」一目了然 */}
                    {preview ? (
                      <button
                        onClick={() => toggleReview(c.reviewId)}
                        className="mt-1.5 block w-full text-left"
                      >
                        <p className={"text-[11px] leading-relaxed text-muted-foreground " + (expanded ? "" : "line-clamp-2")}>
                          {preview}
                        </p>
                        <span className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-medium text-primary">
                          <BookOpen className="size-3" />
                          {expanded ? "收起内容" : "查看复习内容"}
                        </span>
                      </button>
                    ) : (
                      <p className="mt-1.5 text-[11px] text-muted-foreground/60">该笔记暂无正文/摘要</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.kind === "sm2" ? (
                        <>
                          <Button size="sm" disabled={busyReview === c.reviewId} onClick={() => actSm2(c.reviewId, "complete")}>
                            {busyReview === c.reviewId ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                            已复习
                          </Button>
                          <Button size="sm" variant="outline" disabled={busyReview === c.reviewId} onClick={() => actSm2(c.reviewId, "skip")}>
                            跳过
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" disabled={busyReview === c.reviewId} onClick={() => actLearning(c.reviewId, "mastered")}>
                            {busyReview === c.reviewId ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                            掌握
                          </Button>
                          <Button size="sm" variant="outline" disabled={busyReview === c.reviewId} onClick={() => actLearning(c.reviewId, "not_sure")}>
                            模糊
                          </Button>
                          <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={busyReview === c.reviewId} onClick={() => actLearning(c.reviewId, "snooze")}>
                            延后
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  );
                })}
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
              </Button>
            </div>
            {data?.weeklySummary ? (
              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">{data.weeklySummary.weekLabel}</div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{data.weeklySummary.summary}</p>
              </div>
            ) : (
              <p className="py-2 text-xs text-muted-foreground">尚未生成本周摘要。</p>
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
                placeholder="问我任何关于你笔记里的内容…"
                className="max-h-[120px] min-h-[44px] flex-1 resize-y rounded-lg border border-muted bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
                rows={2}
              />
              <Button size="sm" onClick={ask} disabled={!question.trim() || asking}>
                {asking ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              </Button>
            </div>
            {askError && <p className="mt-2 text-xs text-destructive">{askError}</p>}
            {askAnswer && (
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-muted-foreground">回答</span>
                  <div className="flex shrink-0 items-center gap-1">
                    <CopyButton text={askAnswer} size="xs" label="复制" />
                    <button
                      type="button"
                      onClick={saveAskAsNote}
                      disabled={savingAsk}
                      title="把这条问答存为笔记"
                      className="inline-flex items-center gap-1 rounded-md border border-border/70 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary disabled:opacity-60"
                    >
                      {savedAsk ? (
                        <>
                          <Check className="size-3 text-success" />
                          已存入笔记
                        </>
                      ) : savingAsk ? (
                        <>
                          <Loader2 className="size-3 animate-spin" />
                          存入中
                        </>
                      ) : (
                        <>
                          <BookmarkPlus className="size-3" />
                          存为笔记
                        </>
                      )}
                    </button>
                  </div>
                </div>
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

          {/* —— 入口：完整看板 —— */}
          <div className="flex justify-center pb-2">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onOpenDashboard}>
              打开完整看板
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* —— 笔记详情弹层 —— */}
      {openNote && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setOpenNote(null)}>
          <div
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 px-5 pt-5">
              <div>
                {openNote.category && <span className="rounded-full bg-muted px-1.5 py-px text-[11px] text-muted-foreground">{openNote.category}</span>}
                <h3 className="mt-1 text-base font-semibold text-foreground">{openNote.title}</h3>
              </div>
              <button onClick={() => setOpenNote(null)} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="关闭">
                <X className="size-4" />
              </button>
            </div>
            {openNote.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-5 pt-2">
                {openNote.tags.map((t) => {
                  const s = tagStyle(t);
                  return (
                    <span key={t} className={`rounded-full ${s.bg} px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${s.ring} ${s.text}`}>
                      #{t}
                    </span>
                  );
                })}
              </div>
            )}
            <NoteDetail note={openNote} />
          </div>
        </div>
      )}
    </div>
  );
}

// —— 详情弹层：原文 + AI 结构化整理 分层渲染 ——
function StructList({ title, items }: { title: string; items: string[] }) {
  // 历史脏数据兜底：AI 曾把对象项误转成 "[object Object]" 字面量入库，这类伪文本过滤掉
  const clean = items.filter(
    (it) => it && !/^\[object (Object|Undefined)\]$/.test(it.trim()),
  );
  if (!clean.length) return null;
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-foreground">{title}</div>
      <ul className="space-y-1">
        {clean.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-foreground/90">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
            <span className="flex-1">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NoteDetail({ note }: { note: RecentNoteMeta }) {
  const struct = useMemo<OrganizedNote | null>(() => {
    if (!note.struct) return null;
    try {
      const parsed = JSON.parse(note.struct) as OrganizedNote;
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }, [note.struct]);

  // 有 AI 整理才展示 Tab 切换；否则只显示原文。
  const [tab, setTab] = useState<"raw" | "ai">("raw");
  const hasAi = !!struct;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {hasAi && (
        <div className="mt-3 flex items-center justify-between border-b border-border bg-muted/30 px-5 py-2" role="tablist" aria-label="笔记查看模式">
          <div className="inline-flex rounded-lg bg-muted/60 p-0.5">
            {(["raw", "ai"] as const).map((key) => {
              const active = tab === key;
              const Icon = key === "raw" ? NotebookPen : Sparkles;
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(key)}
                  className={
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition " +
                    (active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  <Icon className="size-3.5" />
                  {key === "raw" ? "原文" : "AI 整理"}
                </button>
              );
            })}
          </div>
          <span className="text-[11px] text-muted-foreground">
            {tab === "raw" ? "用户原始输入" : "AI 结构化整理"}
          </span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {tab === "raw" ? (
          <RawView note={note} />
        ) : struct ? (
          <AiView struct={struct} />
        ) : (
          <p className="text-xs text-muted-foreground">该记录暂未生成结构化整理。</p>
        )}
      </div>
    </div>
  );
}

function RawView({ note }: { note: RecentNoteMeta }) {
  const copyRaw = async () => {
    try {
      await navigator.clipboard.writeText(note.content);
    } catch {
      /* 忽略：剪贴板不可用时静默 */
    }
  };
  return (
    <div className="space-y-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          完整原文
        </span>
        <button
          onClick={copyRaw}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition hover:text-foreground"
          aria-label="复制原文"
        >
          <Copy className="size-3" /> 复制
        </button>
      </div>
      <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-sm leading-relaxed text-foreground">
        {note.content || "（原文为空）"}
      </p>
    </div>
  );
}

function AiView({ struct }: { struct: OrganizedNote }) {
  return (
    <div className="space-y-4">
      {struct.summary && (
        <section>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            摘要
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">{struct.summary}</p>
        </section>
      )}
      <StructList title="要点" items={struct.keyPoints?.map((k) => k.point) ?? []} />
      <StructList title="灵感 / 联想" items={struct.insights ?? []} />
      <StructList title="待探究" items={struct.openQuestions ?? []} />
      {struct.problemDomains?.length ? (
        <section>
          <div className="mb-1.5 text-xs font-medium text-foreground">问题域</div>
          <div className="space-y-2">
            {struct.problemDomains.map((d, i) => (
              <div key={i} className="rounded-lg border border-border bg-background p-3">
                <div className="text-sm font-medium text-foreground">{d.domain}</div>
                {d.status && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{d.status}</p>}
                {d.conclusion && <p className="mt-0.5 text-xs leading-relaxed text-foreground/90">{d.conclusion}</p>}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
