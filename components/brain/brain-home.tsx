"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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

// Brain 首页外壳：单一入口「今日空间」（M3 轻量记忆助手，PRD §7.1「首页只有一个今日空间」）。
// 任务看板/项目/策略/片段/数据引擎等历史能力统一收进「高级工具」，不再是并列一级 tab，
// 仅由今日空间底部的入口二级进入，并提供返回今日空间。
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
  // 今日空间「搜索记忆」：先切到高级工具视图（SecondBrain 挂载并注册监听），
  // 稍等一拍再广播打开全局搜索面板（Cmd+K 同款）。
  const openSearch = () => {
    openDashboard();
    window.setTimeout(() => window.dispatchEvent(new Event("brain:open-search")), 80);
  };

  return (
    <div>
      {/* 高级工具视图的返回条：今日空间为唯一首页，这里只提供「回到今日空间」。 */}
      {view === "dashboard" && (
        <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/85 px-4 py-2 backdrop-blur">
          <button
            onClick={openToday}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            今日空间
          </button>
          <span className="text-sm font-medium text-foreground">高级工具</span>
        </div>
      )}
      <div hidden={view !== "today"}>
        {view === "today" || dashboardMounted ? (
          <TodaySpace onOpenDashboard={openDashboard} onOpenSearch={openSearch} />
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
