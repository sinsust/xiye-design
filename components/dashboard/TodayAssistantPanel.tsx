"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Loader2, RefreshCw, Sparkles } from "lucide-react";
import type { TodayBrief, TodayPriorityItem } from "@/lib/brain-priority";
import { TodayPriorityList } from "./today-priority-list";
import { PendingPlanList } from "./pending-plan-list";
import { DueSoonList } from "./due-soon-list";
import { ProjectRiskList } from "./project-risk-list";
import { LearningReviewList } from "./learning-review-list";
import { QuickCapture } from "./quick-capture";
import { RecoveryManager } from "./RecoveryManager";
import { ProactiveBriefList } from "./ProactiveBriefList";

export interface TodayAssistantPanelProps {
  quickBusy: boolean;
  onQuickOrganize: (content: string) => void;
  onOpenTask: (taskId: string) => void;
  onConfirmPlan: (planId: string) => void;
  onOpenProject: (projectId: string) => void;
  onOpenNote: (noteId: string) => void;
  onProcessInbox: () => void;
}

export function TodayAssistantPanel(props: TodayAssistantPanelProps) {
  const [brief, setBrief] = useState<TodayBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // 次要关注（复习 / 快到期 / 项目风险 / 恢复草稿）默认折起，收敛首页堆叠
  const [showMore, setShowMore] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/brain/dashboard");
      const d = await res.json();
      if (res.ok) setBrief(d?.brief ?? null);
      else setError(d?.error || "加载失败");
    } catch {
      setError("今日简报加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const title = brief?.headline.pendingPlans || brief?.headline.overdueTasks || false;

  const handleAction = (action: TodayPriorityItem["primaryAction"]["action"], targetId: string) => {
    switch (action) {
      case "open_task":
        props.onOpenTask(targetId);
        break;
      case "confirm_plan":
        props.onConfirmPlan(targetId);
        break;
      case "open_project":
        props.onOpenProject(targetId);
        break;
      case "process_inbox":
        props.onProcessInbox();
        break;
    }
  };

  const hour = new Date().getHours();
  const greet = hour < 6 ? "夜深了" : hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好";

  return (
    <div className="space-y-4">
      {/* 问候 + 今日摘要 */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {greet}，今天有 {title ? "需要你关注的事项" : "一些待处理事项"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {error
                ? "摘要加载失败"
                : loading && !brief
                  ? "正在汇总…"
                  : brief
                    ? `你有 ${brief.headline.totalPriorityItems} 件需要优先处理的事。`
                    : "今天暂无待处理事项。"}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className={"size-3.5 " + (loading ? "animate-spin" : "")} />
            刷新
          </button>
        </div>
      </div>

      {!brief && !error && loading && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-white py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> 正在整理今日最优先事项…
        </div>
      )}
      {error && !brief && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
          <button onClick={load} className="ml-3 text-xs font-medium underline">
            重试
          </button>
        </div>
      )}

      {brief && (
        <>
          <ProactiveBriefList />
          <TodayPriorityList items={brief.priorities} onAction={handleAction} />
          <PendingPlanList plans={brief.pendingPlans} onConfirm={props.onConfirmPlan} />

          <QuickCapture busy={props.quickBusy} onOrganize={props.onQuickOrganize} />

          {/* 次要关注：复习 / 快到期 / 项目风险 / 恢复草稿（默认折起，避免与概览/提醒中心/工作台多处重复平铺） */}
          <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className="flex w-full items-center gap-2 px-5 py-3.5 text-left transition hover:bg-muted/30"
              aria-expanded={showMore}
            >
              <Sparkles className="size-4 shrink-0 text-primary" />
              <span className="text-sm font-semibold text-foreground">更多今日关注</span>
              <span className="truncate text-[10px] text-muted-foreground">复习 · 快到期 · 项目风险 · 恢复草稿</span>
              <ChevronDown
                className={"ml-auto size-4 shrink-0 text-muted-foreground transition-transform " + (showMore ? "" : "-rotate-90")}
              />
            </button>
            {showMore && (
              <div className="space-y-4 p-5 pt-1">
                <LearningReviewList onOpenNote={props.onOpenNote} />
                {(brief.dueSoon.length > 0 || brief.headline.overdueTasks > 0) && (
                  <DueSoonList items={brief.dueSoon} onOpenTask={props.onOpenTask} />
                )}
                <ProjectRiskList risks={brief.projectRisks} onOpenProject={props.onOpenProject} />
                <RecoveryManager />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}