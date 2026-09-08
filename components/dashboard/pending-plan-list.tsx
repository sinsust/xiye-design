"use client";

import { CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TodayBrief } from "@/lib/brain-priority";

export interface PendingPlanListProps {
  plans: TodayBrief["pendingPlans"];
  onConfirm: (planId: string) => void;
}

export function PendingPlanList({ plans, onConfirm }: PendingPlanListProps) {
  if (!plans.length) return null;
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/10/50 p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Sparkles className="size-4 text-primary" />
        等待确认的 AI 处理计划
        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
          {plans.length}
        </span>
      </h2>
      <ul className="mt-3 space-y-2">
        {plans.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-lg border border-primary/20 bg-card px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] text-foreground">{p.title}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">创建于 {new Date(p.createdAt).toLocaleString("zh-CN")}</div>
            </div>
            <Button
              size="sm"
              className="h-8 gap-1 px-3 text-xs"
              onClick={() => onConfirm(p.id)}
            >
              <CheckCircle2 className="size-3.5" />
              确认保存
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}