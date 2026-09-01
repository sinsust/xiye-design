"use client";

/**
 * 数据引擎 —— 解析结果概览 / 选择分析对象（T1-D2 升级）
 *
 * 设计原则：
 *  - 每张 Sheet 卡片清晰呈现：角色标签、推荐标签、有效行列、主要字段类型摘要、推荐理由、
 *    是否需确认表头；让用户「看懂系统推荐哪个、为什么、表头在哪」。
 *  - 默认仅自动预选「推荐且主数据且无需确认表头」的 Sheet；其余需用户显式确认表头后进入。
 *  - 非推荐 Sheet（汇总/备注/无法判断）允许用户手动选择，但给出风险提示，不自动拦截。
 *  - 单表选择（v1 限制只选一个进入分析，给出清晰提示，不静默丢选项）；不自动合并。
 *  - 键盘可达：卡片为 <button>，支持 Tab/Enter 选择。
 */

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  FileSpreadsheet,
  Info,
  Layers,
  Sparkles,
  Table2,
} from "lucide-react";
import type { UploadResult } from "./TableUploader";
import type { SheetRecommendation, SheetRole } from "@/lib/table/types";
import {
  ROLE_LABELS,
  recommendationTag,
  fieldTypeSummary,
  topReasons,
  nextPhaseAfterSelect,
  isAnalyzable,
} from "@/lib/table/confirmation-flow";

const ROLE_TONE: Record<SheetRole, string> = {
  primary_data: "bg-emerald-50 text-emerald-700 border-emerald-200",
  secondary_data: "bg-sky-50 text-sky-700 border-sky-200",
  summary: "bg-amber-50 text-amber-700 border-amber-200",
  notes: "bg-zinc-100 text-zinc-600 border-zinc-200",
  unknown: "bg-zinc-100 text-zinc-500 border-zinc-200",
};

