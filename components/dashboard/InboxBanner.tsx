"use client";

import { ArrowRight, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

/** 收件箱横幅：待处理条目提示 + 去处理按钮。 */
export function InboxBanner({
  pending,
  onOpenInbox,
}: {
  pending: number;
  onOpenInbox: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
        <Inbox className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">收件箱 {pending} 条待处理</div>
        <div className="truncate text-xs text-muted-foreground">AI 已整理好建议，确认后一键落库</div>
      </div>
      <Button size="sm" variant="outline" onClick={onOpenInbox} className="shrink-0">
        去处理 <ArrowRight className="size-3.5" />
      </Button>
    </div>
  );
}