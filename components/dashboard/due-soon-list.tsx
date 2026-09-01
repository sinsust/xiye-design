"use client";

import { CalendarClock, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TodayBrief } from "@/lib/brain-priority";

export interface DueSoonListProps {
  items: TodayBrief["dueSoon"];
  onOpenTask: (taskId: string) => void;
}

const DAY = 86400_000;

export function DueSoonList({ items, onOpenTask }: DueSoonListProps) {
  if (!items.length) return null;
  const nowStart = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <CalendarClock className="size-4 text-amber-500" />
        今天到期 / 已逾期
        <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-600">
          {items.length}
        </span>
      </h2>
      <ul className="mt-3 space-y-1.5">
        {items.map((t) => {
          const dueMs = new Date(t.dueDate).getTime();
          const days = Math.round((dueMs - nowStart) / DAY);
          const overdue = days < 0;
          return (
            <li
              key={t.id}
              className="flex items-center gap-2.5 rounded-md border border-border/70 bg-muted/20 px-3 py-2"
            >
              <span className={"size-1.5 shrink-0 rounded-full " + (overdue ? "bg-red-500" : "bg-amber-400")} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] text-foreground">{t.title}</div>
                {t.projectId && <div className="text-[11px] text-muted-foreground">关联项目</div>}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px]"
                onClick={() => onOpenTask(t.id)}
              >
                <Flag className="size-3" />
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}