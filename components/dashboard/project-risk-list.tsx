"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TodayBrief } from "@/lib/brain-priority";

export interface ProjectRiskListProps {
  risks: TodayBrief["projectRisks"];
  onOpenProject: (projectId: string) => void;
}

export function ProjectRiskList({ risks, onOpenProject }: ProjectRiskListProps) {
  if (!risks.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <AlertTriangle className="size-4 text-red-500" />
        项目风险
        <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-red-600">
          {risks.length}
        </span>
      </h2>
      <ul className="mt-3 space-y-2">
        {risks.map((p) => (
          <li key={p.projectId} className="rounded-lg border border-border/70 bg-muted/20 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-foreground">{p.name}</div>
                <ul className="mt-1 space-y-0.5">
                  {p.reasons.map((r, idx) => (
                    <li key={idx} className="flex items-start gap-1 text-[11px] text-muted-foreground">
                      <span className="mt-1 size-1 shrink-0 rounded-full bg-red-400" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 shrink-0 px-2 text-[11px]"
                onClick={() => onOpenProject(p.projectId)}
              >
                查看项目
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}