"use client";

/**
 * 表格分析 —— 分析结果展示
 * 标题 + 洞察卡 + ECharts 图表 + 明细表（分页 20 条）+ 操作栏（导出图片/保存为笔记/提取任务）。
 *
 * T2-B 扩展（可选 evidence 入参，仅确定性计划路径传入）：
 *  - 业务语言证据条：「基于 N 条有效数据 / 使用字段 / 未包含 X」；
 *  - [查看计算口径]：数据范围 / 使用字段(角色+类型) / 过滤规则 / 计算公式 / 质量提示 / 版本溯源；
 *  - [查看明细]：下钻到过滤后有效行，分组图可筛到具体分组，分页展示；
 *  - 数据为空时显示「无法得出结论」明确状态（不渲染空图）；
 *  - [标记异常] 本地状态（不写第二大脑）；[调整口径] 回调返回计划预览。
 * 未传 evidence 时（LLM 推荐路径）行为与之前完全一致。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Flag,
  Info,
  Loader2,
  Save,
  SlidersHorizontal,
  Table2,
  Wand2,
} from "lucide-react";
import { EChart } from "./EChart";
import { DataTable } from "./DataTable";
import { buildChartOption } from "@/lib/table/chart-option";
import type { AnalysisResult } from "@/lib/table/types";
import type { AnalysisEvidence, QualityCaveatLevel } from "@/lib/table/analysis-plan";

const DETAIL_PAGE_SIZE = 20;

const TYPE_LABEL: Record<string, string> = {
  boolean: "是/否",
  date: "日期",
  integer: "整数",
  float: "数值",
  percentage: "百分比",
  currency: "金额",
  category: "分类",
  text: "文本",
  id: "标识",
  email: "邮箱",
  url: "链接",
  phone: "电话",
};

const ROLE_LABEL: Record<string, string> = {
  dimension: "分组",
  measure: "指标",
  filter: "过滤",
  derived: "派生",
};

function caveatStyle(level: QualityCaveatLevel): string {
  return level === "attention"
    ? "border-amber-200 bg-amber-50 text-amber-800"
    : "border-border/70 bg-muted/30 text-muted-foreground";
}

export function AnalysisResultView({
  result,
  headers,
  onSaveNote,
  evidence,
  effectiveRows,
  groupField,
  resultId,
  canAdjustCaliber,
  onAdjustCaliber,
  locateRequest,
}: {
  result: AnalysisResult;
  headers: string[];
  onSaveNote?: (r: AnalysisResult) => void;
  /** T2-B：证据链（可选；未传则按原逻辑渲染） */
  evidence?: AnalysisEvidence;
  /** T2-B：过滤后的有效行（下钻明细） */
  effectiveRows?: unknown[][];
  /** T2-B：该结果的分组维度字段（用于明细下钻到具体分组） */
  groupField?: string;
  /** T2-B：该结果在 plan.outputs 中的 id（定位 drilldowns） */
  resultId?: string;
  /** T2-B：允许调整业务口径（返回计划预览重算） */
  canAdjustCaliber?: boolean;
  onAdjustCaliber?: () => void;
  /** T3-A：外部定位请求（[查看依据] 跳转）——nonce 变化时打开明细并筛到指定分组 */
  locateRequest?: { groupKey?: string; nonce: number };
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [extracting, setExtracting] = useState<"task" | "strategy" | null>(null);
  const [extractMsg, setExtractMsg] = useState("");
  // T2-B 状态
  const [showCaliber, setShowCaliber] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [detailGroup, setDetailGroup] = useState("");
  const [detailPage, setDetailPage] = useState(0);
  const [flagged, setFlagged] = useState(false);
  const detailRef = useRef<HTMLDivElement | null>(null);

  // T3-A：响应外部定位请求（[查看依据]）——非派生型指令式跳转，直接同步状态
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!locateRequest || locateRequest.nonce <= 0) return;
    setShowDetail(true);
    setDetailGroup(locateRequest.groupKey ?? "");
    setDetailPage(0);
    /* eslint-enable react-hooks/set-state-in-effect */
    detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locateRequest?.nonce]);

  const { option, chartType } = useMemo(() => buildChartOption(result.execution), [result]);
  const rows = result.execution.rows ?? [];
  const isTable = chartType === "table";

  // 无有效数据点 → 「无法得出结论」状态（仅证据路径提示，避免空图误导）
  const noData = useMemo(
    () => Array.isArray(result.execution.data) && (result.execution.data as unknown[]).length === 0,
    [result],
  );
  const showNoData = noData && !!evidence;

  // 该结果对应的下钻条目
  const drill = evidence?.drilldowns.find((d) => d.resultId === resultId);
  const drillAvailable = drill?.available ?? false;

  // 分组图（bar/pie/topn 等 {name,value}[]）的类别值，供明细下钻筛选
  const categoryValues = useMemo(() => {
    if (!Array.isArray(result.execution.data)) return [] as string[];
    return (result.execution.data as unknown[])
      .filter(
        (d): d is { name: string; value: unknown } =>
          !!d &&
          typeof (d as { name?: unknown }).name === "string" &&
          "value" in (d as object),
      )
      .map((d) => d.name);
  }, [result]);

  const hasGroupFilter = categoryValues.length > 0 && !!groupField;

  const allDetail = effectiveRows ?? rows;
  const filteredDetail = useMemo(() => {
    if (!hasGroupFilter || !detailGroup || !groupField) return allDetail;
    const gi = headers.indexOf(groupField);
    if (gi < 0) return allDetail;
    return allDetail.filter((r) => String(r[gi]) === detailGroup);
  }, [allDetail, hasGroupFilter, detailGroup, groupField, headers]);

  const totalDetail = filteredDetail.length;
  const pageCount = Math.max(1, Math.ceil(totalDetail / DETAIL_PAGE_SIZE));
  const safePage = Math.min(detailPage, pageCount - 1);
  const pageRows = filteredDetail.slice(safePage * DETAIL_PAGE_SIZE, (safePage + 1) * DETAIL_PAGE_SIZE);

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

      {/* T2-B 证据条（业务语言，不暴露内部标识） */}
      {evidence && (
        <div className="rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-foreground/90">
            <span className="font-medium text-foreground">
              基于 {evidence.actualSampleSize} 条有效数据
            </span>
            <span className="text-muted-foreground/50">·</span>
            <span>
              使用字段：
              {evidence.usedFields
                .filter((f) => f.role !== "filter")
                .map((f) => f.displayName)
                .slice(0, 6)
                .join("、")}
              {evidence.usedFields.length > 6 ? " 等" : ""}
            </span>
            {evidence.appliedFilters.length > 0 && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span className="text-amber-700">
                  未包含：{evidence.appliedFilters.map((f) => `${f.label}${f.affectedRows ? ` ${f.affectedRows} 条` : ""}`).join("；")}
                </span>
              </>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setShowCaliber((v) => !v)}
              className="flex items-center gap-1 rounded-md border border-border/60 bg-white px-2 py-1 text-[10px] text-muted-foreground transition hover:border-primary/40 hover:text-primary"
            >
              <Info className="size-3" />
              {showCaliber ? "收起计算口径" : "查看计算口径"}
            </button>
            <button
              onClick={() => setShowDetail((v) => !v)}
              disabled={!drillAvailable}
              className="flex items-center gap-1 rounded-md border border-border/60 bg-white px-2 py-1 text-[10px] text-muted-foreground transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Table2 className="size-3" />
              {showDetail ? "收起明细" : `查看明细${drillAvailable ? `（${drill?.rowCount ?? 0} 行）` : ""}`}
            </button>
            <button
              onClick={() => setFlagged((v) => !v)}
              className={
                "flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] transition " +
                (flagged
                  ? "border-amber-300 bg-amber-50 text-amber-700"
                  : "border-border/60 bg-white text-muted-foreground hover:border-amber-300 hover:text-amber-600")
              }
            >
              <Flag className={"size-3" + (flagged ? " fill-amber-400 text-amber-500" : "")} />
              {flagged ? "已标记异常" : "标记异常"}
            </button>
            {canAdjustCaliber && onAdjustCaliber && (
              <button
                onClick={onAdjustCaliber}
                className="flex items-center gap-1 rounded-md border border-border/60 bg-white px-2 py-1 text-[10px] text-muted-foreground transition hover:border-primary/40 hover:text-primary"
              >
                <SlidersHorizontal className="size-3" />
                调整口径
              </button>
            )}
          </div>
        </div>
      )}

      {/* 标记异常提示 */}
      {flagged && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          已标记为异常，请结合「查看计算口径」复查数据范围与过滤规则后再下结论。
        </div>
      )}

      {/* 图表 / 明细（数据为空时显示「无法得出结论」，不渲染空图） */}
      {showNoData ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-6 text-center">
          <div className="text-[13px] font-medium text-amber-800">无法得出结论</div>
          <div className="mx-auto mt-1 max-w-md text-[11px] leading-relaxed text-amber-700">
            {evidence!.qualityCaveats.filter((c) => c.level === "attention").map((c) => c.message).join("；") ||
              "该输出没有可用于计算的有效数据（字段可能为空或全部被过滤）。"}
          </div>
        </div>
      ) : isTable ? (
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

      {/* T2-B 计算口径面板 */}
      {evidence && showCaliber && (
        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-3.5 text-[11px]">
          <div className="text-xs font-semibold text-foreground">计算口径</div>

          <div>
            <div className="mb-1 font-medium text-foreground/80">数据范围</div>
            <div className="text-muted-foreground">
              有效数据 {evidence.actualSampleSize} 条
              {evidence.excludedRowCount > 0 && <>；过滤排除 {evidence.excludedRowCount} 行</>}
              {evidence.excludedColumnCount > 0 && <>；未使用 {evidence.excludedColumnCount} 个字段</>}
              {" · "}数据版本 v{evidence.confirmationVersion}
            </div>
          </div>

          <div>
            <div className="mb-1 font-medium text-foreground/80">使用字段</div>
            <div className="flex flex-wrap gap-1.5">
              {evidence.usedFields.map((f) => (
                <span key={f.columnId} className="rounded bg-white px-1.5 py-px text-foreground/90">
                  {f.displayName}
                  <span className="ml-1 text-muted-foreground/70">
                    {ROLE_LABEL[f.role] ?? ""} · {TYPE_LABEL[f.type] ?? f.type}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {evidence.appliedFilters.length > 0 && (
            <div>
              <div className="mb-1 font-medium text-foreground/80">过滤与排除</div>
              <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                {evidence.appliedFilters.map((f, i) => (
                  <li key={i}>
                    {f.label}
                    {f.affectedRows ? `（影响 ${f.affectedRows} 行）` : "（未排除任何行）"}
                    {f.reason && <span className="text-foreground/60"> — {f.reason}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {evidence.calculation.formulas.length > 0 && (
            <div>
              <div className="mb-1 font-medium text-foreground/80">计算公式</div>
              <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                {evidence.calculation.formulas.map((f, i) => (
                  <li key={i}>
                    <span className="text-foreground/90">{f.label}</span>
                    <code className="ml-1.5 rounded bg-white px-1 py-px text-[10px] text-primary">{f.expression}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {evidence.qualityCaveats.length > 0 && (
            <div>
              <div className="mb-1 font-medium text-foreground/80">质量提示</div>
              <ul className="space-y-1">
                {evidence.qualityCaveats.map((c, i) => (
                  <li key={i} className={"rounded-lg border px-2.5 py-1.5 " + caveatStyle(c.level)}>
                    {c.level === "attention" ? "⚠ " : "ℹ "}
                    {c.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* T2-B 明细下钻面板 */}
      {evidence && showDetail && (
        <div ref={detailRef} className="scroll-mt-4 space-y-2.5 rounded-xl border border-border/60 bg-muted/10 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold text-foreground">
              明细{drillAvailable ? `（${totalDetail} 行）` : "（无下钻数据）"}
            </div>
            {hasGroupFilter && (
              <select
                value={detailGroup}
                onChange={(e) => {
                  setDetailGroup(e.target.value);
                  setDetailPage(0);
                }}
                className="rounded-md border border-border/70 bg-white px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary/50"
              >
                <option value="">全部{groupField ? `（按${groupField}）` : ""}</option>
                {categoryValues.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            )}
          </div>

          {!drillAvailable ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
              该输出无有效数据行，无法展开明细。
            </div>
          ) : (
            <>
              <DataTable headers={headers} rows={pageRows} />
              {totalDetail > DETAIL_PAGE_SIZE && (
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <button
                    onClick={() => setDetailPage(Math.max(0, safePage - 1))}
                    disabled={safePage === 0}
                    className="flex items-center gap-0.5 rounded-md border border-border/60 bg-white px-2 py-1 transition hover:text-primary disabled:opacity-40"
                  >
                    <ChevronLeft className="size-3" /> 上一页
                  </button>
                  <span>
                    第 {safePage + 1} / {pageCount} 页 · 共 {totalDetail} 条
                  </span>
                  <button
                    onClick={() => setDetailPage(Math.min(pageCount - 1, safePage + 1))}
                    disabled={safePage >= pageCount - 1}
                    className="flex items-center gap-0.5 rounded-md border border-border/60 bg-white px-2 py-1 transition hover:text-primary disabled:opacity-40"
                  >
                    下一页 <ChevronRight className="size-3" />
                  </button>
                </div>
              )}
            </>
          )}
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
