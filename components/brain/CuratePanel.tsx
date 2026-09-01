"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CircleAlert,
  Layers,
  RefreshCw,
  Scale,
  ScanSearch,
  Sparkles,
} from "lucide-react";

type CurationStatus = "suggested" | "confirmed" | "ignored";
type BrainCurateView = {
  noteId: string;
  stale: {
    isStale: boolean;
    staleDays: number;
    thresholdDays: number;
    reason?: "not_updated" | "not_referenced";
    lastDecision?: "keep" | "reorganize" | "archive";
  } | null;
  similar: {
    pairId: string;
    otherNoteId: string;
    otherTitle: string;
    otherSummary: string;
    score: number;
    method: "semantic" | "keyword";
    status: "suggested" | "related" | "independent" | "ignored";
  }[];
  relations: {
    id: string;
    type: string;
    typeLabel: string;
    direction: "out" | "in";
    targetId: string;
    targetType: "note" | "task" | "project" | string;
    targetTitle: string;
    note: string | null;
    status: CurationStatus;
  }[];
};

/**
 * 「整理」面板（P2-B）：单条笔记的相似内容 / 可能过期 / 关系建议。
 * 只读分析当前用户数据并记录其决策；绝不静默合并、删除或覆盖原笔记。
 * 决策成功后内部刷新视图，父级可通过 onChanged 同步（如刷新收件箱/任务看板）。
 */