export function SheetSelector({
  data,
  onConfirm,
}: {
  data: UploadResult;
  onConfirm: (index: number) => void;
}) {
  // 每张结果卡（含其推荐）；按推荐 rank 升序展示（rank 越小越优先）
  const cards = useMemo(() => {
    return data.results
      .map((r, i) => ({ index: i, name: r.sheetName, rec: r.recommendation, result: r }))
      .sort((a, b) => {
        const ra = a.rec?.rank ?? 999;
        const rb = b.rec?.rank ?? 999;
        if (ra !== rb) return ra - rb;
        return a.index - b.index;
      });
  }, [data]);

  // 默认预选：第一个「推荐 + 主数据 + 无需确认表头」的 Sheet
  const defaultIndex = useMemo(() => {
    const hit = cards.find(
      (c) => c.rec && c.rec.recommended && c.rec.role === "primary_data" && !c.rec.requiresHeaderConfirmation,
    );
    return hit ? hit.index : cards[0]?.index ?? 0;
  }, [cards]);

  const [selected, setSelected] = useState(defaultIndex);

  const totalRows = useMemo(
    () =>
      data.parsedInfo
        ? data.parsedInfo.sheets.reduce((a, s) => a + s.rowCount, 0)
        : data.results.reduce((a, r) => a + (r.effectiveRowCount ?? 0), 0),
    [data],
  );

  const fileLabel = useMemo(
    () =>
      data.parsedInfo?.fileName ??
      (data.results.length > 1 ? `多文件（${data.results.length} 张表）` : data.results[0]?.sheetName ?? "数据"),
    [data],
  );
  const sheetCount = data.parsedInfo?.sheets.length ?? data.results.length;

  // 是否存在任何被推荐的 Sheet（用于「无可分析 Sheet」提示）
  const hasRecommended = cards.some((c) => c.rec?.recommended);
  const selectedRec = cards.find((c) => c.index === selected)?.rec;

  return (
    <div className="flex flex-col px-6 py-6">
      {/* 文件概要（一行） */}
      <div className="flex items-center gap-2 text-sm text-foreground">
        <FileSpreadsheet className="size-4 text-primary" />
        <span className="font-semibold">{fileLabel}</span>
        <span className="text-muted-foreground">
          · {sheetCount} 个 Sheet · 共 {totalRows.toLocaleString()} 行
        </span>
      </div>

      {/* 引导说明 */}
      <div className="mt-4 text-xs text-muted-foreground">
        系统已为每个 Sheet 给出推荐与理由。选中一个作为分析对象，确认表头后即可开始分析。
      </div>

      {/* 无可推荐 Sheet 的提示（仍允许手动选择，但给出原因与返回入口） */}
      {!hasRecommended && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            未能自动推荐可分析的数据表（可能全是汇总/备注/说明表）。你仍可手动选择一个继续，
            但分析结果可能不准确；若文件有误，请使用右上角「重新上传」。
          </span>
        </div>
      )}

      {/* 分析对象卡片 */}
      <div className="mt-3 space-y-3">
        {cards.map((c) => {
          const isSel = selected === c.index;
          const rec = c.rec as SheetRecommendation | undefined;
          const r = c.result;
          const role = rec?.role ?? "unknown";
          const needsConfirm = rec?.requiresHeaderConfirmation ?? false;
          const recommended = rec?.recommended ?? false;
          const isMerged = r.sheetName.includes("合并");
          return (
            <button
              key={c.index}
              role="radio"
              aria-checked={isSel}
              onClick={() => setSelected(c.index)}
              className={
                "w-full rounded-xl border text-left transition-all duration-200 " +
                (isSel
                  ? "border-primary/50 bg-primary/5 shadow-sm"
                  : "border-border/70 bg-white hover:border-primary/30 hover:bg-muted/30")
              }
            >
              {/* 卡片头：图标 + 名称 + 标签 + 行数 */}
              <div className="flex items-start gap-3 px-3.5 pt-3">
                <div
                  className={
                    "flex size-9 shrink-0 items-center justify-center rounded-lg " +
                    (isSel ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")
                  }
                >
                  {isMerged ? <Layers className="size-4" /> : <Table2 className="size-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-[13px] font-medium text-foreground">{c.name}</span>
                    {/* 角色标签 */}
                    <span
                      className={
                        "rounded-full border px-1.5 py-px text-[10px] font-medium " + ROLE_TONE[role]
                      }
                    >
                      {ROLE_LABELS[role]}
                    </span>
                    {/* 推荐标签 */}
                    <span
                      className={
                        "rounded-full px-1.5 py-px text-[10px] font-medium " +
                        (recommended
                          ? needsConfirm
                            ? "bg-sky-100 text-sky-700"
                            : "bg-emerald-100 text-emerald-700"
                          : "bg-zinc-100 text-zinc-500")
                      }
                    >
                      {recommendationTag(rec as SheetRecommendation)}
                    </span>
                    {/* 需确认表头徽标 */}
                    {needsConfirm && (
                      <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-medium text-amber-700">
                        <Info className="size-2.5" /> 需确认表头
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {isMerged
                      ? `已合并结构相同的 Sheet（共 ${r.rows.length.toLocaleString()} 行）`
                      : `有效 ${r.rows.length.toLocaleString()} 行 × ${r.headers.length} 列`}
                    {" · "}
                    {fieldTypeSummary(rec)}
                  </div>
                </div>
                {isSel && <Check className="size-4 shrink-0 text-primary" />}
              </div>

              {/* 推荐理由（1–3 条，业务语言） */}
              {rec && topReasons(rec, 3).length > 0 && (
                <ul className="mx-3.5 mt-2 space-y-1 border-t border-border/40 pt-2">
                  {topReasons(rec, 3).map((reason, ri) => (
                    <li key={ri} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                      <span className="mt-1 size-1 shrink-0 rounded-full bg-primary/40" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* 非推荐 Sheet 的风险提示 */}
              {!recommended && (
                <div className="mx-3.5 mb-3 mt-2 flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                  <span>此表不被推荐用于分析（{ROLE_LABELS[role]}）。选择它仅作手动分析，结果可能不准确。</span>
                </div>
              )}
              {!recommended && <div className="h-1" />}
            </button>
          );
        })}
      </div>

      {/* 确认按钮 */}
      <button
        onClick={() => onConfirm(selected)}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/85 px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-md shadow-primary/20 transition-all duration-200 hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98]"
      >
        <Check className="size-4" />
        {selectedRec?.requiresHeaderConfirmation
          ? "选择并确认表头"
          : isAnalyzable(selectedRec)
            ? "分析选中的数据"
            : "仍要选择此表进行分析"}
      </button>
    </div>
  );
}
