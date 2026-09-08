"use client";

import { type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  /** 可选：标题下方的一段说明文字 */
  description?: ReactNode;
  /** 可选：替换/补充说明内容主体（例如高亮展示将被删除的条目） */
  body?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "destructive" | "default";
  busy?: boolean;
}

/** 统一的二次确认弹窗（深色遮罩 + 毛玻璃 + 居中卡片）。删除等不可撤销操作默认红色确认按钮。 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  body,
  confirmText = "确认删除",
  cancelText = "取消",
  confirmVariant = "destructive",
  busy = false,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(ev) => {
        if (ev.key === "Escape") onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-semibold text-foreground">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="关闭">
            <X className="size-4" />
          </Button>
        </div>
        {(body || description) && <div className="space-y-3 px-5 py-4">{body ? body : description}</div>}
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            {cancelText}
          </Button>
          <Button
            variant={confirmVariant}
            size="sm"
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}