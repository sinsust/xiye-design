"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Bookmark,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Target,
  X,
} from "lucide-react";

// —— 前端视角的复盘数据类型（对应 lib/brain-review.ts 的序列化结构）——
type RefType =
  | "task"
  | "note"
  | "project"
  | "plan"
  | "inbox"
  | "outcome"
  | "strategy"
  | "milestone";
type Tone = "positive" | "risk" | "neutral";

interface ReviewItem {
  id: string;
  refType: RefType;
  refId: string | null;
  title: string;
  reason: string;
  tone: Tone;
  seq: number;
}
interface WeeklyReview {
  weekKey: string;
  weekLabel: string;
  periodStart: number;
  periodEnd: number;
  summary: string;
  counts: {
    completedTasks: number;
    outcomeCount: number;
    confirmedKnowledge: number;
    handledInbox: number;
    overdueTasks: number;
    pendingPlans: number;
    staleInbox: number;
    blockedTasks: number;
    milestonesDue: number;
  };
  progress: { label: string; value: number; hint?: string }[];
  keyResults: ReviewItem[];
  risks: ReviewItem[];
  nextSuggestions: ReviewItem[];
}

const TONE_STYLE: Record<Tone, string> = {
  positive: "border-emerald-200 bg-emerald-50 text-emerald-700",
  risk: "border-red-200 bg-red-50 text-red-700",
  neutral: "border-indigo-200 bg-indigo-50 text-indigo-600",
};
const TONE_ICON: Record<Tone, typeof Target> = {
  positive: CheckCircle2,
  risk: AlertTriangle,
  neutral: Target,
};

export interface WeeklyReviewPanelProps {
  open: boolean;
  onClose: () => void;
  onOpenTask?: (taskId: string) => void;
  onOpenNote?: (noteId: string) => void;
  onOpenPlanPreview?: (planId: string, body: unknown) => void;
  onOpenInbox?: () => void;
}

