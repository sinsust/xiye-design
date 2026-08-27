"use client";

/**
 * 表格分析 —— 分析方向与计划预览（T2-A 最小前端接入）
 * 不重做 AnalysisRecommender / AnalysisResultView 的视觉：
 *  - 字段确认后展示「可用分析方向」卡片；
 *  - 点击方向 → 展示 AnalysisPlan 预览（系统将这样计算 / 数据范围 / 使用字段 / 过滤与排除 / 输出）；
 *  - 仅允许少量业务口径微调（可选时间 / 分组字段、是否包含退款 / 空值）；
 *  - [开始分析] → 确定性执行 → 结果进入已有 AnalysisResultView，并新增「查看分析口径」。
 */

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, RefreshCw, SlidersHorizontal } from "lucide-react";
import { AnalysisResultView } from "./AnalysisResultView";
import { AnalysisNarrativePanel } from "./AnalysisNarrativePanel";
import { detectRoles } from "@/lib/table/analysis-plan";
import type {
  AnalysisObjective,
  AnalysisPlan,
  ObjectiveMeta,
  PlanOptions,
  PlanExecutionResult,
} from "@/lib/table/analysis-plan";
import type { AnalysisResult, ChartType, TableProfileResult } from "@/lib/table/types";

const CHART_LABEL: Record<ChartType, string> = {
  line: "折线",
  bar: "柱状",
  pie: "饼图",
  scatter: "散点",
  histogram: "直方图",
  boxplot: "箱线",
  heatmap: "热力",
  table: "明细表",
  topn: "排名",
  mom: "趋势(环比)",
  groupbar: "分组对比",
};

const ROLE_LABEL: Record<string, string> = {
  time: "时间",
  geo: "地理",
  category: "分类",
  id: "标识",
  sku: "SKU",
  product: "商品",
  measure: "指标",
  currency: "金额",
  quantity: "数量",
  channel: "渠道",
  customer: "客户",
  email: "邮箱",
  spend: "消耗",
  impressions: "曝光",
  clicks: "点击",
  conversions: "转化",
  revenue: "收入",
  refund_status: "退款",
  status: "状态",
};

