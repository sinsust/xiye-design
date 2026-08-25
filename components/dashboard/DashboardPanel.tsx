"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, CalendarClock, Inbox, Loader2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDue, type DashboardData, type DashboardPanelProps, type DashboardTask } from "./types";
import { TodayReviews } from "./TodayReviews";
import { WeekInsights } from "./WeekInsights";
import { ProjectProgress } from "./ProjectProgress";
import { QuickActions } from "./QuickActions";
import { InboxBanner } from "./InboxBanner";

// 优先级左侧色条
const PRIORITY_BAR: Record<string, string> = { high: "#ef4444", medium: "#f59e0b", low: "#9ca3af" };
function TaskRow({ t }: { t: DashboardTask }) {
  const label = (() => {
    if (t.daysOverdue > 0) return { text: `逾期 ${t.daysOverdue} 天`, cls: "text-red-600 font-medium" };
    if (t.daysOverdue === 0) return { text: "今天到期", cls: "text-red-500" };
    if (t.daysOverdue < 0) return { text: "已结束", cls: "text-muted-foreground" };
    return { text: "", cls: "" };
  })();
  return (
    <div className="flex items-center gap-2.5 border-l-2 py-0.5 pl-2" style={{ borderColor: PRIORITY_BAR[t.priority] }}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] text-foreground">{t.title}</div>
        {t.strategyName && <div className="truncate text-[11px] text-muted-foreground">🎯 {t.strategyName}</div>}
      </div>
      <div className="shrink-0 text-right text-[11px]">
        <div className={label.cls}>{label.text}</div>
        <div className="text-muted-foreground">{formatDue(t.dueDate)}</div>
      </div>
    </div>
  );
}

function TaskGroup({ title, cls, tasks }: { title: string; cls: string; tasks: DashboardTask[] }) {
  if (!tasks.length) return null;
  return (
    <div>
      <div className={"mb-1 text-[11px] font-medium " + cls}>{title}</div>
      <div className="space-y-1.5">{tasks.map((t) => <TaskRow key={t.id} t={t} />)}</div>
    </div>
  );
}

/** 今日待办：逾期 / 今日 / 本周 分组，按优先级排序 */
function TodayTasks({ tasks }: { tasks: DashboardData["tasks"] }) {
  const sortByPrio = (arr: DashboardTask[]) => [...arr].sort((a, b) => (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]));
  const overdue = sortByPrio(tasks.overdue);
  const today = sortByPrio(tasks.dueToday);
  const week = sortByPrio(tasks.dueThisWeek);
  const empty = overdue.length + today.length + week.length === 0;
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <CalendarClock className="size-4 text-primary" /> 今日待办
        {(tasks.total.overdue + tasks.total.today) > 0 && (
          <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-red-600">
            {tasks.total.overdue + tasks.total.today}
          </span>
        )}
      </div>
      {empty ? (
        <div className="py-6 text-center text-sm text-muted-foreground">🎉 今天没有待办任务</div>
      ) : (
        <div className="space-y-3">
          <TaskGroup title="🔴 已逾期" cls="text-red-500" tasks={overdue} />
          <TaskGroup title="🟡 今天到期" cls="text-amber-500" tasks={today} />
          <TaskGroup title="🟢 本周内" cls="text-muted-foreground" tasks={week} />
        </div>
      )}
    </div>
  );
}
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

/** 主容器：加载 /api/brain/dashboard 并拼装全部区块 */
export function DashboardPanel({ onOpenInbox, onGoto, onNewTask, onOpenProject }: DashboardPanelProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // 今日洞察：浮层面板开关（不占布局宽度）
  const [insightsOpen, setInsightsOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/brain/dashboard");
      const d = await res.json();
      if (res.ok) setData(d);
      else setError(d?.error || "加载失败");
    } catch {
      setError("助手面板加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // 60 秒自动刷新
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const weekday = ["日", "一", "二", "三", "四", "五", "六"][new Date().getDay()];
  const hour = new Date().getHours();
  const greet = hour < 6 ? "夜深了" : hour < 12 ? "上午好" : hour < 18 ? "下午好" : "晚上好";

  return (
    <div className="space-y-4">
      {/* 问候 + 快捷操作 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {greet}！今天是 {new Date().getMonth() + 1}月{new Date().getDate()}日 周{weekday}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            今天该做什么、该复习什么，一屏看清
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setInsightsOpen((v) => !v)}
            className={
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition " +
              (insightsOpen
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground")
            }
          >
            <BarChart3 className="size-3.5" />
            今日洞察
          </button>
          <QuickActions onNewTask={onNewTask} onGoto={onGoto} />
        </div>
      </div>

      {loading && !data && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-white py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> 正在汇总今日概览…
        </div>
      )}
      {error && !data && <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}

      {data && (
        <>
          {/* 收件箱横幅 */}
          {data.inbox.pending > 0 && <InboxBanner pending={data.inbox.pending} onOpenInbox={onOpenInbox} />}

          {/* 主内容：全宽，不再被右栏挤压 */}
          <div className="space-y-4">
            <TodayTasks tasks={data.tasks} />
            <TodayReviews reviews={data.reviews.dueToday} />
            {/* 项目进度（active 项目：进度条 + 剩余天数） */}
            <ProjectProgress projects={data.projects} onOpenProject={onOpenProject} />
          </div>

          {/* 今日洞察：浮层面板（不占布局宽度，可开关） */}
          {insightsOpen && (
            <div className="fixed right-4 top-20 z-40 flex max-h-[80vh] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <span className="text-sm font-semibold text-foreground">今日洞察</span>
                <button
                  onClick={() => setInsightsOpen(false)}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="关闭洞察面板"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <WeekInsights insights={data.insights} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}