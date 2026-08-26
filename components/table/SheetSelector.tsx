"use client";

/**
 * 表格分析 —— 解析结果概览 / 选择分析对象
 *
 * 设计原则（用户反馈"看不懂怎么选"后的改造）：
 * - 每个对象不是"行数×列数"的技术参数，而是带【真实表头 + 样本行】的内容预览，
 *   用户一眼能看出"这是我要的数据"。
 * - 用大白话解释每个选项：合并组说明"已自动合并哪些 Sheet、带来源Sheet 列"；
 *   独立表说明"只分析这一个 Sheet"。
 * - 推荐引导：多 Sheet 场景合并组置顶并标「推荐」；单对象自动选中，用户只需确认。
 */

import { useMemo, useState } from "react";
import { Check, FileSpreadsheet, Layers, Sparkles, Table2 } from "lucide-react";
import type { UploadResult } from "./TableUploader";

export function SheetSelector({
  data,
  onConfirm,
}: {
  data: UploadResult;
  onConfirm: (index: number) => void;
}) {
  const [selected, setSelected] = useState(0);

  const totalRows = useMemo(
    () => data.parsedInfo.sheets.reduce((a, s) => a + s.rowCount, 0),
    [data],
  );

  // 每个可分析对象：合并组 / 独立 sheet（results 顺序即展示顺序）
  const groups = data.results.map((r, i) => {
    const merged = r.sheetName.includes("合并");
    // 合并组成员名（structure.sameStructureGroups 与 results 顺序对齐）
    const members: string[] = [];
    if (merged) {
      const flat = data.structure.sameStructureGroups.flat();
      const used = new Set<string>();
      for (const s of data.parsedInfo.sheets) {
        if (flat.includes(s.name) && !used.has(s.name)) {
          used.add(s.name);
          members.push(s.name);
        }
      }
    }
    return {
      index: i,
      name: merged ? (members.length > 1 ? `${members.join(" + ")}` : r.sheetName) : r.sheetName,
      members,
      rows: r.rows.length,
      fullRows: merged ? members.length : r.rows.length,
      cols: r.headers.length,
      merged,
      headers: r.headers,
      sample: r.rows.slice(0, 2),
    };
  });

  const recommended = groups.length > 1 ? groups.find((g) => g.merged)?.index ?? 0 : 0;

  return (
    <div className="flex flex-col px-6 py-6">
      {/* 文件概要（一行） */}
      <div className="flex items-center gap-2 text-sm text-foreground">
        <FileSpreadsheet className="size-4 text-primary" />
        <span className="font-semibold">{data.parsedInfo.fileName}</span>
        <span className="text-muted-foreground">
          · {data.parsedInfo.sheets.length} 个 Sheet · 共 {totalRows.toLocaleString()} 行
        </span>
      </div>

      {/* 引导说明 */}
      <div className="mt-4 text-xs text-muted-foreground">
        {groups.length > 1
          ? "结构相同的 Sheet 已自动合并，选一个作为分析对象即可："
          : "解析完成，确认下面的数据后即可开始分析："}
      </div>

      {/* 分析对象卡片（带真实预览） */}
      <div className="mt-3 space-y-3">
        {groups.map((g) => {
          const isSel = selected === g.index;
          return (
            <button
              key={g.index}
              onClick={() => setSelected(g.index)}
              className={
                "w-full rounded-xl border text-left transition-all duration-200 " +
                (isSel
                  ? "border-primary/50 bg-primary/5 shadow-sm"
                  : "border-border/70 bg-white hover:border-primary/30 hover:bg-muted/30")
              }
            >
              {/* 卡片头：图标 + 名称 + 行数 + 徽标 */}
              <div className="flex items-center gap-3 px-3.5 pt-3">
                <div
                  className={
                    "flex size-9 shrink-0 items-center justify-center rounded-lg " +
                    (isSel ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")
                  }
                >
                  {g.merged ? <Layers className="size-4" /> : <Table2 className="size-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-foreground">{g.name}</span>
                    {g.index === recommended && groups.length > 1 && (
                      <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-medium text-primary">
                        <Sparkles className="size-2.5" /> 推荐
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {g.merged
                      ? `已自动合并 ${g.members.length} 个结构相同的 Sheet（共 ${g.rows.toLocaleString()} 行），带「来源Sheet」列区分`
                      : `独立数据 · ${g.rows.toLocaleString()} 行 × ${g.cols} 列`}
                  </div>
                </div>
                {isSel && <Check className="size-4 shrink-0 text-primary" />}
              </div>

              {/* 真实内容预览：表头（前 5 列）+ 前 2 行样本 */}
              {g.headers.length > 0 && (
                <div className="px-3.5 pb-3 pt-2">
                  <div className="overflow-hidden rounded-lg border border-border/50">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-[10px]">
                        <thead>
                          <tr className="bg-muted/60 text-muted-foreground">
                            {g.headers.slice(0, 5).map((h, i) => (
                              <th key={i} className="whitespace-nowrap border-b border-border/40 px-2 py-1 font-medium">
                                {h}
                              </th>
                            ))}
                            {g.headers.length > 5 && (
                              <th className="whitespace-nowrap border-b border-border/40 px-2 py-1 text-muted-foreground/60">
                                +{g.headers.length - 5} 列
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {g.sample.map((row, ri) => (
                            <tr key={ri} className="border-b border-border/30 last:border-0">
                              {g.headers.slice(0, 5).map((_, ci) => (
                                <td key={ci} className="max-w-32 truncate whitespace-nowrap px-2 py-1 text-foreground/80">
                                  {row[ci] == null || row[ci] === "" ? "—" : String(row[ci])}
                                </td>
                              ))}
                              {g.headers.length > 5 && (
                                <td className="whitespace-nowrap px-2 py-1 text-muted-foreground/40">…</td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground/60">
                    预览前 {g.sample.length} 行 · 全部 {g.rows.toLocaleString()} 行
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 确认 */}
      <button
        onClick={() => onConfirm(selected)}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/85 px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-md shadow-primary/20 transition-all duration-200 hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98]"
      >
        <Check className="size-4" />
        分析选中的数据
      </button>
    </div>
  );
}
