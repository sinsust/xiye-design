"use client";

/**
 * 表格分析 —— 分析结果展示
 * 标题 + 洞察卡 + ECharts 图表 + 明细表（分页 20 条）+ 操作栏（导出图片/保存为笔记/提取任务）。
 */

import { useMemo, useState } from "react";
import { Download, Loader2, Save, Wand2 } from "lucide-react";
import { EChart } from "./EChart";
import { DataTable } from "./DataTable";
import { buildChartOption } from "@/lib/table/chart-option";
import type { AnalysisResult } from "@/lib/table/types";

export function AnalysisResultView({
  result,
  headers,
  onSaveNote,
}: {
  result: AnalysisResult;
  headers: string[];
  onSaveNote?: (r: AnalysisResult) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [extracting, setExtracting] = useState<"task" | "strategy" | null>(null);
  const [extractMsg, setExtractMsg] = useState("");

  const { option, chartType } = useMemo(() => buildChartOption(result.execution), [result]);
  const rows = result.execution.rows ?? [];
  const isTable = chartType === "table";

  const exportImage = () => {
    // 由 EChart 的 canvas 导出（table 类型跳过）
    const canvas = document.querySelector<HTMLCanvasElement>(
      '[data-chart-export="true"] canvas',
    );
    if (canvas) {
      const a = document.createElement("a");
      a.download = `${result.title || "分析"}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    }
  };

  const saveNote = async () => {
    setSaving(true);
    try {
      await onSaveNote?.(result);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const extract = async (kind: "task" | "strategy") => {
    setExtracting(kind);
    setExtractMsg("");
    try {
      const endpoint =
        kind === "task"
          ? "/api/brain/tasks/extract-from-analysis"
          : "/api/brain/strategies/extract-from-analysis";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisResult: result }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "提取失败");
      setExtractMsg(kind === "task" ? `已提取 ${data.count ?? 0} 个任务` : `已提炼 ${data.count ?? 0} 条策略`);
      setTimeout(() => setExtractMsg(""), 3000);
    } catch (e) {
      setExtractMsg(`提取失败：${(e as Error).message}`);
      setTimeout(() => setExtractMsg(""), 4000);
    } finally {
      setExtracting(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 px-5 py-4">
      {/* 标题 + 洞察 */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{result.title}</span>
          <span className="rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">{chartType}</span>
        </div>
        {result.interpretation && (
          <div className="mt-2 rounded-xl border border-primary/15 bg-gradient-to-br from-primary/8 to-transparent px-3.5 py-2.5 text-[12px] leading-relaxed text-foreground/90">
            {result.interpretation}
          </div>
        )}
      </div>

      {/* 图表（table 类型直接渲染明细） */}
      {isTable ? (
        <DataTable headers={headers} rows={rows} />
      ) : (
        <div className="rounded-xl border border-border/70 bg-white p-2">
          <div data-chart-export="true">
            <EChart option={option as never} height={300} />
          </div>
          {/* 明细折叠 */}
          <details className="group mt-1 border-t border-border/50">
            <summary className="cursor-pointer select-none py-1.5 text-center text-[11px] text-muted-foreground transition hover:text-foreground">
              数据明细
            </summary>
            <div className="pb-2">
              <DataTable headers={headers} rows={rows} />
            </div>
          </details>
        </div>
      )}

      {/* 操作栏（语义分组：导出 / 联动第二大脑） */}
      <div className="flex flex-wrap items-center justify-between border-t border-border/60 pt-3">
        <div className="text-[11px] text-muted-foreground/70">
          {result.execution.summary}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={exportImage}
            disabled={isTable}
            className="flex items-center gap-1 rounded-lg border border-border/70 px-2.5 py-1.5 text-[11px] text-foreground transition hover:border-primary/40 hover:text-primary disabled:opacity-40"
          >
            <Download className="size-3.5" />
            导出图片
          </button>
          <button
            onClick={saveNote}
            disabled={saving}
            className="flex items-center gap-1 rounded-lg border border-border/70 px-2.5 py-1.5 text-[11px] text-foreground transition hover:border-primary/40 hover:text-primary disabled:opacity-40"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : saved ? "已保存 ✓" : <Save className="size-3.5" />}
            {saved ? "" : "保存为笔记"}
          </button>
          <button
            onClick={() => extract("task")}
            disabled={extracting !== null}
            className="flex items-center gap-1 rounded-lg border border-border/70 px-2.5 py-1.5 text-[11px] text-foreground transition hover:border-primary/40 hover:text-primary disabled:opacity-40"
          >
            {extracting === "task" ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
            提取任务
          </button>
          <button
            onClick={() => extract("strategy")}
            disabled={extracting !== null}
            className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-primary to-primary/85 px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground shadow-sm transition hover:shadow-md active:scale-[0.98] disabled:opacity-40"
          >
            {extracting === "strategy" ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
            提取策略
          </button>
        </div>
      </div>

      {/* 提取反馈 */}
      {extractMsg && (
        <div className="border-t border-border/40 pt-2 text-right text-[11px] text-primary animate-in fade-in">
          {extractMsg}
        </div>
      )}
    </div>
  );
}
