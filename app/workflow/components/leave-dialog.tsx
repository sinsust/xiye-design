"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LeaveDialogProps {
  open: boolean;
  saving: boolean;
  saveFailed: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

/**
 * 离开流程工作台前的保存守卫。
 * 仅在用户主动点击切换到其他顶层区域时出现：保存草稿 / 放弃进度 / 取消继续。
 */
export function LeaveDialog({ open, saving, saveFailed, onSave, onDiscard, onCancel }: LeaveDialogProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="离开流程工作台"
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-medium text-foreground">要离开流程工作台吗？</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          当前进度尚未保存。你可以把进度存为草稿，下次从「我的项目」继续；也可以放弃本次进度直接离开。
        </p>
        {saveFailed && (
          <p className="mt-2 text-sm text-destructive">保存失败，请重试或改为放弃。</p>
        )}
        <div className="mt-4 flex flex-col gap-2">
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            保存草稿并离开
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={onDiscard}
            disabled={saving}
          >
            放弃进度并离开
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
            取消，继续流程
          </Button>
        </div>
      </div>
    </div>
  );
}