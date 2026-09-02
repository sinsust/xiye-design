"use client";

/**
 * 数据引擎 —— 分析建议（AI 推荐维度 + 自定义查询）
 * 默认显示前 4 个高价值维度卡，其余折叠；checkbox 选中 → 底部吸附栏「开始分析 (N)」。
 * 自定义输入走 userQuery 模式（AI 理解意图后执行）。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, Loader2, Sparkles, XCircle } from "lucide-react";
import { describeDimension } from "@/lib/table/analysis";
import { readForceRoute, writeLLMRoute } from "@/components/LLMRouteBadge";
import type { AnalysisDimension, TableProfileResult } from "@/lib/table/types";

const CHART_ICONS: Record<string, string> = {
  line: "📈",
  bar: "📊",
  pie: "🥧",
  scatter: "✨",
  histogram: "📉",
  boxplot: "📦",
  heatmap: "🔥",
  table: "📋",
  topn: "🏆",
  mom: "📊",
  groupbar: "🧮",
};

const LOADING_PHASES = [
  "正在分析字段画像",
  "正在识别字段关联",
  "正在生成维度建议",
  "最后整理中",
];

export function AnalysisRecommender({
  profile,
  tableId,
  onRun,
}: {
  profile: TableProfileResult;
  tableId: string;
  onRun: (dimensions: AnalysisDimension[], userQuery: string) => void;
}) {
  const [dimensions, setDimensions] = useState<AnalysisDimension[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  const [recommendRoute, setRecommendRoute] = useState<"qwen" | "deepseek" | "local" | "">("");
  const abortRef = useRef<AbortController | null>(null);

  // 进度推进 + 阶段轮换（loading 时）
  useEffect(() => {
    if (!loading) {
      setProgress(0);
      setPhase(0);
      return;
    }
    const start = Date.now();
    // 0→90% 平滑推进：预计 12s 到达 90%
    const tick = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const pct = Math.min(90, 8 + elapsed * 6.5);
      setProgress(pct);
      // 每 2.5s 切换阶段文案
      setPhase(Math.min(3, Math.floor(elapsed / 2.5)));
    }, 200);
    return () => clearInterval(tick);
  }, [loading]);

  const loadRecommendations = useCallback(async () => {
    if (dimensions.length > 0) return;
    setLoading(true);
    setError("");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/brain/table/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, tableId, forceRoute: readForceRoute() }),
        signal: ctrl.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "推荐失败");
      setDimensions(data.dimensions ?? []);
      setRecommendRoute(data.route === "local" ? "local" : data.route === "qwen" || data.route === "deepseek" ? data.route : "");
      if (data.route === "qwen" || data.route === "deepseek") writeLLMRoute(data.route);
      setProgress(100);
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setError("已取消");
      } else {
        setError((e as Error).message);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [profile, tableId, dimensions.length]);

  const cancel = () => {
    abortRef.current?.abort();
  };

  // 进入面板即请求推荐（惰性一次，useEffect 触发，避免 render 期副作用 / StrictMode 双 fetch）
  useEffect(() => {
    if (dimensions.length === 0 && !loading && !error) {
      void loadRecommendations();
    }
  }, [dimensions.length, loading, error, loadRecommendations]);

  const visible = expanded ? dimensions : dimensions.slice(0, 4);
  const toggle = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className="flex flex-col px-5 py-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">分析建议</div>

      {loading && (
        <div className="flex flex-col gap-3 py-8 animate-in fade-in duration-200">
          {/* 多阶段进度条：每阶段独立进度，反映各任务完成度 */}
          <div className="w-full max-w-xs space-y-1.5">
            {LOADING_PHASES.map((label, i) => {
              const start = i * 25;
              const end = (i + 1) * 25;
              const done = progress >= end;
              const current = !done && progress >= start;
              const stagePct = done ? 100 : current ? ((progress - start) / 25) * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-2">
                  {done ? (
                    <Check className="size-3 shrink-0 text-primary" />
                  ) : current ? (
                    <Loader2 className="size-3 shrink-3 animate-spin text-primary" />
                  ) : (
                    <span className="flex size-3 shrink-0 items-center justify-center rounded-full border border-muted-foreground/30 text-[9px] text-muted-foreground/40" />
                  )}
                  <span
                    className={
                      "w-20 shrink-0 text-[11px] " +
                      (done ? "text-muted-foreground" : current ? "font-medium text-foreground" : "text-muted-foreground/50")
                    }
                  >
                    {label}
                  </span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={
                        "h-full rounded-full transition-all duration-300 " +
                        (done
                          ? "bg-primary"
                          : current
                            ? "bg-gradient-to-r from-primary to-primary/70"
                            : "bg-transparent")
                      }
                      style={{ width: `${stagePct}%` }}
                    />
                  </div>
                  <span className="w-7 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground/70">
                    {done ? "100%" : current ? `${Math.round(stagePct)}%` : ""}
                  </span>
                </div>
              );
            })}
          </div>
          {/* 取消按钮 */}
          <button
            onClick={cancel}
            className="flex items-center gap-1 text-[10px] text-muted-foreground/60 transition hover:text-red-600"
          >
            <XCircle className="size-3" />
            取消
          </button>
        </div>
      )}
      {error && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="flex-1 break-all">{error}</span>
          <button
            className="text-amber-700 underline"
            onClick={() => {
              setError("");
              setDimensions([]);
              void loadRecommendations();
            }}
          >
            重试
          </button>
          {error.includes("未登录") && (
            <button
              className="rounded bg-amber-200/60 px-2 py-0.5 text-amber-900"
              onClick={() => location.reload()}
            >
              重新登录
            </button>
          )}
        </div>
      )}

      {/* 推荐维度卡片 */}
      {!loading && recommendRoute === "local" && dimensions.length > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-800">
          <Sparkles className="size-3 shrink-0" />
          AI 线路暂不可用，已用本地规则推荐（仍可正常分析）
        </div>
      )}
      {!loading && dimensions.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {visible.map((d, i) => {
            const desc = describeDimension(d, profile);
            return (
            <div
              key={i}
              className={
                "flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-all duration-200 " +
                (selected.has(i)
                  ? "border-primary/50 bg-primary/5 shadow-sm"
                  : "border-border/70 bg-white hover:border-primary/25 hover:bg-muted/20")
              }
            >
              <button
                onClick={() => toggle(i)}
                className={
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition " +
                  (selected.has(i) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-white")
                }
                aria-label="选择"
              >
                {selected.has(i) && <Check className="size-3" />}
              </button>
              <button onClick={() => toggle(i)} className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                  <span className="shrink-0">{CHART_ICONS[d.chartType] ?? "📊"}</span>
                  <span className="truncate">{d.name}</span>
                </div>
                {/* 怎么算：机器生成的直观说明（不依赖 AI 描述） */}
                <div className="mt-0.5 text-[11px] font-medium text-foreground/90">
                  {desc.how}
                </div>
                {/* 示例：真实画像数据 */}
                {desc.example && (
                  <div className="mt-0.5 truncate text-[10px] text-primary/80">
                    示例：{desc.example}
                  </div>
                )}
                {d.description && (
                  <div className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground/70">{d.description}</div>
                )}
              </button>
            </div>
            );
          })}

          {dimensions.length > 4 && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
              className="flex w-full items-center justify-center gap-1 py-1.5 text-[11px] text-muted-foreground transition hover:text-foreground"
            >
              {expanded ? "收起" : `展开其余 ${dimensions.length - 4} 个建议`}
              <ChevronDown className={"size-3 transition-transform " + (expanded ? "rotate-180" : "")} />
            </button>
          )}
        </div>
      )}

      {/* 自定义查询 */}
      <div className="mt-5">
        <div className="mb-1.5 text-[11px] text-muted-foreground">或用自然语言提问</div>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim()) onRun([], query.trim());
            }}
            placeholder="例：华东区销售额最高的 5 个区域是哪些？"
            className="min-w-0 flex-1 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs outline-none transition focus:border-primary/50 focus:bg-white"
          />
          <button
            onClick={() => query.trim() && onRun([], query.trim())}
            disabled={!query.trim()}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-border/70 px-3 text-xs text-foreground transition hover:border-primary/40 hover:text-primary disabled:opacity-40"
          >
            <Sparkles className="size-3.5" />
            分析
          </button>
        </div>
      </div>

      {/* 底部吸附栏 */}
      {selected.size > 0 && (
        <div className="sticky bottom-0 mt-5 -mx-5 border-t border-border/60 bg-white/90 px-5 py-3 backdrop-blur animate-in slide-in-from-bottom-2 duration-200">
          <button
            onClick={() => {
              const dims = [...selected].sort((a, b) => a - b).map((i) => dimensions[i]);
              onRun(dims, "");
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/85 px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-md shadow-primary/20 transition-all duration-200 hover:shadow-lg active:scale-[0.98]"
          >
            开始分析（{selected.size}）
            <ArrowRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
