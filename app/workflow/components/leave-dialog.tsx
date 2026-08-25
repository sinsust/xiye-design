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
  projectName: string;
  stageLabel: string;
  historyCount: number;
  roundCount: number;
  hasBrief: boolean;
  pageCount: number;
}

/**
 * 离开流程工作台前的保存守卫。
 * 明确告知保存到哪个项目、保存了什么、下次从哪继续。
 */
export function LeaveDialog({
  open,
  saving,
  saveFailed,
  onSave,
  onDiscard,
  onCancel,
  projectName,
  stageLabel,
  roundCount,
  hasBrief,
  pageCount,
}: LeaveDialogProps) {
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
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-medium text-foreground">要离开吗？</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          进度将保存到「<span className="font-medium text-foreground">{projectName}</span>
          」，下次可在「{stageLabel}」继续。
        </p>

        {!saving && !saveFailed && (
          <div className="mt-3 rounded-xl border border-border/70 bg-background/60 p-3">
            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">将保存：</p>
            <ul className="space-y-1 text-xs text-foreground">
              {roundCount > 0 && (
                <li>{roundCount} 轮对话</li>
              )}
              {hasBrief && (
                <li>产品定义</li>
              )}
              {pageCount > 0 && (
                <li>{pageCount} 个页面</li>
              )}
              {roundCount === 0 && !hasBrief && pageCount === 0 && (
                <li>当前进度</li>
              )}
            </ul>
          </div>
        )}

        {saving && (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            正在保存…
          </p>
        )}

        {saveFailed && (
          <p className="mt-3 text-sm text-destructive">
            保存失败，内容未同步，请重试或放弃。
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2">
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saveFailed ? "重试保存" : saving ? "保存中" : "保存并离开"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={onDiscard}
            disabled={saving}
          >
            放弃并离开
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
            取消
          </Button>
        </div>
      </div>
    </div>
  );
}