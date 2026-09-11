"use client";

import { create } from "zustand";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  type LucideIcon,
} from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastState {
  toasts: ToastItem[];
  push: (message: string, type?: ToastType) => void;
  dismiss: (id: number) => void;
}

// error / warning 给更长停留，确保用户读完长报错
const DURATION: Record<ToastType, number> = {
  success: 3800,
  info: 3800,
  warning: 6000,
  error: 6000,
};

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, type = "info") => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, DURATION[type]);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** 命令式触发 toast：toast("已保存", "success") / toast("失败", "error") / toast("注意", "warning") */
export const toast = Object.assign(
  function toast(message: string, type: ToastType = "info") {
    useToastStore.getState().push(message, type);
  },
  {
    success: (m: string) => useToastStore.getState().push(m, "success"),
    error: (m: string) => useToastStore.getState().push(m, "error"),
    warning: (m: string) => useToastStore.getState().push(m, "warning"),
    info: (m: string) => useToastStore.getState().push(m, "info"),
  },
);

const toneCls: Record<ToastType, string> = {
  success: "border-success/30 bg-success/10 text-success dark:text-success",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  warning: "border-warning/30 bg-warning/10 text-warning dark:text-warning",
  info: "border-border bg-card text-foreground",
};

const iconFor: Record<ToastType, LucideIcon> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div
      role="region"
      aria-label="通知"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,22rem)] flex-col gap-2"
    >
      {toasts.map((t) => {
        const Icon = iconFor[t.type];
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-4 py-2.5 text-left text-sm font-medium shadow-lg transition hover:opacity-90 ${toneCls[t.type]}`}
          >
            <Icon className="mt-0.5 size-4 shrink-0" />
            <span className="flex-1">{t.message}</span>
          </button>
        );
      })}
    </div>
  );
}
