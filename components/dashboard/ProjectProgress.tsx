"use client";

import { FolderKanban } from "lucide-react";
import type { DashboardData } from "./types";

/** 项目进度条。第十阶段项目表落地后由处理器填充 projects 数据；本阶段有则展示，无则占位。 */
export function ProjectProgress({ projects }: { projects: DashboardData["projects"] }) {
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
      </div>
      <div className="space-y-3">
        {projects.map((p) => (
          <div key={p.id}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <span className="size-2 rounded-full" style={{ background: p.color }} />
                {p.name}
              </span>
              <span className="text-muted-foreground">
                {p.completedTasks}/{p.totalTasks} · {p.progress}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, p.progress))}%`, background: p.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}