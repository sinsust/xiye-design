"use client";

// 全局「离开流程守卫」：仅当停留在 /flow 且已有流程草稿时，拦截「离开 /flow」的链接点击，
// 弹窗让用户选择：保存草稿并离开 / 放弃并离开 / 取消（留在流程）。
// 刷新页面的内容保留由 localStorage persist 天然兜底，守卫不干预刷新。
// 「视觉微调」（/builder?from=flow）与 /flow 自身不视为离开，不拦截。

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, Save, Trash2, X } from "lucide-react";
import { useFlowStore } from "@/lib/store/flow-store";
import { saveFlowDraft } from "@/lib/flow-save";
import { Button } from "@/components/ui/button";

/** 判断 flow 是否已有「值得保留」的草稿内容 */
function hasFlowDraft(): boolean {
  const s = useFlowStore.getState();
  if ((s.currentStep ?? 1) > 1) return true;
  if (s.productBrief?.vision) return true;
  if (s.intentNarrative?.vision) return true;
  if (s.pageBlueprint.length > 0) return true;
  if (s.projectInfo?.projectName?.trim()) return true;
  return false;
}

/** 解析一个链接，判断是否「离开 /flow」。返回 null = 无需拦截（站外、空 hash、或本就是流程内） */
function resolveLeaveTarget(anchor: HTMLAnchorElement): string | null {
  const raw = anchor.getAttribute("href") || "";
  if (!raw || raw.startsWith("#")) return null;
  try {
    const u = new URL(raw, window.location.origin);
    // 流程内：/flow 本身、视觉微调 /builder?from=flow → 不拦截
    if (u.pathname === "/flow") return null;
    if (u.pathname === "/builder" && u.searchParams.get("from") === "flow") return null;
    // 站外链接原样放行
    if (u.origin !== window.location.origin) return null;
    return u.pathname + u.search + u.hash;
  } catch {
    return null;
  }
}

export function FlowLeaveGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const inFlow = pathname === "/flow";
  const [pending, setPending] = useState<{ target: string; busy: boolean; saving: boolean } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const pendingRef = useRef<string | null>(null);

  useEffect(() => setMounted(true), []);

  // 同步待确认目标到 ref，供 capture 监听器判断「已弹窗则不再拦截」
  useEffect(() => {
    if (pending === null) pendingRef.current = null;
  }, [pending]);

  useEffect(() => {
    if (!inFlow) return;
    const onCapture = (e: MouseEvent) => {
      if (pendingRef.current) return; // 已有待确认弹窗（点击弹窗本身），不再触发
      const target = (e.target as Element | null)?.closest?.("a");
      if (!(target instanceof HTMLAnchorElement)) return;
      if (!hasFlowDraft()) return;
      const leaveTarget = resolveLeaveTarget(target);
      if (leaveTarget === null) return;
      e.preventDefault();
      e.stopPropagation();
      pendingRef.current = leaveTarget;
      setMsg(null);
      setPending({ target: leaveTarget, busy: false, saving: false });
    };
    document.addEventListener("click", onCapture, true);
    return () => document.removeEventListener("click", onCapture, true);
  }, [inFlow]);

  const navigateTo = (target: string) => router.replace(target);

  const onSaveAndLeave = async () => {
    if (!pending) return;
    setPending({ ...pending, saving: true, busy: true });
    const r = await saveFlowDraft();
    if (r.ok) {
      navigateTo(pending.target);
      return;
    }
    if (r.reason === "login") {
      setMsg("保存到「我的项目」需要先登录");
      setPending({ ...pending, saving: false, busy: false });
      return;
    }
    setMsg("保存失败，请重试或选择放弃");
    setPending({ ...pending, saving: false, busy: false });
  };

  const onDiscardAndLeave = () => {
    if (!pending) return;
    useFlowStore.getState().resetAll(1);
    useFlowStore.getState().setSavedProjectId(null);
    try {
      useFlowStore.persist?.clearStorage?.();
    } catch {
      /* noop */
    }
    try {
      window.localStorage.removeItem("xiye-flow-design");
    } catch {
      /* noop */
    }
    navigateTo(pending.target);
  };

  if (!inFlow || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={() => { if (!pending?.busy) setPending(null); }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
            <AlertTriangle className="size-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">离开当前流程？</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              本次流程尚未完成。可以保存为草稿，之后随时到「我的项目」继续，也可以放弃本次进度。
              <span className="mt-0.5 block text-foreground/60">
                （刷新页面会自动保留已生成内容，不受此弹窗影响）
              </span>
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭"
            onClick={() => setPending(null)}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {msg && (
          <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {msg}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2">
          <Button variant="default" disabled={pending?.busy} onClick={onSaveAndLeave}>
            {pending?.saving ? "保存中…" : "保存草稿并离开"} <Save className="size-3.5" />
          </Button>
          <Button variant="outline" disabled={pending?.busy} onClick={onDiscardAndLeave}>
            放弃本次进度并离开 <Trash2 className="size-3.5" />
          </Button>
          <Button variant="ghost" disabled={pending?.busy} onClick={() => setPending(null)}>
            取消，继续流程
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}