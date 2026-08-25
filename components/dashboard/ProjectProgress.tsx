"use client";

import { FolderKanban } from "lucide-react";
import type { ProjectProgress as P } from "./types";

/** 进度条配色：>70% 绿 / 30-70% 黄 / <30% 红 */
function barColor(progress: number): string {
  if (progress > 70) return "#22c55e";
  if (progress >= 30) return "#f59e0b";
  return "#ef4444";
}

function daysText(days: number | null): string {
  if (days === null) return "未设截止";
  if (days < 0) return `已逾期 ${-days} 天`;
  if (days === 0) return "今天截止";
  if (days === 1) return "剩 1 天";
  return `剩 ${days} 天`;
}

/** 项目进度区块。显示 active 项目进度条 + 剩余天数，点击跳转项目详情。 */
export function ProjectProgress({
  projects,
  onOpenProject,
}: {
  projects: P[];
  onOpenProject: (id: string) => void;
}) {
  if (!projects.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-white/60 p-5 text-center">
        <FolderKanban className="mx-auto size-6 text-muted-foreground/40" />
        <p className="mt-2 text-sm text-muted-foreground">项目进度</p>
        <p className="mt-0.5 text-xs text-muted-foreground/60">暂无进行中的项目</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <FolderKanban className="size-4 text-primary" /> 项目进度
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          {projects.length}
        </span>
      </div>
      <div className="space-y-3">
        {projects.map((p) => {
          const color = barColor(p.progress);
          const overdue = p.daysRemaining !== null && p.daysRemaining < 0;
          return (
            <button
              key={p.id}
              onClick={() => onOpenProject(p.id)}
              type="button"
              className="group block w-full cursor-pointer text-left"
            >
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-1.5 font-medium text-foreground group-hover:text-primary">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: p.color }} />
                  <span className="truncate">{p.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={overdue ? "text-red-600" : "text-muted-foreground"}>
                    {daysText(p.daysRemaining)}
                  </span>
                  <span className="tabular-nums text-foreground">
                    {p.completedTasks}/{p.totalTasks} · {p.progress}%
                  </span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, p.progress))}%`, background: color }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}