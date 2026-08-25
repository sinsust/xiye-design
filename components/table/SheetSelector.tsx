"use client";

/**
 * 表格分析 —— 解析结果概览 / Sheet 选择
 * 展示各 Sheet（或合并组）概览，用户点选要分析的对象。
 * 结构相同的组已由后端自动合并并标注"可合并"徽标；编码等细节默认折叠。
 */

import { useMemo, useState } from "react";
import { Check, ChevronDown, FileSpreadsheet, Layers, Table2 } from "lucide-react";
import type { UploadResult } from "./TableUploader";

export function SheetSelector({
  data,
  onConfirm,
}: {
  data: UploadResult;
  onConfirm: (index: number) => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const [selected, setSelected] = useState(0);

  const totalRows = useMemo(
    () => data.parsedInfo.sheets.reduce((a, s) => a + s.rowCount, 0),
    [data],
  );

  // 每个可分析对象：合并组或独立 sheet
  const groups = data.results.map((r, i) => ({
    index: i,
    name: r.sheetName,
    rows: r.rows.length,
    cols: r.headers.length,
    merged: r.sheetName.includes("合并"),
  }));

  return (
    <div className="flex flex-col px-6 py-6">
      {/* 文件概要（一行） */}
      <div className="flex items-center gap-2 text-sm text-foreground">
        <FileSpreadsheet className="size-4 text-primary" />
        <span className="font-semibold">{data.parsedInfo.fileName}</span>
        <span className="text-muted-foreground">
          · {data.parsedInfo.sheets.length} 个 Sheet · 共 {totalRows.toLocaleString()} 行
        </span>
        <button
          onClick={() => setShowDetail(!showDetail)}
          className="ml-auto flex items-center gap-0.5 text-xs text-muted-foreground transition hover:text-foreground"
        >
          详情
          <ChevronDown className={"size-3 transition-transform " + (showDetail ? "rotate-180" : "")} />
        </button>
      </div>

      {/* 技术细节（折叠） */}
      {showDetail && (
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground animate-in fade-in">
          <div>编码：{data.parsedInfo.encoding || "自动检测"}</div>
          <div>
            结构：{data.structure.sameStructureGroups.length} 组可合并 /{" "}
            {data.structure.differentSheets.length} 个独立
          </div>
        </div>
      )}

      {/* 可分析对象列表 */}
      <div className="mt-5 space-y-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">选择分析对象</div>
        {groups.map((g) => (
          <button
            key={g.index}
            onClick={() => setSelected(g.index)}
            className={
              "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all duration-200 " +
              (selected === g.index
                ? "border-primary/50 bg-primary/5 shadow-sm"
                : "border-border/70 bg-white hover:border-primary/30 hover:bg-muted/40")
            }
          >
            <div
              className={
                "flex size-9 shrink-0 items-center justify-center rounded-lg " +
                (selected === g.index ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")
              }
            >
              {g.merged ? <Layers className="size-4" /> : <Table2 className="size-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-foreground">{g.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {g.rows.toLocaleString()} 行 × {g.cols} 列
              </div>
            </div>
            {g.merged ? (
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                已合并 {data.structure.sameStructureGroups.reduce((a, grp) => a + grp.length, 0)} 个 Sheet
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                独立
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 确认 */}
      <button
        onClick={() => onConfirm(selected)}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/85 px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-md shadow-primary/20 transition-all duration-200 hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98]"
      >
        <Check className="size-4" />
        分析这个数据
      </button>
    </div>
  );
}
