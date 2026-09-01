"use client";

/**
 * 数据引擎 —— 组合建议卡（T1 组合引擎前端入口）
 *
 * 在「选择数据」阶段顶部展示：上传多张表后，xiye 自动检测到的可组合连接键。
 * 仅展示建议，用户显式点「组合」才执行（与「产品推荐不自动合并」铁律一致）。
 * 组合算力在 xiye（joinTables 纯函数），飞书只是可选物化层。
 */

import { Link2, Loader2, X } from "lucide-react";
import type { JoinSuggestion } from "@/lib/table/combine/detect-join-keys";

export function CombineSuggestionCard({
  suggestions,
  onCombine,
  combining,
  combineKey,
  onDismiss,
}: {
  suggestions: JoinSuggestion[];
  onCombine: (s: JoinSuggestion) => void;
  combining: boolean;
  /** 当前正在组合的建议标识（left|right tableId + key），用于禁用按钮 */
  combineKey?: string;
  onDismiss: () => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <Link2 className="size-4 text-primary" />
          检测到可组合的数据表
        </div>
        <button
          onClick={onDismiss}
          className="flex size-5 items-center justify-center rounded-md text-muted-foreground transition hover:bg-white/60 hover:text-foreground"
          aria-label="关闭组合建议"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">
        以下字段重叠度高，可一键组合成一张宽表后再分析。组合仅作建议，不会自动执行。
      </div>

      <div className="mt-2.5 space-y-2">
        {suggestions.map((s, i) => {
          const key = `${s.leftTableId}|${s.rightTableId}|${s.keyColumnLeft}|${s.keyColumnRight}`;
          const isCombining = combining && combineKey === key;
          const pct = Math.round(s.matchRate * 100);
          return (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border border-border/70 bg-white px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                  <span className="font-medium text-foreground">{s.leftSheet}</span>
                  <Link2 className="size-3 text-primary/70" />
                  <span className="font-medium text-foreground">{s.rightSheet}</span>
                  <span
                    className={
                      "rounded-full px-1.5 py-px text-[10px] font-medium " +
                      (s.confidence === "high"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700")
                    }
                  >
                    {s.confidence === "high" ? "强关联" : "可能可组合"}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {s.note}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
                  {pct}%
                </span>
                <button
                  disabled={combining}
                  onClick={() => onCombine(s)}
                  className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                >
                  {isCombining ? <Loader2 className="size-3 animate-spin" /> : <Link2 className="size-3" />}
                  组合
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
