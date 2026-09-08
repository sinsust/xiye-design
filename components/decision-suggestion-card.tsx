"use client";

// A：决策台账卡片（Decision Ledger，PRD 决策18）。
// 挂载于 builder 左侧栏：把概念访谈阶段沉淀的关键决策做成「采纳 / 驳回」取舍，
// 写 reason 后 POST 到 projects/[id]/decisions 台账，并同步回概念 Brief，
// 使 AGENTS.md / CLAUDE.md 生成时带出「已采纳 / 已驳回 / 待验证假设」的决策上下文。

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFlowStore } from "@/lib/store/flow-store";
import { ClipboardList, Check, X, Loader2, GitBranch } from "lucide-react";

type LedgerStatus = "accepted" | "rejected" | "hypothesis";

interface LedgerItem {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  detail: string;
  status: LedgerStatus;
  reason: string;
  createdAt: number;
  updatedAt: number;
}

interface SuggestionItem {
  id: string;
  title: string;
  detail?: string;
}

const STATUS_LABEL: Record<LedgerStatus, string> = {
  accepted: "已采纳",
  rejected: "已驳回",
  hypothesis: "待验证",
};

export function DecisionSuggestionCard({ projectId }: { projectId: string | null }) {
  const conceptBrief = useFlowStore((s) => s.conceptBrief);
  const setConceptBrief = useFlowStore((s) => s.setConceptBrief);

  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [active, setActive] = useState<{ title: string; action: LedgerStatus } | null>(null);
  const [reason, setReason] = useState("");

  // 尚未在台账中定案的候选决策（来自概念访谈，按 title 去重）
  const suggestions = useMemo<SuggestionItem[]>(() => {
    const inLedger = new Set(ledger.map((l) => l.title));
    return (conceptBrief?.decisions ?? []).filter((d) => !inLedger.has(d.title));
  }, [conceptBrief, ledger]);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/decisions`, { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        setLedger(d.decisions ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  /** 与台账同步：把已定案决策的状态/理由回注进概念 Brief，供 AGENTS.md 生成带出 */
  const annotateBrief = (title: string, status: LedgerStatus, rs: string) => {
    if (!conceptBrief) return;
    setConceptBrief({
      ...conceptBrief,
      decisions: (conceptBrief.decisions ?? []).map((d) =>
        d.title === title ? { ...d, status, reason: rs } : d,
      ),
    });
  };

  const submit = async (item: SuggestionItem, status: LedgerStatus) => {
    if (!projectId || submitting) return;
    setSubmitting(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.title,
          detail: item.detail ?? "",
          status,
          reason: reason.trim(),
        }),
      });
      if (r.ok) {
        annotateBrief(item.title, status, reason.trim());
        setReason("");
        setActive(null);
        await load();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border-t border-border px-3 py-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <ClipboardList className="size-3.5" />
        决策台账
      </div>

      {!projectId ? (
        <p className="text-xs text-muted-foreground">保存项目后可将概念决策取舍写入台账</p>
      ) : loading ? (
        <p className="text-xs text-muted-foreground">读取决策中…</p>
      ) : suggestions.length ? (
        <ul className="space-y-2">
          {suggestions.map((s) => (
            <li key={s.id} className="rounded-lg border border-border/60 p-2">
              <p className="text-xs font-medium leading-snug text-foreground">{s.title}</p>
              {s.detail ? <p className="mt-0.5 text-[11px] text-muted-foreground">{s.detail}</p> : null}

              {active?.title === s.title ? (
                <div className="mt-2 space-y-1.5">
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    aria-label="决策理由"
                    placeholder="理由（可选）"
                    autoFocus
                    className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none placeholder:text-muted-foreground"
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => submit(s, active.action)}
                      disabled={submitting}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition hover:bg-primary/20 disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="size-3 animate-spin" /> : null}
                      {active.action === "accepted" ? "采纳" : "驳回"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActive(null);
                        setReason("");
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActive({ title: s.title, action: "accepted" })}
                    className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-1 text-[11px] font-medium text-success transition hover:bg-success/10"
                  >
                    <Check className="size-3" />
                    采纳
                  </button>
                  <button
                    type="button"
                    onClick={() => setActive({ title: s.title, action: "rejected" })}
                    className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-1 text-[11px] font-medium text-rose-600 transition hover:bg-rose-500/20"
                  >
                    <X className="size-3" />
                    驳回
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : ledger.length ? (
        <ul className="space-y-1.5">
          {ledger.slice(0, 8).map((l) => (
            <li key={l.id} className="text-xs">
              <span
                className={[
                  "mr-1.5 inline-block rounded px-1 py-px text-[10px] font-medium",
                  l.status === "accepted"
                    ? "bg-success/10 text-success"
                    : l.status === "rejected"
                      ? "bg-rose-500/10 text-rose-600 line-through"
                      : "bg-warning/10 text-warning",
                ].join(" ")}
              >
                {STATUS_LABEL[l.status]}
              </span>
              <span className="text-muted-foreground">{l.title}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <GitBranch className="size-3" />
          暂无待取舍决策
        </p>
      )}
    </div>
  );
}