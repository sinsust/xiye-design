"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { type DashboardReview } from "./types";

interface ReviewRow extends DashboardReview {
  id: string;
  nextReviewAt: string;
}

/** 今日复习：点击即可开始复习，支持 ✅已复习 / ⏭跳过 */
export function TodayReviews({ reviews }: { reviews: DashboardReview[] }) {
  // 为动作解析真实 review id（GET /reviews 返回带 id 的 due 列表）
  const idMap = useRef<Map<string, string>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);
  const [shield, setShield] = useState<string | null>(null); // 复习确认墙

  const resolveIds = useCallback(async () => {
    try {
      const res = await fetch("/api/brain/reviews");
      const data = await res.json();
      if (res.ok && Array.isArray(data.due)) {
        data.due.forEach((r: { noteId: string; id: string }) => idMap.current.set(r.noteId, r.id));
      }
    } catch {
      /* 忽略 */
    }
  }, []);

  useEffect(() => {
    resolveIds();
  }, [resolveIds]);

  const act = useCallback(async (noteId: string, action: "complete" | "skip", e?: React.MouseEvent) => {
    e?.stopPropagation();
    const id = idMap.current.get(noteId);
    if (!id || busy) return;
    setBusy(noteId);
    try {
      await fetch(`/api/brain/reviews?id=${id}&action=${action}`);
    } catch {
      /* 忽略 */
    } finally {
      setBusy(null);
      setShield(null);
      // 触发父级刷新：广播自定义事件，工作台监听后重拉 dashboard
      window.dispatchEvent(new Event("brain:dashboard-refresh"));
    }
  }, [busy]);

  if (!reviews.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <GraduationCap className="size-4 text-primary" /> 今日复习
        </div>
        <div className="py-5 text-center text-sm text-muted-foreground">
          ✅ 今天没有需要复习的笔记
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <GraduationCap className="size-4 text-primary" /> 今日复习
        <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-red-600">
          {reviews.length}
        </span>
      </div>
      <div className="space-y-2">
        {reviews.map((r) => (
          <div
            key={r.noteId}
            className="cursor-pointer rounded-lg border border-border bg-muted/30 px-3 py-2.5 transition hover:border-primary/40"
          >
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-foreground">{r.title}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                第{r.reviewCount + 1}次复习 · 间隔 {Math.max(1, r.reviewCount || 1)} 天
              </div>
              {shield === r.noteId ? (
                <div className="mt-2 flex gap-2">
                  <button
                    className="flex-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground"
                    onClick={(e) => act(r.noteId, "complete", e)}
                    disabled={busy === r.noteId}
                  >
                    {busy === r.noteId ? "完成中…" : "✅ 已复习"}
                  </button>
                  <button
                    className="flex-1 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground"
                    onClick={(e) => act(r.noteId, "skip", e)}
                  >
                    ⏭ 跳过
                  </button>
                </div>
              ) : (
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    className="flex-1 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShield(r.noteId);
                    }}
                  >
                    {busy === r.noteId ? <Loader2 className="inline size-3 animate-spin" /> : "开始复习 →"}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}