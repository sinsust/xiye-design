"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Check, Clock, Loader2, ThumbsDown } from "lucide-react";
import { relativeTime } from "@/components/brain/brain-utils";

export interface DueLearningReview {
  id: string;
  noteId: string;
  stage: number;
  intervalDays: number;
  nextReviewAt: number;
  lastReviewedAt: number | null;
  reviewCount: number;
  status: string;
  noteTitle: string;
  noteSummary: string;
}

/** 今日助理「建议复习」区块：最多 3 条到期学习项；未到期时不显示空洞区块。 */
export function LearningReviewList({
  onOpenNote,
}: {
  onOpenNote: (noteId: string) => void;
}) {
  const [due, setDue] = useState<DueLearningReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/brain/learning-reviews");
      const d = await res.json();
      if (res.ok) setDue(Array.isArray(d.due) ? d.due : []);
      else setError(d?.error || "加载失败");
    } catch {
      setError("学习复习加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = useCallback(
    async (id: string, action: string, days?: number) => {
      setActingId(id);
      try {
        await fetch(`/api/brain/learning-reviews/${id}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...(days ? { days } : {}) }),
        });
        await load();
      } catch {
        /* 忽略 */
      } finally {
        setActingId(null);
      }
    },
    [load],
  );

  // 未到期 / 无数据时不显示空洞区块
  if (!loading && !error && due.length === 0) return null;

  const btn =
    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition disabled:opacity-50";

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <BookOpen className="size-4 text-primary" />
        建议复习
        {due.length > 0 && (
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
            {due.length}
          </span>
        )}
      </h2>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-xs text-destructive">
          {error}
          <button onClick={load} className="font-medium underline">
            重试
          </button>
        </div>
      )}

      {loading && (
        <div className="mt-3 flex items-center gap-2 py-4 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> 正在检查到期复习…
        </div>
      )}

      {!loading && !error && (
        <ul className="mt-3 space-y-2">
          {due.slice(0, 3).map((r) => (
            <li key={r.id} className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
              <button
                onClick={() => onOpenNote(r.noteId)}
                className="block w-full text-left"
                title="打开笔记阅读"
              >
                <span className="block truncate text-[13px] font-medium text-foreground transition hover:text-primary">
                  {r.noteTitle}
                </span>
                {r.noteSummary && (
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {r.noteSummary}
                  </span>
                )}
              </button>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span>第 {r.reviewCount + 1} 次复习</span>
                <span>·</span>
                <span>
                  {r.lastReviewedAt ? `上次 ${relativeTime(r.lastReviewedAt)}` : "新加入"}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <button
                  onClick={() => onOpenNote(r.noteId)}
                  className={btn + " bg-primary/10 text-primary hover:bg-primary/20"}
                  disabled={actingId === r.id}
                >
                  <BookOpen className="size-3" /> 快速回顾
                </button>
                <button
                  onClick={() => act(r.id, "mastered")}
                  className={btn + " bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"}
                  disabled={actingId === r.id}
                >
                  {actingId === r.id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Check className="size-3" />
                  )}
                  已掌握
                </button>
                <button
                  onClick={() => act(r.id, "not_sure")}
                  className={btn + " bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"}
                  disabled={actingId === r.id}
                >
                  <ThumbsDown className="size-3" /> 不熟
                </button>
                <button
                  onClick={() => act(r.id, "snooze", 1)}
                  className={btn + " bg-muted text-muted-foreground hover:bg-muted/70"}
                  disabled={actingId === r.id}
                >
                  <Clock className="size-3" /> 稍后
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