export function AnalysisObjectiveFlow({
  tableId,
  sheetName,
  profile,
  headers,
  onBackToFields,
  onUseAI,
}: {
  tableId: string;
  sheetName: string;
  profile: TableProfileResult;
  headers: string[];
  onBackToFields: () => void;
  onUseAI: () => void;
}) {
  const [step, setStep] = useState<"list" | "preview" | "result">("list");
  const [objectives, setObjectives] = useState<ObjectiveMeta[]>([]);
  const [loadingObj, setLoadingObj] = useState(false);
  const [objError, setObjError] = useState("");

  const [selected, setSelected] = useState<ObjectiveMeta | null>(null);
  const [plan, setPlan] = useState<AnalysisPlan | null>(null);
  const [options, setOptions] = useState<PlanOptions>({});
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState("");

  const [history, setHistory] = useState<Array<{ plan: AnalysisPlan; result: PlanExecutionResult }>>([]);
  const [activeVersion, setActiveVersion] = useState(0);
  const [executing, setExecuting] = useState(false);
  const [execError, setExecError] = useState("");
  const [resultTab, setResultTab] = useState(0);
  // T3-A：外部定位请求（[查看依据] → 打开对应图表 + 明细分组）
  const [locate, setLocate] = useState<{ resultId: string; groupKey?: string; nonce: number } | null>(null);

  // 口径微调可选字段（依据已确认画像的角色）
  const timeFields = profile.columns.filter((c) => detectRoles(c.name, c.type).includes("time")).map((c) => c.name);
  const groupFields = profile.columns
    .filter((c) => {
      const r = detectRoles(c.name, c.type);
      return r.includes("geo") || r.includes("category") || r.includes("id") || r.includes("sku") || r.includes("product");
    })
    .map((c) => c.name);
  const hasRefund = profile.columns.some((c) => detectRoles(c.name, c.type).includes("refund_status"));

  /* 加载可用分析方向 */
  const loadObjectives = useCallback(async () => {
    setLoadingObj(true);
    setObjError("");
    try {
      const res = await fetch("/api/brain/table/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_objectives", tableId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "加载分析方向失败");
      setObjectives(data.objectives ?? []);
    } catch (e) {
      setObjError((e as Error).message);
    } finally {
      setLoadingObj(false);
    }
  }, [tableId]);

  // 组件仅在「分析方向」阶段挂载：挂载即拉取可用方向清单
  useEffect(() => {
    // fetch-on-mount：由 loadingObj/objError 守卫，不会引发级联渲染
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadObjectives();
  }, [loadObjectives]);

  /* 生成计划预览 */
  const generatePlan = useCallback(
    async (objective: AnalysisObjective, opts: PlanOptions) => {
      setLoadingPlan(true);
      setPlanError("");
      try {
        const res = await fetch("/api/brain/table/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "generate_plan", tableId, objective, options: opts }),
        });
        const data = await res.json();
        if (!res.ok) {
          const reasons = data?.missingReasons?.join("；") || data?.message || data?.error || "无法生成计划";
          throw new Error(reasons);
        }
        setPlan(data.plan);
      } catch (e) {
        setPlanError((e as Error).message);
      } finally {
        setLoadingPlan(false);
      }
    },
    [tableId],
  );

  const openObjective = (meta: ObjectiveMeta) => {
    setSelected(meta);
    setOptions({});
    setPlan(null);
    setPlanError("");
    setStep("preview");
    void generatePlan(meta.objective, {});
  };

  const onOptionChange = (next: PlanOptions) => {
    setOptions(next);
    if (selected) void generatePlan(selected.objective, next);
  };

  /* 执行计划（结果按 planId 留档历史，不覆盖旧版本） */
  const execute = async () => {
    if (!plan) return;
    setExecuting(true);
    setExecError("");
    try {
      const res = await fetch("/api/brain/table/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "execute_plan", tableId, planId: plan.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.result?.error || data?.message || data?.error || "执行失败");
      const executed = ((data.plans as Array<{ plan: AnalysisPlan; result: PlanExecutionResult | null }>) ?? [])
        .filter((p) => !!p.result)
        .map((p) => ({ plan: p.plan, result: p.result as PlanExecutionResult }));
      setHistory(executed);
      setActiveVersion(Math.max(0, executed.length - 1));
      setResultTab(0);
      setStep("result");
    } catch (e) {
      setExecError((e as Error).message);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="flex flex-col px-5 py-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">分析方向</div>

      {/* 列表 */}
      {step === "list" && (
        <>
          {loadingObj && <div className="py-8 text-center text-xs text-muted-foreground">正在分析可用方向…</div>}
          {objError && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <span className="flex-1 break-all">{objError}</span>
              <button className="text-amber-700 underline" onClick={() => void loadObjectives()}>
                重试
              </button>
            </div>
          )}
          {!loadingObj && objectives.length > 0 && (
            <div className="mt-3 space-y-2">
              {objectives.map((o) => (
                <button
                  key={o.objective}
                  disabled={!o.available}
                  onClick={() => openObjective(o)}
                  className={
                    "block w-full rounded-xl border px-3.5 py-3 text-left transition-all duration-200 " +
                    (o.available
                      ? "border-border/70 bg-white hover:border-primary/25 hover:bg-muted/20"
                      : "cursor-not-allowed border-border/40 bg-muted/30 opacity-70")
                  }
                >
                  <div className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                    {o.available ? <Check className="size-3.5 shrink-0 text-primary" /> : <span className="size-3.5 shrink-0 rounded-full border border-amber-400" />}
                    <span>{o.title}</span>
                    {!o.available && <span className="ml-auto text-[10px] text-amber-600">暂不可用</span>}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{o.description}</div>
                  {o.available ? (
                    <>
                      <div className="mt-1.5 text-[11px] text-foreground/90">能回答：{o.questions.join(" / ")}</div>
                      <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                        <span className="rounded bg-muted px-1.5 py-px">样本 {o.sampleSize}</span>
                        {o.fieldsUsed.slice(0, 6).map((f) => (
                          <span key={f} className="rounded bg-muted px-1.5 py-px">
                            {f}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="mt-1.5 text-[11px] text-amber-700">缺失：{o.missingReasons.join("；")}</div>
                  )}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={onUseAI}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/70 px-3 py-2 text-[11px] text-muted-foreground transition hover:text-primary"
          >
            改用 AI 推荐维度
            <ArrowRight className="size-3" />
          </button>
        </>
      )}

      {/* 计划预览 */}
      {step === "preview" && selected && (
        <div className="mt-3">
          <button onClick={() => setStep("list")} className="mb-2 flex items-center gap-1 text-[11px] text-muted-foreground transition hover:text-primary">
            <ArrowLeft className="size-3" /> 返回方向列表
          </button>

          {loadingPlan && <div className="py-8 text-center text-xs text-muted-foreground">正在生成分析计划…</div>}
          {planError && !loadingPlan && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <span className="flex-1 break-all">{planError}</span>
              <button className="text-amber-700 underline" onClick={() => selected && void generatePlan(selected.objective, options)}>
                重试
              </button>
            </div>
          )}

          {plan && !loadingPlan && (
            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold text-foreground">{plan.title}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{plan.description}</div>
              </div>

              {/* 业务口径微调（仅少量） */}
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="mb-2 flex items-center gap-1 text-[11px] font-medium text-foreground/80">
                  <SlidersHorizontal className="size-3" /> 调整业务口径（可选）
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {timeFields.length > 1 && (
                    <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                      时间字段
                      <select
                        value={options.timeField ?? ""}
                        onChange={(e) => onOptionChange({ ...options, timeField: e.target.value || undefined })}
                        className="rounded-md border border-border/70 bg-white px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary/50"
                      >
                        <option value="">自动（默认检测）</option>
                        {timeFields.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {groupFields.length > 1 && (
                    <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                      分组字段
                      <select
                        value={options.groupField ?? ""}
                        onChange={(e) => onOptionChange({ ...options, groupField: e.target.value || undefined })}
                        className="rounded-md border border-border/70 bg-white px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary/50"
                      >
                        <option value="">自动（默认检测）</option>
                        {groupFields.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {hasRefund && (
                    <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={options.includeRefunded === false ? false : true}
                        onChange={(e) => onOptionChange({ ...options, includeRefunded: e.target.checked })}
                        className="size-3.5 accent-primary"
                      />
                      包含退款订单
                    </label>
                  )}
                  <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={options.includeNulls === false ? false : true}
                      onChange={(e) => onOptionChange({ ...options, includeNulls: e.target.checked })}
                      className="size-3.5 accent-primary"
                    />
                    包含空值行
                  </label>
                </div>
              </div>

              {/* 系统将这样计算 */}
              <Section title="数据范围">
                <div className="text-[11px] text-foreground/90">
                  数据表：{sheetName} · 样本量 <span className="font-medium">{plan.sampleSize}</span> 行 · 表头第 {plan.headerRow + 1} 行
                </div>
              </Section>
              <Section title="使用字段">
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {plan.dimensions.map((d) => (
                    <span key={d.field} className="rounded bg-muted px-1.5 py-px text-foreground/90">
                      {d.displayName}
                      <span className="ml-1 text-muted-foreground/70">{ROLE_LABEL[d.role] ?? ""}</span>
                    </span>
                  ))}
                  {plan.measures.map((m) => (
                    <span key={m.field} className="rounded bg-primary/10 px-1.5 py-px text-primary">
                      {m.displayName}
                      <span className="ml-1 opacity-70">{m.aggregation}</span>
                    </span>
                  ))}
                </div>
              </Section>
              <Section title="过滤与排除">
                {plan.filters.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground">无额外过滤</div>
                ) : (
                  <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-foreground/90">
                    {plan.filters.map((f, i) => (
                      <li key={i}>
                        {f.field} {f.operator === "neq" ? "≠" : f.operator === "eq" ? "=" : f.operator} {String(f.value ?? "")} — {f.reason}
                      </li>
                    ))}
                  </ul>
                )}
                {plan.excludedDataNotes.length > 0 && (
                  <div className="mt-1 text-[10px] text-muted-foreground/80">{plan.excludedDataNotes.join("；")}</div>
                )}
              </Section>
              <Section title="输出内容">
                <ul className="space-y-1">
                  {plan.outputs.map((o) => (
                    <li key={o.id} className="flex items-center gap-2 text-[11px]">
                      <span className="rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">{CHART_LABEL[o.chartType]}</span>
                      <span className="text-foreground/90">{o.label}</span>
                    </li>
                  ))}
                </ul>
              </Section>
              <Section title="计算口径假设">
                <ul className="list-disc space-y-0.5 pl-4 text-[10px] text-muted-foreground/90">
                  {plan.assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </Section>

              {/* 操作 */}
              <div className="sticky bottom-0 -mx-5 mt-2 flex gap-2 border-t border-border/60 bg-white/90 px-5 py-3 backdrop-blur">
                <button
                  onClick={onBackToFields}
                  className="flex items-center gap-1 rounded-lg border border-border/70 px-3 py-2 text-xs text-foreground transition hover:border-primary/40 hover:text-primary"
                >
                  <RefreshCw className="size-3.5" /> 返回调整字段
                </button>
                <button
                  onClick={() => void execute()}
                  disabled={executing}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/85 px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-md shadow-primary/20 transition-all duration-200 hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
                >
                  {executing ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                  开始分析
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 执行结果（复用 AnalysisResultView + T2-B 证据链 / 版本历史 / 口径重算） */}
      {step === "result" && history.length > 0 && (() => {
        const current = history[Math.min(activeVersion, history.length - 1)];
        const displayResult = current.result;
        if (!displayResult) return null;
        return (
          <div className="flex flex-col">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <button onClick={onBackToFields} className="flex items-center gap-1 text-[11px] text-muted-foreground transition hover:text-primary">
                <RefreshCw className="size-3" /> 返回调整字段
              </button>
              {history.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">计算版本</span>
                  <select
                    value={Math.min(activeVersion, history.length - 1)}
                    onChange={(e) => setActiveVersion(Number(e.target.value))}
                    className="rounded-md border border-border/70 bg-white px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary/50"
                  >
                    {history.map((h, i) => (
                      <option key={h.plan.id} value={i}>
                        第 {i + 1} 次 · {h.plan.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {executing && <div className="py-8 text-center text-xs text-muted-foreground">正在执行分析…</div>}
            {execError && !executing && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <span className="flex-1 break-all">{execError}</span>
                <button className="text-amber-700 underline" onClick={() => void execute()}>
                  重试
                </button>
                <button className="text-amber-700 underline" onClick={onBackToFields}>
                  返回调整字段
                </button>
              </div>
            )}

            {!executing && displayResult.status === "executed" && displayResult.results.length > 0 && (
              <>
                {displayResult.results.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1 border-b border-border/40 pb-2">
                    {displayResult.results.map((r: AnalysisResult, i: number) => (
                      <button
                        key={i}
                        onClick={() => setResultTab(i)}
                        className={
                          "rounded-full px-2.5 py-1 text-[11px] transition " +
                          (resultTab === i ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")
                        }
                      >
                        {r.title}
                      </button>
                    ))}
                  </div>
                )}
                {(() => {
                  const r = displayResult.results[Math.min(resultTab, displayResult.results.length - 1)];
                  const dd = displayResult.evidence.drilldowns.find((d) => d.title === r.title);
                  const currentResultId = dd?.resultId ?? "";
                  return (
                    <>
                      <AnalysisResultView
                        result={r}
                        headers={headers}
                        evidence={displayResult.evidence}
                        effectiveRows={displayResult.effectiveRows}
                        groupField={r.dimension.fields[0]}
                        resultId={currentResultId}
                        canAdjustCaliber
                        onAdjustCaliber={() => {
                          setExecError("");
                          setStep("preview");
                        }}
                        locateRequest={locate && locate.resultId === currentResultId ? locate : undefined}
                      />
                      {currentResultId && (
                        <AnalysisNarrativePanel
                          key={currentResultId}
                          tableId={tableId}
                          planId={displayResult.planId}
                          resultId={currentResultId}
                          onLocate={(targetResultId, groupKey) => {
                            const idx = displayResult.evidence.drilldowns.findIndex((d) => d.resultId === targetResultId);
                            setResultTab(idx < 0 ? 0 : idx);
                            setLocate({ resultId: targetResultId, groupKey, nonce: Date.now() });
                          }}
                        />
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium text-foreground/80">{title}</div>
      {children}
    </div>
  );
}
