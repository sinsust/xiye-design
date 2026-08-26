"use client";

/**
 * 表格分析 —— 页面容器（全流程）
 * 状态机：upload → sheetSelect → profile（画像面板）→ recommend（AI 建议）→ result（结果展示）
 * 串联：TableUploader → SheetSelector → ColumnProfilePanel → AnalysisRecommender → AnalysisResultView
 */

import { useState } from "react";
import { ArrowLeft, ArrowRight, Download, Loader2, Sparkles } from "lucide-react";
import { TableUploader, type UploadResult } from "./TableUploader";
import { SheetSelector } from "./SheetSelector";
import { ColumnProfilePanel } from "./ColumnProfilePanel";
import { AnalysisRecommender } from "./AnalysisRecommender";
import { AnalysisResultView } from "./AnalysisResultView";
import { LLMRouteBadge, readForceRoute, writeLLMRoute } from "@/components/LLMRouteBadge";
import type { AnalysisDimension, AnalysisResult } from "@/lib/table/types";

type Phase = "upload" | "sheetSelect" | "profile" | "recommend" | "result";

const STEPS = ["上传", "选择数据", "字段画像", "分析建议", "分析结果"] as const;
const PHASES: Phase[] = ["upload", "sheetSelect", "profile", "recommend", "result"];

