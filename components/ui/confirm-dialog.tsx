"use client";

import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

/**
 * 统一的二次确认弹窗（遮罩 + 居中卡片）。删除等不可撤销操作默认红色确认按钮。
 *
 * 必须用 createPortal 渲染到 body：调用方多在卡片列表内（note-card 等），
 * 外层的 content-visibility / contain / will-change:transform 会让 position:fixed
 * 相对卡片容器定位并被裁剪——弹窗会「内联」挤在卡片之间（已踩坑，勿回退）。
 */
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
  // portal 目标是 document.body，仅在客户端挂载后渲染，避免 SSR/hydration 不匹配
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ESC 关闭走全局监听：portal 后焦点不在弹窗内，挂容器上的 onKeyDown 收不到
  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
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
    </div>,
    document.body,
  );
}