export function CuratePanel({
  noteId,
  onChanged,
}: {
  noteId: string;
  onChanged?: (action: "similar" | "stale" | "relation") => void;
}) {
  const [view, setView] = useState<BrainCurateView | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    let disposed = false;
    setLoading(true);
    setError("");
    fetch(`/api/brain/curate?noteId=${encodeURIComponent(noteId)}`)
      .then((r) => r.json())
      .then((d: BrainCurateView) => {
        if (disposed) return;
        setView(d);
      })
      .catch(() => {
        if (!disposed) setError("加载整理信息失败");
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [noteId]);

  useEffect(load, [load]);

  const runScan = () => {
    setScanning(true);
    setError("");
    fetch("/api/brain/curate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "scan", noteId }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) {
          setError(d.error === "scan_failed" ? "扫描失败，请稍后重试" : d.error);
          return;
        }
        load();
      })
      .catch(() => setError("扫描失败，请稍后重试"))
      .finally(() => setScanning(false));
  };

  const decide = async (kind: "similar" | "stale" | "relation", payload: Record<string, unknown>) => {
    setPendingId(kind);
    setError("");
    try {
      const res = await fetch(`/api/brain/curate/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok || !d?.ok) {
        setError(kind === "stale" ? "处理失败，请稍后重试" : "操作失败，请稍后重试");
        return;
      }
      load();
      onChanged?.(kind);
    } catch {
      setError("网络异常，操作未完成");
    } finally {
      setPendingId(null);
    }
  };

  const similarPending = view?.similar.some((s) => s.status === "suggested");
  const suggestedRelations = view?.relations.filter((r) => r.status === "suggested");
  const idle = !view?.stale?.isStale && view?.similar.length === 0 && !suggestedRelations?.length;

  return (
    <div className="border-t border-border/70 px-4 py-2.5">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="size-3.5 text-primary" />
        <span className="text-[11px] font-semibold text-foreground">整理建议</span>
        <button
          className="ml-auto inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition hover:border-primary/40 hover:text-primary"
          onClick={(ev) => {
            ev.stopPropagation();
            runScan();
          }}
          disabled={scanning}
        >
          <RefreshCw className={`size-3 ${scanning ? "animate-spin" : ""}`} /> 重新扫描
        </button>
      </div>

      {error && <p className="mb-2 text-[11px] text-destructive">{error}</p>}

      {loading && (
        <div className="flex items-center gap-2 py-2 text-[11px] text-muted-foreground">
          <span className="size-3 animate-spin rounded-full border-2 border-border border-t-primary" />
          正在整理…
        </div>
      )}

      {!loading && view && idle && (
        <p className="flex items-center gap-1.5 py-1.5 text-[11px] text-muted-foreground">
          <ScanSearch className="size-3.5 text-muted-foreground/50" />
          暂无相似内容、过期提醒或待确认的关系建议
        </p>
      )}

      {/* —— 可能过期 —— */}
      {!loading && view && view.stale?.isStale && (
        <div className="mb-2 rounded-lg border border-amber-200/70 bg-amber-50/60 px-3 py-2">
          <div className="mb-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
            <CircleAlert className="size-3.5 text-amber-600" />
            <span className="font-semibold text-amber-800">
              {view.stale.reason === "not_referenced"
                ? "可能已被遗忘（长期未被引用）"
                : "疑似内容过期（长期未更新）"}
            </span>
            <span className="ml-auto text-[10px] text-amber-600">
              距今约 {view.stale.staleDays} 天
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-700">
            {view.stale.reason === "not_referenced"
              ? "这条笔记超过阈值天数未被其他笔记引用，可能是重要但易被遗忘的知识。"
              : "这条笔记超过阈值天数未更新，建议检查是否需要重新整理或归档。"}
          </p>
          {view.stale.lastDecision ? (
            <p className="mt-1.5 text-[10px] text-amber-600">已处理：{staleActionLabel(view.stale.lastDecision)}</p>
          ) : (
            <div className="mt-2 flex gap-1.5">
              {(
                [
                  ["keep", "保留"],
                  ["reorganize", "重新整理"],
                  ["archive", "归档"],
                ] as const
              ).map(([action, label]) => (
                <button
                  key={action}
                  className="rounded border border-amber-300/70 bg-card px-2 py-0.5 text-[10px] text-amber-800 transition hover:border-amber-500 hover:bg-amber-100 disabled:opacity-50"
                  disabled={pendingId === "stale"}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    decide("stale", { noteId, action, reason: view.stale?.reason });
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* —— 相似内容 —— */}
      {!loading && view && similarPending && view.similar.length > 0 && (
        <div className="mb-2">
          <div className="mb-1 text-[11px] font-medium text-foreground">
            相似内容（{view.similar.filter((s) => s.status === "suggested").length}）
          </div>
          <div className="space-y-1.5">
            {view.similar
              .filter((s) => s.status === "suggested")
              .map((s) => (
                <div key={s.pairId} className="flex items-center gap-2 rounded-lg border border-border/70 bg-card px-2.5 py-1.5">
                  <Scale className="size-3.5 shrink-0 text-primary/70" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[11px] font-medium text-foreground">{s.otherTitle}</span>
                      <span className="shrink-0 rounded bg-primary/10 px-1 py-px text-[9px] font-medium text-primary">
                        {Math.round(s.score * 100)}%
                      </span>
                      <span className="shrink-0 text-[9px] text-muted-foreground">
                        {s.method === "semantic" ? "语义" : "关键词"}
                      </span>
                    </div>
                    {s.otherSummary && (
                      <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{s.otherSummary}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      className="rounded border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px] text-primary transition hover:bg-primary/15"
                      disabled={pendingId === "similar"}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        decide("similar", { id: s.pairId, action: "related" });
                      }}
                    >
                      相关
                    </button>
                    <button
                      className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition hover:border-muted-foreground/40 hover:text-foreground"
                      disabled={pendingId === "similar"}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        decide("similar", { id: s.pairId, action: "independent" });
                      }}
                    >
                      独立
                    </button>
                    <button
                      className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground/60 transition hover:text-foreground"
                      disabled={pendingId === "similar"}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        decide("similar", { id: s.pairId, action: "ignored" });
                      }}
                    >
                      忽略
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* —— 关系建议（待确认） —— */}
      {!loading && suggestedRelations && suggestedRelations.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-medium text-foreground">
            关系建议（{suggestedRelations.length}）
          </div>
          <div className="space-y-1.5">
            {suggestedRelations.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-[11px] text-foreground">
                <ArrowIcon direction={r.direction} targetType={r.targetType} />
                <span className="shrink-0 text-muted-foreground">{r.typeLabel}</span>
                <span className="min-w-0 flex-1 truncate">{r.targetTitle}</span>
                <button
                  className="shrink-0 rounded border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px] text-primary transition hover:bg-primary/15"
                  disabled={pendingId === "relation"}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    decide("relation", { id: r.id, action: "confirmed" });
                  }}
                >
                  确认
                </button>
                <button
                  className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition hover:text-foreground"
                  disabled={pendingId === "relation"}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    decide("relation", { id: r.id, action: "ignored" });
                  }}
                >
                  忽略
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && view && (view.similar.length > 0 || (suggestedRelations?.length ?? 0) > 0) && (
        <div className="mt-1.5 text-[10px] text-muted-foreground/70">
          <Layers className="mr-0.5 inline size-3 align-[-2px]" />
          {view.similar.length > 0 && `已决策相似 ${view.similar.filter((s) => s.status !== "suggested").length}/${view.similar.length}`}
          {view.similar.length > 0 && (suggestedRelations?.length ?? 0) > 0 ? " · " : ""}
          {(suggestedRelations?.length ?? 0) > 0
            ? `已确认关系 ${view.relations.filter((r) => r.status === "confirmed").length}/${view.relations.length}`
            : ""}
        </div>
      )}
    </div>
  );
}

function staleActionLabel(a: string): string {
  if (a === "keep") return "标记保留";
  if (a === "reorganize") return "重新整理";
  return "已归档";
}

function ArrowIcon({ direction, targetType }: { direction: "out" | "in"; targetType: string }) {
  const cls = "size-3.5 shrink-0 text-muted-foreground";
  if (targetType === "task") return <ArrowUpRight className={cls} />;
  if (targetType === "project") return <ArrowRight className={cls} />;
  return direction === "in" ? <ArrowDownLeft className={cls} /> : <ArrowUpRight className={cls} />;
}