"use client";

/**
 * 数据引擎 —— 表头确认面板（T1-D2）
 *
 * 仅在以下情况出现：
 *  - recommendation.requiresHeaderConfirmation = true（表头非首行 / 低置信 / 多候选）
 *  - 用户手动选择了非推荐 Sheet
 *
 * 交互：
 *  - 展示系统建议的表头行（业务语言「第 N 行」）+ 推荐理由；
 *  - 提供可选表头行候选，点击切换即可静态预览「以该行作表头时长什么样」；
 *  - 预览前 10 行 × 前 8 列；说明系统将排除的说明/空行、无表头列数量；
 *  - 主按钮文案明确「确认第 N 行作为表头」；确认后由父组件重新生成该 Sheet 的画像。
 */

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Loader2, Table2 } from "lucide-react";
import type { HeaderCandidate, SheetRecommendation } from "@/lib/table/types";

export function HeaderConfirmationPanel({
  sheetName,
  recommendation,
  candidates,
  onConfirm,
  onBack,
  loading = false,
  error,
}: {
  sheetName: string;
  recommendation: SheetRecommendation;
  candidates: HeaderCandidate[];
  onConfirm: (rowIndex: number) => void;
  onBack: () => void;
  loading?: boolean;
  error?: string;
}) {
  // 默认选中：推荐的最佳候选行（与 detectedHeaderRow 同坐标系）
  const defaultRow =
    candidates.find((c) => c.rowIndex === recommendation.header.bestCandidateRow)?.rowIndex ??
    candidates[0]?.rowIndex ??
    0;
  const [selectedRow, setSelectedRow] = useState(defaultRow);

  const selected = useMemo(
    () => candidates.find((c) => c.rowIndex === selectedRow) ?? candidates[0],
    [candidates, selectedRow],
  );

  const suggestedRow = recommendation.header.bestCandidateRow;
  const titleRowsAbove = Math.max(0, recommendation.header.detectedHeaderRow);
  const excludedRows = recommendation.metrics.excludedRowCount;
  const excludedCols = recommendation.metrics.excludedColumnCount;

  return (
    <div className="flex flex-col px-6 py-6">
      {/* 标题 */}
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Table2 className="size-4 text-primary" />
        确认「{sheetName}」的表头位置
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        表头决定了每一列的含义与后续字段画像。请确认哪一行是真正的表头。
      </p>

      {/* 系统建议 */}
      <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs">
        <div className="font-medium text-foreground">
          系统建议：表头在第 {suggestedRow + 1} 行
        </div>
        <div className="mt-1 text-muted-foreground">
          {titleRowsAbove > 0
            ? `其上有 ${titleRowsAbove} 行为说明/标题内容，识别为数据前的非表头行。`
            : "系统认为首行即为表头。"}
          你也可在下方直接选择其他行。
        </div>
      </div>

      {/* 候选表头行 */}
      <div className="mt-4">
        <div className="text-[11px] font-medium text-muted-foreground">可选表头行（点击切换预览）</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {candidates.map((c) => {
            const active = c.rowIndex === selectedRow;
            return (
              <button
                key={c.rowIndex}
                onClick={() => setSelectedRow(c.rowIndex)}
                className={
                  "rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition " +
                  (active
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border/70 bg-white text-muted-foreground hover:border-primary/30")
                }
              >
                <div className="font-medium">第 {c.rowIndex + 1} 行</div>
                <div className="mt-0.5 max-w-[160px] truncate text-[10px] text-muted-foreground/70">
                  {c.headerNames.slice(0, 3).join("、") || "（空）"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 预览：所选候选行的列名 + 数据预览 */}
      {selected && (
        <div className="mt-4">
          <div className="text-[11px] font-medium text-muted-foreground">
            预览：以第 {selected.rowIndex + 1} 行作为表头
          </div>
          <div className="mt-2 overflow-hidden rounded-lg border border-border/50">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[10px]">
                <thead>
                  <tr className="bg-muted/60 text-muted-foreground">
                    {selected.headerNames.slice(0, 8).map((h, i) => (
                      <th key={i} className="whitespace-nowrap border-b border-border/40 px-2 py-1 font-medium">
                        {h === "" ? "（空）" : h}
                      </th>
                    ))}
                    {selected.headerNames.length > 8 && (
                      <th className="whitespace-nowrap border-b border-border/40 px-2 py-1 text-muted-foreground/60">
                        +{selected.headerNames.length - 8} 列
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {selected.sampleRows.slice(0, 10).map((row, ri) => (
                    <tr key={ri} className="border-b border-border/30 last:border-0">
                      {selected.headerNames.slice(0, 8).map((_, ci) => (
                        <td key={ci} className="max-w-32 truncate whitespace-nowrap px-2 py-1 text-foreground/80">
                          {row[ci] == null || row[ci] === "" ? "—" : String(row[ci])}
                        </td>
                      ))}
                      {selected.headerNames.length > 8 && (
                        <td className="whitespace-nowrap px-2 py-1 text-muted-foreground/40">…</td>
                      )}
                    </tr>
                  ))}
                  {selected.sampleRows.length === 0 && (
                    <tr>
                      <td className="px-2 py-2 text-muted-foreground/60" colSpan={Math.min(8, selected.headerNames.length) || 1}>
                        该行之后没有可预览的数据行
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground/60">
            预览前 {Math.min(10, selected.sampleRows.length)} 行 · 全部 {selected.headerNames.length} 列
          </div>
        </div>
      )}

      {/* 排除说明 */}
      {(excludedRows > 0 || excludedCols > 0) && (
        <div className="mt-3 flex items-start gap-1.5 rounded-md bg-zinc-50 px-2.5 py-2 text-[11px] text-zinc-600">
          <AlertTriangle className="mt-0.5 size-3 shrink-0" />
          <span>
            确认后，系统将排除 {excludedRows} 个说明/空行、{excludedCols} 个无表头列，仅保留有效数据用于分析。
          </span>
        </div>
      )}

      {/* 错误横幅 */}
      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span className="break-all">{error}</span>
        </div>
      )}

      {/* 操作 */}
      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={() => onConfirm(selectedRow)}
          disabled={loading || !selected}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/85 px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-md shadow-primary/20 transition-all duration-200 hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          确认第 {selected ? selected.rowIndex + 1 : "?" } 行作为表头
        </button>
        <button
          onClick={onBack}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-border/70 px-3 py-2.5 text-sm text-muted-foreground transition hover:text-foreground disabled:opacity-50"
        >
          <ArrowLeft className="size-3.5" />
          返回 Sheet 选择
        </button>
      </div>
    </div>
  );
}
