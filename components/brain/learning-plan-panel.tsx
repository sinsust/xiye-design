"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Check, Loader2, Pause, Play, Trash2 } from "lucide-react";

interface ReviewState {
  id: string;
  noteId: string;
  stage: number;
  intervalDays: number;
  nextReviewAt: number;
  lastReviewedAt: number | null;
  reviewCount: number;
  status: string;
}

const STAGE_LABEL = ["新学", "阶段 1", "阶段 2", "已掌握"];

/** 下次复习时间的友好文案。 */
function nextLabel(ts: number): string {
  const diff = ts - Date.now();
  if (diff <= 0) return "已到期";
  const days = Math.ceil(diff / 86400_000);
  if (days <= 1) return "明天";
  return `${days} 天后`;
}

/** 笔记详情「学习计划」控制：加入 / 暂停 / 恢复 / 移出 + 复习进度。 */
export function LearningPlanPanel({
  noteId,
  noteSuperseded,
}: {
  noteId: string;
  noteSuperseded: boolean;
}) {
  const [review, setReview] = useState<ReviewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/brain/learning-reviews?noteId=${encodeURIComponent(noteId)}`,
      );
      const d = await res.json();
      if (res.ok) setReview(d?.review ?? null);
      else setError(d?.error || "加载失败");
    } catch {
      setError("学习计划加载失败");
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    load();
  }, [load]);

  const post = useCallback(
    async (path: string, body: object) => {
      setBusy(true);
      try {
        await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        await load();
      } catch {
        /* 忽略 */
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const remove = useCallback(async () => {
    setBusy(true);
    try {
      await fetch(
        `/api/brain/learning-reviews?noteId=${encodeURIComponent(noteId)}`,
        { method: "DELETE" },
      );
      await load();
    } catch {
      /* 忽略 */
    } finally {
      setBusy(false);
    }
  }, [noteId, load]);

  const btn =
    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition disabled:opacity-50";

  return (
    <div className="border-t border-border/70 px-4 py-2.5">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[11px] font-semibold text-foreground">学习计划</span>
        {review && (
          <span
            className={
              "rounded-full px-1.5 py-0.5 text-[10px] font-medium " +
              (review.status === "paused"
                ? "bg-muted text-muted-foreground"
                : review.status === "mastered"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-primary/10 text-primary")
            }
          >
            {review.status === "paused"
              ? "已暂停"
              : review.status === "mastered"
                ? "已掌握"
                : "学习中"}
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="size-3 animate-spin" /> 正在加载…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 py-1.5 text-[11px] text-destructive">
          {error}
          <button onClick={load} className="font-medium underline">
            重试
          </button>
        </div>
      )}

      {!loading && !error && !review && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            加入学习计划，系统会在恰当时间提醒你复习。
          </span>
          {!noteSuperseded && (
            <button
              onClick={() => post("/api/brain/learning-reviews", { noteId })}
              disabled={busy}
              className={btn + " bg-primary/10 text-primary hover:bg-primary/20"}
            >
              {busy ? <Loader2 className="size-3 animate-spin" /> : <BookOpen className="size-3" />}
              加入学习计划
            </button>
          )}
        </div>
      )}

      {!loading && !error && review && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>
              第 <span className="font-medium text-foreground">{review.reviewCount}</span> 次复习
            </span>
            <span>
              阶段 <span className="font-medium text-foreground">{STAGE_LABEL[review.stage] ?? review.stage}</span>
            </span>
            <span>
              下次 <span className="font-medium text-foreground">{nextLabel(review.nextReviewAt)}</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {review.status === "paused" ? (
              <button
                onClick={() => post(`/api/brain/learning-reviews/${review.id}/action`, { action: "resume" })}
                disabled={busy}
                className={btn + " bg-primary/10 text-primary hover:bg-primary/20"}
              >
                {busy ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
                恢复学习计划
              </button>
            ) : (
              <button
                onClick={() => post(`/api/brain/learning-reviews/${review.id}/action`, { action: "pause" })}
                disabled={busy}
                className={btn + " bg-muted text-muted-foreground hover:bg-muted/70"}
              >
                <Pause className="size-3" /> 暂停
              </button>
            )}
            <button
              onClick={remove}
              disabled={busy}
              className={btn + " bg-destructive/5 text-destructive hover:bg-destructive/10"}
            >
              <Trash2 className="size-3" /> 移出学习计划
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
