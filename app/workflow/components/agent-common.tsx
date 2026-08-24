"use client";

import { useEffect, useState } from "react";
import { type LucideIcon } from "lucide-react";
import { CheckCircle2, Clock3, Maximize2, Sparkles } from "lucide-react";
import { type AgentId } from "../agents";
import { useAgent } from "../agents-store";

export type AgentStatus = "standby" | "thinking" | "producing" | "done";

export interface AgentState {
  status: AgentStatus;
  progress: number;
  summary: string;
  details?: string[];
}

/* 专家头像：优先用用户自定义头像，其次默认照片（缺失则回退图标） */
export function AgentAvatar({ role, className }: { role: AgentId; className?: string }) {
  const profile = useAgent(role);
  const Icon: LucideIcon = profile.icon;
  const [failed, setFailed] = useState(false);
  if (!failed && profile.avatarUrl) {
    return (
      <img
        src={profile.avatarUrl}
        alt={profile.name}
        onError={() => setFailed(true)}
        className={["rounded-full object-cover", className ?? ""].join(" ")}
      />
    );
  }
  return (
    <div
      className={[
        "flex items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15",
        className ?? "",
      ].join(" ")}
    >
      <Icon className="size-3.5" />
    </div>
  );
}

/* 点击头像弹出大图浮层（可放大的头像） */
export function AvatarZoom({ role, className }: { role: AgentId; className?: string }) {
  const profile = useAgent(role);
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  // 打开时锁定背景滚动；支持点击遮罩 / Esc 关闭
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="点击查看大图"
        aria-label={`查看${profile.name}大图`}
        className={[
          "group relative block shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
          className ?? "",
        ].join(" ")}
      >
        <AgentAvatar role={role} className="size-full transition group-hover:brightness-95" />
        <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-background/90 text-primary opacity-0 shadow-sm transition group-hover:opacity-100">
          <Maximize2 className="size-2.5" />
        </span>
      </button>
      {open && profile.avatarUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${profile.name} 头像大图`}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          onClick={close}
        >
          <div className="flex flex-col items-center gap-3">
            <img
              src={profile.avatarUrl!}
              alt={profile.name}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[74vh] max-w-[88vw] rounded-2xl object-contain shadow-2xl ring-1 ring-white/10"
            />
            <span className="rounded-full bg-black/50 px-3 py-1 text-xs text-white/90">
              {profile.name} · 点击空白处或按 Esc 关闭
            </span>
          </div>
        </div>
      )}
    </>
  );
}

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const map = {
    done: { icon: CheckCircle2, cls: "bg-emerald-600/90 text-white", label: "已完成" },
    thinking: { icon: Clock3, cls: "bg-muted text-foreground animate-[spin_2s_linear_infinite]", label: "思考中" },
    standby: { icon: Clock3, cls: "bg-muted text-muted-foreground", label: "等待中" },
    producing: { icon: Sparkles, cls: "bg-amber-500/90 text-white animate-pulse", label: "产出中" },
  } as const;
  const { icon: Icon, cls, label } = map[status];
  return (
    <span
      title={label}
      aria-label={label}
      className={["inline-flex size-4 items-center justify-center rounded-full", cls].join(" ")}
    >
      <Icon className="size-2.5" />
    </span>
  );
}