export function TableAnalysisPage() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [uploadData, setUploadData] = useState<UploadResult | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [resultTab, setResultTab] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const active = uploadData?.results[activeIndex];

  const runAnalysis = async (dimensions: AnalysisDimension[], userQuery: string) => {
    if (!uploadData || !active) return;
    setAnalyzing(true);
    setError("");
    try {
      const res = await fetch("/api/brain/table/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: active.profile,
          tableId: active.tableId,
          forceRoute: readForceRoute(),
          ...(userQuery ? { userQuery } : { selectedDimensions: dimensions }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "分析失败");
      setResults(data.results ?? []);
      if (data.route === "qwen" || data.route === "deepseek") writeLLMRoute(data.route);
      setPhase("result");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  };

  const exportXlsx = async () => {
    if (!active) return;
    setExporting(true);
    setError("");
    try {
      const res = await fetch("/api/brain/table/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: active.tableId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "导出失败");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${active.headers?.[0] || "表格"}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const saveNote = async (r: AnalysisResult) => {
    // 复用第二大脑笔记链路
    const content = `## ${r.title}\n\n${r.interpretation || ""}\n\n> 计算摘要：${r.execution.summary}`;
    const res = await fetch("/api/brain/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: r.title,
        content,
        category: "数据分析",
        tags: ["数据分析"],
        source: "table_analysis",
        summary: r.interpretation.slice(0, 60),
      }),
    });
    if (!res.ok) throw new Error("保存失败");
  };

  return (
    <div className="flex min-h-[480px] flex-col rounded-xl border border-border bg-white shadow-sm">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="size-4 text-primary" />
          表格分析
        </div>
        <div className="flex items-center gap-3">
          <LLMRouteBadge />
          {phase !== "upload" && (
            <button
              onClick={() => {
                setPhase("upload");
                setUploadData(null);
                setResults([]);
                setError("");
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              重新上传
            </button>
          )}
        </div>
      </div>

      {/* 步骤指示（克制：当前态 + 已完成态） */}
      <div className="flex items-center gap-1.5 border-b border-border/40 px-5 py-2 text-[11px] text-muted-foreground">
        {STEPS.map((s, i) => {
          const activeStep = PHASES.indexOf(phase);
          const done = activeStep > i;
          return (
            <div key={s} className="flex items-center gap-1.5">
              <span
                className={
                  "flex size-4 items-center justify-center rounded-full text-[9px] font-semibold " +
                  (i === activeStep
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground/60")
                }
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={i === activeStep ? "font-medium text-foreground" : ""}>{s}</span>
              {i < STEPS.length - 1 && <span className="mx-0.5 text-muted-foreground/40">·</span>}
            </div>
          );
        })}
      </div>

      {/* 错误横幅 */}
      {error && (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-800">{error}</div>
      )}
      {uploadData?.truncated && uploadData.truncated.length > 0 && (
        <div className="border-b border-sky-100 bg-sky-50 px-5 py-2 text-xs text-sky-700">
          {uploadData.truncated.join("；")}
        </div>
      )}

      {/* 阶段内容 */}
      <div className="flex-1">
        {phase === "upload" && (
          <TableUploader
            onUploaded={(data) => {
              setUploadData(data);
              setActiveIndex(0);
              setPhase("sheetSelect");
            }}
            onError={(msg) => setError(msg)}
          />
        )}

        {phase === "sheetSelect" && uploadData && (
          <SheetSelector
            data={uploadData}
            onConfirm={(index) => {
              setActiveIndex(index);
              setSelectedField(null);
              setPhase("profile");
            }}
          />
        )}

        {phase === "profile" && active && (
          <>
            <ColumnProfilePanel
              profile={active.profile as Parameters<typeof ColumnProfilePanel>[0]["profile"]}
              onSelect={setSelectedField}
              selected={selectedField}
            />
            {/* 下一步 CTA：让 AI 推荐分析维度 */}
            <div className="sticky bottom-0 -mx-5 mt-4 border-t border-border/60 bg-white/90 px-5 py-3 backdrop-blur">
              <button
                onClick={() => {
                  setSelectedField(null);
                  setPhase("recommend");
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/85 px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-md shadow-primary/20 transition-all duration-200 hover:shadow-lg active:scale-[0.98]"
              >
                <Sparkles className="size-4" />
                让 AI 推荐分析维度
                <ArrowRight className="size-4" />
              </button>
            </div>
          </>
        )}

        {phase === "recommend" && active && (
          <>
            <div className="flex items-center gap-1.5 px-5 pt-3 text-[11px] text-muted-foreground">
              <button
                onClick={() => setPhase("profile")}
                className="flex items-center gap-1 transition hover:text-primary"
              >
                <ArrowLeft className="size-3" />
                返回字段画像
              </button>
            </div>
            <AnalysisRecommender
              profile={active.profile as Parameters<typeof AnalysisRecommender>[0]["profile"]}
              tableId={active.tableId}
              onRun={(dims, q) => {
                if (analyzing) return;
                void runAnalysis(dims, q);
              }}
            />
          </>
        )}

        {phase === "result" && (
          <div className="flex flex-col">
            {analyzing && (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
                正在执行分析…
              </div>
            )}
            {!analyzing && results.length > 0 && (
              <div className="flex items-center justify-end border-b border-border/40 px-5 py-2">
                <button
                  onClick={exportXlsx}
                  disabled={exporting || !active}
                  className="flex items-center gap-1.5 rounded-lg border border-border/70 px-2.5 py-1.5 text-[11px] text-foreground transition hover:border-primary/40 hover:text-primary disabled:opacity-40"
                >
                  {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                  {exporting ? "导出中…" : "导出 xlsx"}
                </button>
              </div>
            )}
            {results.length > 1 && !analyzing && (
              <div className="flex flex-wrap items-center gap-1 border-b border-border/40 px-5 py-2">
                {results.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => setResultTab(i)}
                    className={
                      "rounded-full px-2.5 py-1 text-[11px] transition " +
                      (resultTab === i
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground")
                    }
                  >
                    {r.title}
                  </button>
                ))}
              </div>
            )}
            {!analyzing && results.length > 0 && (
              <div className={results.length > 1 ? "" : ""}>
                <AnalysisResultView
                  result={results[Math.min(resultTab, results.length - 1)]}
                  headers={active?.headers ?? []}
                  onSaveNote={async (rr) => {
                    try {
                      await saveNote(rr);
                      return;
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                />
              </div>
            )}
            {results.length > 0 && (
              <div className="border-t border-border/50 px-5 py-3">
                <button
                  onClick={() => setPhase("recommend")}
                  className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-primary"
                >
                  <ArrowLeft className="size-3.5" />
                  返回分析建议
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
