"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, Loader2, RotateCcw, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RecoveryView {
  id: string;
  createdAt: number;
  step: string | null;
  reason: string | null;
  contentPreview: string;
  rolledBack: boolean;
  pendingRecovery: boolean;
  written: { noteId: string | null; taskIds: string[]; strategyIds: string[]; reminderIds: string[] };
}

/** 内部恢复与运维入口：列出 pending_recovery / failed 计划，支持重试、补偿回滚、标记人工处理与清理策略。 */
export function RecoveryManager() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<RecoveryView[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/brain/plans?recovery=1");
      const d = await res.json();
      setItems(res.ok ? (d.recoveries ?? []) : []);
      if (!res.ok) setMsg(d?.error || "加载失败");
    } catch {
      setMsg("恢复列表加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const exec = async (action: string, planId: string) => {
    setBusyId(`${action}:${planId}`);
    setMsg("");
    try {
      const res = await fetch("/api/brain/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, planId }),
      });
      const d = await res.json();
      setMsg(res.ok ? "操作成功" : (d?.reason ?? d?.error ?? "操作失败"));
      if (res.ok) load();
    } catch {
      setMsg("操作失败，请重试");
    } finally {
      setBusyId(null);
    }
  };

  const runCleanup = async () => {
    setBusyId("cleanup");
    setMsg("");
    try {
      const res = await fetch("/api/brain/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_cleanup" }),
      });
      const d = await res.json();
      setMsg(res.ok ? `已归档 ${d.archived?.length ?? 0} 条旧计划审计记录` : "清理失败");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <ShieldAlert className="size-4" />
          恢复与运维
          {items.length > 0 && (
            <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-red-600">
              {items.length}
            </span>
          )}
        </h2>
        <span className="text-[11px] text-muted-foreground">{open ? "收起" : "展开"}</span>
      </button>

      {open && (
        <div className="mt-3">
          <div className="mb-2 flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={runCleanup} disabled={busyId === "cleanup"}>
              {busyId === "cleanup" ? <Loader2 className="size-3 animate-spin" /> : <Archive className="size-3" />}
              执行清理策略（软归档）
            </Button>
            {msg && <span className="text-[11px] text-muted-foreground">{msg}</span>}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> 加载中
            </div>
          ) : items.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">没有待恢复的计划。</p>
          ) : (
            <ul className="space-y-2">
              {items.map((it) => (
                <li key={it.id} className="rounded-lg border border-border/70 bg-muted/20 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-medium text-foreground">{it.contentPreview || it.id}</div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {it.id} · {new Date(it.createdAt).toLocaleString("zh-CN")} · 步骤：{it.step ?? "apply"}
                      </div>
                      {it.reason && <div className="mt-0.5 line-clamp-1 text-[10px] text-destructive">原因：{it.reason}</div>}
                      {!it.rolledBack && (it.pendingRecovery || it.written.noteId) && (
                        <div className="mt-0.5 text-[10px] text-amber-600">⚠️ 存在未回滚的部分写入，可先补偿</div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button size="sm" variant="outline" className="h-6 gap-1 px-1.5 text-[10px]" onClick={() => exec("retry_apply", it.id)} disabled={busyId === `retry_apply:${it.id}`}>
                        <RotateCcw className="size-3" />
                        重试
                      </Button>
                      <Button size="sm" variant="outline" className="h-6 gap-1 px-1.5 text-[10px]" onClick={() => exec("compensate", it.id)} disabled={busyId === `compensate:${it.id}`}>
                        <Trash2 className="size-3" />
                        回滚
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={() => exec("mark_handled", it.id)} disabled={busyId === `mark_handled:${it.id}`}>
                        已处理
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}