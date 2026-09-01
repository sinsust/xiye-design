"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  ListChecks,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReviewItem, WeeklyReviewData } from "@/lib/brain-review";

interface WeeklyReviewPanelProps {
  /** 生成「下周计划」后，把已持久化的待确认计划灌入「记一笔」供用户确认 */
  onUseAsPlan: (planId: string, body: unknown) => void;
}

function toneStyle(tone: ReviewItem["tone"]): { dot: string; text: string; wrap: string; label: string } {
  if (tone === "risk")
    return { dot: "bg-red-500", text: "text-red-600", wrap: "bg-red-500/5 border-red-500/20", label: "风险" };
  if (tone === "positive")
    return { dot: "bg-emerald-500", text: "text-emerald-600", wrap: "bg-emerald-500/5 border-emerald-500/20", label: "成果" };
  return { dot: "bg-slate-400", text: "text-slate-600", wrap: "bg-slate-500/5 border-slate-500/20", label: "建议" };
}

function ReviewRow({ item }: { item: ReviewItem }) {
  const s = toneStyle(item.tone);
  return (
    <li className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${s.wrap}`}>
      <span className={`mt-1.5 inline-block size-1.5 shrink-0 rounded-full ${s.dot}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-foreground">{item.title}</p>
        {item.reason ? <p className={`mt-0.5 text-xs ${s.text}`}>{item.reason}</p> : null}
      </div>
    </li>
  );
}

function Section({
  title,
  icon,
  items,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  items: ReviewItem[];
  empty: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-[11px] text-muted-foreground">{items.length}</span>
      </div>
      {items.length ? (
        <ul className="space-y-1.5">
          {items.map((it) => (
            <ReviewRow key={it.id} item={it} />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

export function WeeklyReviewPanel({ onUseAsPlan }: WeeklyReviewPanelProps) {
  const [review, setReview] = useState<WeeklyReviewData | null>(null);
  const [saved, setSaved] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/brain/weekly-review");
      const data = await res.json();
      if (!res.ok || !data?.review) throw new Error(data?.error || "复盘加载失败");
      setReview(data.review as WeeklyReviewData);
      setSaved(Boolean(data.saved));
    } catch (e) {
      setError(e instanceof Error ? e.message : "复盘加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveReview = useCallback(async () => {
    if (saving || !review) return;
    setSaving(true);
    try {
      const res = await fetch("/api/brain/weekly-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ at: Date.now() }),
      });
      const data = await res.json();
      if (!res.ok || !data?.saved) throw new Error(data?.error || "保存失败");
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }, [saving, review]);

  const generateNextPlan = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/brain/weekly-review/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ at: Date.now() }),
      });
      const data = await res.json();
      if (!res.ok || !data?.plan || !data?.body) throw new Error(data?.error || "生成失败");
      // 灌入「记一笔」确认（不直接建任务，符合统一写入闭环）
      onUseAsPlan(data.plan.id as string, data.body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setGenerating(false);
    }
  }, [generating, onUseAsPlan]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        <Loader2 className="size-4 animate-spin" /> 正在生成本周复盘…
      </div>
    );
  }

  if (error && !review) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-destructive shadow-sm">{error}</div>
    );
  }

  const r = review!;
  const progress = r.progress ?? [];

  return (
    <div className="space-y-4">
      {/* 头部：明确与「本周周报」区分 */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <RotateCcw className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight text-foreground">本周复盘</h2>
          <p className="text-xs text-muted-foreground">
            成果 + 风险 + 下周计划（区别于首页「本周周报」轻量摘要；间隔复习在首页「待复习」）
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={saveReview} disabled={saving || saved}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            {saved ? "已保存" : "保存复盘"}
          </Button>
          <Button size="sm" onClick={generateNextPlan} disabled={generating}>
            {generating ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            生成下一周计划
          </Button>
        </div>
      </div>

      {/* 周期 + 进度徽标 */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-4 shadow-sm">
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <CalendarClock className="size-4 text-primary" />
          {r.weekLabel}
        </span>
        <span className="text-xs text-muted-foreground">{r.summary}</span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {progress.map((p) => (
            <span
              key={p.label}
              className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
              title={p.hint}
            >
              {p.label} {p.value}
            </span>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {/* 三类内容 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Section
          title="关键结果"
          icon={<CheckCircle2 className="size-3.5" />}
          items={r.keyResults}
          empty="本周暂无沉淀的关键成果。"
        />
        <Section
          title="风险与阻塞"
          icon={<AlertTriangle className="size-3.5" />}
          items={r.risks}
          empty="本周无显著风险或阻塞。"
        />
        <Section
          title="下周建议"
          icon={<ListChecks className="size-3.5" />}
          items={r.nextSuggestions}
          empty="暂无明确下周建议。"
        />
      </div>
    </div>
  );
}