export function WeeklyReviewPanel(props: WeeklyReviewPanelProps) {
  const { open, onClose, onOpenTask, onOpenNote, onOpenPlanPreview, onOpenInbox } = props;

  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [saveErr, setSaveErr] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [planErr, setPlanErr] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/brain/weekly-review");
      if (!res.ok) throw new Error("load_failed");
      const data = await res.json();
      setReview(data.review ?? null);
      setSaved(Boolean(data.saved));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const saveReview = async () => {
    if (!review || saving) return;
    setSaving(true);
    setSaveErr(false);
    setSaveOk(false);
    try {
      const res = await fetch("/api/brain/weekly-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("save_failed");
      const data = await res.json();
      setReview(data.review ?? review);
      setSaved(true);
      setSaveOk(true);
    } catch {
      setSaveErr(true);
    } finally {
      setSaving(false);
    }
  };

  const genPlan = async () => {
    if (!review || planning) return;
    setPlanning(true);
    setPlanErr(false);
    try {
      const res = await fetch("/api/brain/weekly-review/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.plan) throw new Error(body?.error);
      onClose();
      onOpenPlanPreview?.(body.plan.id, body.body ?? null);
    } catch {
      setPlanErr(true);
    } finally {
      setPlanning(false);
    }
  };

  const jump = (it: ReviewItem) => {
    if (!it.refId) {
      if (it.refType === "inbox") onOpenInbox?.();
      return;
    }
    if (it.refType === "task" || it.refType === "outcome" || it.refType === "milestone") {
      onOpenTask?.(it.refId);
    } else if (it.refType === "note") {
      onOpenNote?.(it.refId);
    } else if (it.refType === "plan") {
      onOpenPlanPreview?.(it.refId, null);
    }
    onClose();
  };

  const sectionClass =
    "rounded-xl border border-border bg-card p-4 shadow-sm";
  const titleBar = (icon: React.ReactNode, text: string, count: number, tone: "ok" | "risk" | "next") => (
    <div className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
      {icon}
      <span>{text}</span>
      {count > 0 && (
        <span
          className={
            "ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium " +
            (tone === "risk"
              ? "bg-red-50 text-red-600"
              : tone === "next"
                ? "bg-indigo-50 text-indigo-600"
                : "bg-emerald-50 text-emerald-600")
          }
        >
          {count}
        </span>
      )}
    </div>
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[#F9FAFB] shadow-2xl">
        {/* 头部 */}
        <div className="flex items-start gap-2 border-b border-border bg-card px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground">本周复盘</h3>
              {saved && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                  <Save className="size-3" /> 已保存
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarRange className="size-3.5" />
              {review ? `${review.weekLabel}` : "…"}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={saveReview}
              disabled={saving || !review}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              保存复盘
            </button>
            <button
              onClick={genPlan}
              disabled={planning || !review}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {planning ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              生成下周计划
            </button>
            <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* 主体 */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-xs text-red-600">
              加载失败，请重试
              <button onClick={load} className="ml-2 inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 font-medium">
                <RefreshCw className="size-3" /> 重试
              </button>
            </div>
          )}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> 正在汇总本周数据…
            </div>
          )}

          {review && (
            <>
              {/* 一句总结 */}
              <div className="rounded-xl border border-primary/10 bg-gradient-to-br from-primary/5 to-transparent p-4 text-sm leading-relaxed text-foreground">
                <span className="mb-1 flex items-center gap-1 text-xs font-medium text-primary">
                  <Sparkles className="size-3.5" /> 本周总览
                </span>
                {review.summary}
              </div>

              {/* 完成与进展 */}
              <div className={sectionClass}>
                {titleBar(<CheckCircle2 className="size-4 text-emerald-600" />, "完成与进展", 0, "ok")}
                <div className="grid grid-cols-2 gap-2">
                  {review.progress.map((p) => (
                    <div key={p.label} className="rounded-lg border border-border/70 bg-[#F9FAFB] p-2.5">
                      <div className="text-lg font-bold text-foreground">{p.value}</div>
                      <div className="text-[11px] text-muted-foreground">{p.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 关键结果 */}
              <div className={sectionClass}>
                {titleBar(<Bookmark className="size-4 text-emerald-600" />, "关键结果", review.keyResults.length, "ok")}
                {review.keyResults.length === 0 ? (
                  <EmptyLine text="本周暂无已沉淀的关键结果或知识" />
                ) : (
                  <ItemList items={review.keyResults} onJump={jump} />
                )}
              </div>

              {/* 风险与阻塞 */}
              <div className={sectionClass}>
                {titleBar(<AlertTriangle className="size-4 text-red-600" />, "风险与阻塞", review.risks.length, "risk")}
                {review.risks.length === 0 ? (
                  <EmptyLine text="暂无风险与阻塞" />
                ) : (
                  <ItemList items={review.risks} onJump={jump} />
                )}
              </div>

              {/* 下周建议 */}
              <div className={sectionClass}>
                {titleBar(<ClipboardList className="size-4 text-indigo-600" />, "下周建议", review.nextSuggestions.length, "next")}
                {review.nextSuggestions.length === 0 ? (
                  <EmptyLine text="暂无下周建议" />
                ) : (
                  <ol className="list-decimal space-y-1 pl-5">
                    {review.nextSuggestions.map((it) => {
                      const Icon = TONE_ICON[it.tone];
                      return (
                        <li key={it.id} className="text-sm leading-relaxed text-foreground">
                          <button
                            onClick={() => jump(it)}
                            className="inline-flex max-w-full items-start gap-1.5 text-left transition hover:text-primary"
                          >
                            <Icon className="mt-0.5 size-3.5 shrink-0" />
                            <span className="min-w-0">
                              <span className="line-clamp-2 font-medium">{it.title}</span>
                              <span className="block text-[11px] text-muted-foreground">{it.reason}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </>
          )}

          {saveErr && <Flash tone="bad" text="保存失败，请重试" />}
          {planErr && <Flash tone="bad" text="生成下周计划失败，请重试" />}
          {saveOk && <Flash tone="ok" text={`已保存本周复盘（${review?.weekLabel ?? ""}）`} />}
        </div>

        {/* 底说明 */}
        <div className="border-t border-border bg-card px-5 py-2 text-[11px] text-muted-foreground">
          建议基于本周真实数据规则生成；「生成下周计划」仅创建待确认计划，需你在确认面板中审阅后落库。
        </div>
      </div>
    </div>
  );
}

function ItemList({ items, onJump }: { items: ReviewItem[]; onJump: (it: ReviewItem) => void }) {
  return (
    <div className="space-y-1">
      {items.map((it) => {
        const Icon = TONE_ICON[it.tone];
        return (
          <button
            key={it.id}
            onClick={() => onJump(it)}
            title="查看来源"
            className="flex w-full items-start gap-2 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-muted/60"
          >
            <span className={`mt-0.5 flex shrink-0 items-center rounded-md px-1 py-0.5 ${TONE_STYLE[it.tone]}`}>
              <Icon className="size-3" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm leading-snug text-foreground">{it.title}</span>
              <span className="block text-[11px] text-muted-foreground">{it.reason}</span>
            </span>
            <ChevronRight className="mt-0.5 size-3 shrink-0 text-muted-foreground/50" />
          </button>
        );
      })}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="py-2 text-xs text-muted-foreground">{text}</div>;
}

function Flash({ tone, text }: { tone: "ok" | "bad"; text: string }) {
  return (
    <div
      className={
        "rounded-xl border px-3 py-2 text-xs " +
        (tone === "ok"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-600")
      }
    >
      {text}
    </div>
  );
}