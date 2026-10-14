"use client";

// 本地档案切换器（形态 C · 桌面应用）。
//
// 右上角不再有登录/注册/登出：打开即用，身份由「当前档案」决定。
// 每个档案 = 一整套独立的业务数据（所有业务表按 user_id 分区），
// 因此切换档案就是切换一整套数据，用于隔离与划分存储内容。

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Layers, LogOut, Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isPublicDeploy } from "@/lib/deploy-mode";
import {
  DEFAULT_PROFILE_ID,
  DEFAULT_PROFILE_NAME,
  newProfileId,
  syncCurrentProfile,
  writeProfileCookie,
  writeProfileList,
  type LocalProfile,
} from "@/lib/local-profile";

export function ProfileMenu() {
  const [profiles, setProfiles] = useState<LocalProfile[]>([]);
  const [currentId, setCurrentId] = useState(DEFAULT_PROFILE_ID);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    // 与服务端对齐当前档案：无 cookie 时服务端会回退到既有数据所属的档案
    syncCurrentProfile().then(({ list, currentId: id }) => {
      if (!alive) return;
      setProfiles(list);
      setCurrentId(id);
    });
    return () => {
      alive = false;
    };
  }, []);

  // 点外部关闭下拉
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      setOpen(false);
      setCreating(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  /** 切换档案：写 cookie 后整页刷新，让服务端按新档案重新渲染全部数据 */
  function switchTo(id: string) {
    setOpen(false);
    setCreating(false);
    if (id === currentId) return;
    writeProfileCookie(id);
    window.location.reload();
  }

  function confirmCreate() {
    const name = draftName.trim() || `档案 ${profiles.length + 1}`;
    const next: LocalProfile = {
      id: newProfileId(),
      name,
      createdAt: Date.now(),
    };
    const list = [...profiles, next];
    writeProfileList(list);
    setProfiles(list);
    setDraftName("");
    setCreating(false);
    switchTo(next.id);
  }

  const current = profiles.find((p) => p.id === currentId);
  const currentName = current?.name ?? DEFAULT_PROFILE_NAME;

  // public 部署（Vercel 公开多用户）：身份由服务端签名 cookie 锁定，
  // 前端写普通 cookie 切换档案必然验签失败 → 401。故只保留「退出」，
  // 且退出需走服务端（cookie 是 HttpOnly，JS 清不掉）。
  if (isPublicDeploy()) {
    return (
      <button
        type="button"
        onClick={async () => {
          await fetch("/api/enter", { method: "DELETE" }).catch(() => {});
          window.location.href = "/enter";
        }}
        aria-label="退出"
        className="flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
      >
        <LogOut className="size-3.5" />
        <span className="hidden sm:inline">退出</span>
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="切换档案"
        className="flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-1 text-sm transition-colors hover:border-primary"
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Layers className="size-3.5" />
        </span>
        <span className="max-w-24 truncate text-xs text-foreground">
          {currentName}
        </span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 z-[80] mt-2 w-56 rounded-xl border border-border bg-card p-1.5 shadow-xl">
          <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            切换档案
          </div>

          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => switchTo(p.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Check
                className={`size-3.5 shrink-0 ${
                  p.id === currentId ? "text-primary" : "opacity-0"
                }`}
              />
              <span className="truncate">{p.name}</span>
            </button>
          ))}

          <div className="my-1 h-px bg-border" />

          {creating ? (
            // 内联输入：Electron/Tauri 下 window.prompt 常被禁用，不能依赖它
            <div className="px-1.5 py-1">
              <input
                ref={inputRef}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmCreate();
                  if (e.key === "Escape") setCreating(false);
                }}
                placeholder={`档案 ${profiles.length + 1}`}
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
              />
              <div className="mt-1.5 flex justify-end gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCreating(false)}
                >
                  取消
                </Button>
                <Button size="sm" onClick={confirmCreate}>
                  创建
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Plus className="size-4 text-muted-foreground" /> 新建档案
            </button>
          )}

          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <Settings2 className="size-4 text-muted-foreground" /> 管理档案
          </Link>
        </div>
      )}
    </div>
  );
}