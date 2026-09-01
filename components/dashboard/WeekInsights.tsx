"use client";

import { BarChart3, RotateCcw, TrendingUp } from "lucide-react";
import type { DashboardData } from "./types";

function relDays(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  return `${Math.max(0, d)} 天`;
}

/** 本周洞察：新增/完成统计 + 高频分类标签 + 衰减提醒 + 策略回顾提醒 */
export function WeekInsights({ insights }: { insights: DashboardData["insights"] }) {
  const ws = insights.weekSummary;
  return (
    <div className="space-y-4">
      {/* 本周统计 */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <BarChart3 className="size-4 text-primary" /> 本周洞察
        </div>
        <p className="text-[13px] leading-relaxed text-foreground">
          新增 <span className="font-semibold text-primary">{ws.newNotes}</span> 条笔记 · 完成{" "}
          <span className="font-semibold text-primary">{ws.completedTasks}</span> 个任务
          {ws.newStrategies > 0 && (
            <>
              {" "}· 新增 <span className="font-semibold text-primary">{ws.newStrategies}</span> 条策略
            </>
          )}
        </p>
        {ws.topCategory !== "—" && (
          <p className="mt-1.5 text-[12px] text-muted-foreground">最活跃分类：{ws.topCategory}</p>
        )}
        {ws.topTags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] text-muted-foreground">高频标签：</span>
            {ws.topTags.map((t) => (
              <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 衰减提醒 */}
      {(insights.decayAlerts.length > 0 || insights.strategyReviews.length > 0) && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <TrendingUp className="size-4 text-amber-500" /> 衰减提醒
          </div>
          <div className="space-y-1.5">
            {insights.decayAlerts.map((d) => (
              <div key={d.noteId} className="text-xs leading-relaxed text-muted-foreground">
                “<span className="text-foreground">{d.title}</span>” 已 {relDays(d.lastAccessedAt)} 未访问
              </div>
            ))}
            {insights.strategyReviews.map((s) => (
              <div key={s.strategyId} className="text-xs leading-relaxed text-muted-foreground">
                🎯 策略“<span className="text-foreground">{s.name}</span>”已 {relDays(s.lastUpdated)} 未更新
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}