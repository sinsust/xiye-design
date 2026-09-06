"use client";

import { useState } from "react";
import { LayoutGrid, Sun } from "lucide-react";
import { SecondBrain } from "@/components/second-brain";
import { TodaySpace } from "@/components/brain/today-space";
import type { BrainNote } from "@/lib/brain-db";

type View = "today" | "dashboard";

// Brain 首页外壳：默认「今日空间」（M3 轻量记忆助手），
// 「完整看板」为二级入口（含任务/策略/片段等高级工具，PRD §5.2 / 决策 5）。
export function BrainHome({ initialNotes }: { initialNotes: BrainNote[] }) {
  const [view, setView] = useState<View>("today");

  const tabCls = (active: boolean) =>
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition " +
    (active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground");

  return (
    <div>
      <div className="sticky top-0 z-20 flex items-center gap-1 border-b border-border bg-background/85 px-4 py-2 backdrop-blur">
        <button className={tabCls(view === "today")} onClick={() => setView("today")}>
          <Sun className="size-4" />
          今日空间
        </button>
        <button className={tabCls(view === "dashboard")} onClick={() => setView("dashboard")}>
          <LayoutGrid className="size-4" />
          完整看板
        </button>
      </div>
      {view === "today" ? (
        <TodaySpace onOpenDashboard={() => setView("dashboard")} />
      ) : (
        <SecondBrain notes={initialNotes} />
      )}
    </div>
  );
}
