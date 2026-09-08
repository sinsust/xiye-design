"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LayoutGrid, Sun } from "lucide-react";
import { SecondBrain } from "@/components/second-brain";
import { TodaySpace } from "@/components/brain/today-space";
import type { BrainNote } from "@/lib/brain-db";

type View = "today" | "dashboard";

/** 从 proactive brief 链接解析的深度链接目标 */
export interface BrainDeepLink {
  /** 目标类型：对应 SecondBrain 的 workTab 或子区域 */
  type: "task" | "project" | "plan" | "note" | "inbox" | "review";
  id: string;
}

// Brain 首页外壳：默认「今日空间」（M3 轻量记忆助手），
// 「完整看板」为二级入口（含任务/策略/片段等高级工具，PRD §5.2 / 决策 5）。
// 支持 ?tab=tasks&task=xxx 等深度链接（来自「今天值得关注」的打开任务按钮）。
export function BrainHome({ initialNotes }: { initialNotes?: BrainNote[] }) {
  const searchParams = useSearchParams();
  const [view, setView] = useState<View>("today");
  const [deepLink, setDeepLink] = useState<BrainDeepLink | null>(null);
  // 二级视图首次打开后保持挂载（隐藏而非销毁），返回时不再整页重拉重渲染。
  const [dashboardMounted, setDashboardMounted] = useState(false);

  // 解析深度链接参数（仅首次挂载时生效，避免后续路由切换反复触发）
  useEffect(() => {
    const tab = searchParams.get("tab");
    const taskId = searchParams.get("task");
    const projectId = searchParams.get("project");
    const planId = searchParams.get("plan");
    const noteId = searchParams.get("note");

    if (taskId || projectId || planId || noteId || (tab && tab !== "today")) {
      setDashboardMounted(true);
    }
    if (taskId) {
      setView("dashboard");
      setDeepLink({ type: "task", id: taskId });
    } else if (projectId) {
      setView("dashboard");
      setDeepLink({ type: "project", id: projectId });
    } else if (planId) {
      setView("dashboard");
      setDeepLink({ type: "plan", id: planId });
    } else if (noteId) {
      setView("dashboard");
      setDeepLink({ type: "note", id: noteId });
    } else if (tab && tab !== "today") {
      setView("dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tabCls = (active: boolean) =>
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition " +
    (active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground");

  const openToday = () => {
    setView("today");
    window.dispatchEvent(new Event("brain:today-refresh"));
  };
  const openDashboard = () => {
    setDashboardMounted(true);
    setView("dashboard");
    // 若看板已挂载过，让其中的数据在重新显示前静默刷新（首次挂载自身会拉取）。
    window.dispatchEvent(new Event("brain:dashboard-refresh"));
  };

  return (
    <div>
      <div className="sticky top-0 z-20 flex items-center gap-1 border-b border-border bg-background/85 px-4 py-2 backdrop-blur">
        <button className={tabCls(view === "today")} onClick={openToday}>
          <Sun className="size-4" />
          今日空间
        </button>
        <button className={tabCls(view === "dashboard")} onClick={openDashboard}>
          <LayoutGrid className="size-4" />
          完整看板
        </button>
      </div>
      <div hidden={view !== "today"}>
        {view === "today" || dashboardMounted ? (
          <TodaySpace onOpenDashboard={openDashboard} />
        ) : null}
      </div>
      <div hidden={view !== "dashboard"}>
        {dashboardMounted ? (
          <SecondBrain notes={initialNotes} initialDeepLink={deepLink} />
        ) : null}
      </div>
    </div>
  );
}
