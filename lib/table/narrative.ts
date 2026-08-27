/**
 * 表格分析 —— T3-A LLM 受控叙述与行动建议
 *
 * 架构：
 *   确定性事实层（AnalysisPlan + Result + Evidence）
 *       ↓ buildNarrativeContext：受控上下文打包（仅聚合结果 / 摘要 / 过滤 / 质量提示，绝不含原始行）
 *    LLM 解释层（只解释，不计算）
 *       ↓ parseAndValidateNarrative：结构校验 + 证据引用校验 + 数据不足强制注入
 *    AnalysisNarrative（fact / inference / recommendation / insufficient_data 分层，每条回链证据）
 *
 * 铁律（T3-A）：
 *  - LLM 不读原始全量数据、不选字段、不改公式 / 数值；本模块只把「必要的聚合结果」打包给它。
 *  - fact 必须可回链到确定性结果（resultId / groupKey 存在），否则降级为 inference。
 *  - 数据不足（attention 质量提示）时强制注入 insufficient_data finding，不得编造解释。
 *  - 本模块为纯函数（无 LLM 调用、无网络）；LLM 调用在 API 路由层完成。
 */

import { randomUUID } from "crypto";
import type { AnalysisPlan, PlanExecutionResult } from "./analysis-plan";

/* ─────────────── 契约（AnalysisNarrative） ─────────────── */

export type NarrativeStatus = "idle" | "generating" | "ready" | "failed";

export type NarrativeFindingKind = "fact" | "inference" | "recommendation" | "insufficient_data";

export type NarrativePriority = "high" | "medium" | "low";

export interface EvidenceRef {
  resultId: string;
  metricId?: string;
  groupKey?: string;
  drilldownId?: string;
}

export interface NarrativeFinding {
  id: string;
  kind: NarrativeFindingKind;
  title: string;
  statement: string;
  priority: NarrativePriority;
  evidenceRefs: EvidenceRef[];
  limitations?: string[];
  suggestedAction?: string;
}

export interface AnalysisNarrative {
  id: string;
  planId: string;
  resultId: string;
  evidenceVersion: string;
  status: NarrativeStatus;
  generatedAt?: number;
  executiveSummary?: string;
  findings: NarrativeFinding[];
  caveats: string[];
  retryable?: boolean;
  errorCode?: string;
}

/* ─────────────── 受控上下文 ─────────────── */

/** 每个输出的聚合分组最多打包条数（LLM 不接触整表） */
export const NARRATIVE_MAX_GROUPS = 8;
/** 最多保留的发现条数（用户要求 3-5 条按优先级） */
export const NARRATIVE_MAX_FINDINGS = 5;

export interface NarrativeGroup {
  key: string;
  value: number;
}

export interface NarrativeResultBlock {
  resultId: string;
  title: string;
  chartType: string;
  summary: string;
  groups: NarrativeGroup[];
}

export interface NarrativeContextData {
  planId: string;
  resultId: string;
  evidenceVersion: string;
  objectiveTitle: string;
  description: string;
  actualSampleSize: number;
  excludedRowCount: number;
  excludedColumnCount: number;
  filters: string[];
  caveats: string[];
  formulas: string[];
  results: NarrativeResultBlock[];
}

/** 解读的缓存 / 去重 key（planId:resultId） */
export function narrativeKey(planId: string, resultId: string): string {
  return `${planId}:${resultId}`;
}

/** 证据版本标识（计划 + 确认版本；变更即视为新证据） */
export function evidenceVersionOf(plan: AnalysisPlan): string {
  return `${plan.id}:${plan.confirmationVersion}`;
}

function toStr(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

/** 从执行结果的 data 中提取「分组 → 数值」聚合对（最多 N 条）；无法提取则返回空 */
function extractGroups(data: unknown): NarrativeGroup[] {
  if (!Array.isArray(data)) return [];
  const out: NarrativeGroup[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.name === "string" && typeof o.value === "number" && Number.isFinite(o.value)) {
      out.push({ key: o.name, value: o.value });
    } else if ((typeof o.x === "string" || typeof o.x === "number") && typeof o.y === "number" && Number.isFinite(o.y)) {
      out.push({ key: String(o.x), value: o.y });
    }
    if (out.length >= NARRATIVE_MAX_GROUPS) break;
  }
  return out;
}

/**
 * 受控上下文打包：只保留「必要的聚合结果 + 口径 + 质量提示」，绝不含原始行 / 明细行。
 * 返回结构化 data（供校验）与人类可读 prompt（供 LLM）。
 */
export function buildNarrativeContext(
  plan: AnalysisPlan,
  result: PlanExecutionResult,
  targetResultId?: string,
): { prompt: string; data: NarrativeContextData } {
  const evidence = result.evidence;
  const blocks: NarrativeResultBlock[] = plan.outputs.map((out, i) => {
    const exec = result.results[i]?.execution;
    return {
      resultId: out.id,
      title: result.results[i]?.title ?? out.label,
      chartType: exec?.chartType ?? out.chartType,
      summary: exec?.summary ?? "",
      groups: exec ? extractGroups(exec.data) : [],
    };
  });

  const data: NarrativeContextData = {
    planId: plan.id,
    resultId: targetResultId ?? plan.outputs[0]?.id ?? "",
    evidenceVersion: evidenceVersionOf(plan),
    objectiveTitle: plan.title,
    description: plan.description,
    actualSampleSize: evidence.actualSampleSize,
    excludedRowCount: evidence.excludedRowCount,
    excludedColumnCount: evidence.excludedColumnCount,
    filters: evidence.appliedFilters.map((f) => `${f.label}${f.affectedRows ? `（影响 ${f.affectedRows} 行）` : ""}`),
    caveats: evidence.qualityCaveats.map((c) => `${c.level === "attention" ? "⚠" : "ℹ"} ${c.message}`),
    formulas: evidence.calculation.formulas.map((f) => `${f.label} = ${f.expression}`),
    results: blocks,
  };

  const lines: string[] = [];
  lines.push(`【分析目标】${plan.title}`);
  lines.push(plan.description);
  lines.push("");
  lines.push("【数据与口径】");
  lines.push(`- 有效数据：${evidence.actualSampleSize} 条；过滤排除 ${evidence.excludedRowCount} 行；未使用 ${evidence.excludedColumnCount} 个字段；数据版本 v${plan.confirmationVersion}`);
  lines.push(`- 过滤规则：${data.filters.length ? data.filters.join("；") : "无"}`);
  lines.push(`- 质量提示：${data.caveats.length ? data.caveats.join("；") : "无"}`);
  lines.push(`- 计算公式：${data.formulas.length ? data.formulas.join("；") : "无"}`);
  lines.push("");
  lines.push(`【聚合结果（确定性引擎已计算，直接引用，禁止重算）】共 ${blocks.length} 项`);
  blocks.forEach((b, i) => {
    lines.push(`${i + 1}. ${b.title}（${b.chartType}）`);
    if (b.groups.length > 0) {
      lines.push(`   分组数据（前 ${b.groups.length} 条）：${b.groups.map((g) => `${g.key}=${g.value}`).join("，")}`);
    }
    if (b.summary) lines.push(`   摘要：${b.summary}`);
  });
  lines.push("");
  lines.push("注意：以上为全部可引用数据。引用分组时必须使用「分组数据」中出现的 key。");

  return { prompt: lines.join("\n"), data };
}

/** 受控系统提示词：只解释、不计算、禁止编造、必须回链证据 */
export const NARRATIVE_SYSTEM_PROMPT = `你是数据分析结果解释助手。你只能解释下面给定的、已由确定性引擎计算好的聚合结果，绝不能自行计算、读取或修改任何原始数据。
铁律：
1. 不得对数据做任何计算（包括加总、求比、推算），只能复述上下文里已给出的数值与分组。
2. 不得编造字段、公式、数值、趋势或结论；不得声称上下文里不存在的证据。
3. 每条发现必须带 evidenceRefs，引用上下文【聚合结果】中存在的 resultId 与分组 key（groupKey）。
4. kind 含义：
   - fact：只复述确定性结果中存在的数值 / 分组，必须带有效证据引用；
   - inference：基于结果的推断，必须表达不确定性（如「可能」「疑似」）；
   - recommendation：基于已有证据的可执行建议，必须写明 suggestedAction；
   - insufficient_data：数据不足，必须说明缺什么数据。
5. 若上下文标注「无法得出结论」或「无有效数据」，必须输出 insufficient_data 类发现，禁止强行解释或编造。
6. 输出 3-5 条发现，按业务优先级（high/medium/low）排序，聚焦可行动内容，避免泛泛的「趋势总结」。
7. 只输出 JSON：{"executiveSummary": "...", "findings": [{"kind": "...", "title": "...", "statement": "...", "priority": "...", "evidenceRefs": [{"resultId": "...", "groupKey": "..."}], "limitations": [...], "suggestedAction": "..."}]}`;

/* ─────────────── 解析与校验 ─────────────── */

const KIND_SET = new Set<NarrativeFindingKind>(["fact", "inference", "recommendation", "insufficient_data"]);
const PRIORITY_WEIGHT: Record<NarrativePriority, number> = { high: 0, medium: 1, low: 2 };

/**
 * 解析并校验 LLM 返回的解读：
 *  - kind / priority 枚举校验（非法值降级）；
 *  - evidenceRefs 校验：resultId 必须存在、groupKey 必须存在于该输出聚合数据（否则忽略引用并记 caveat）；
 *  - fact 无有效证据引用 → 降级为 inference（「不存在证据引用的内容不能被标记为 fact」）；
 *  - 按优先级排序并截取最多 NARRATIVE_MAX_FINDINGS 条；
 *  - attention 质量提示存在且无 insufficient_data → 强制注入 insufficient_data finding。
 * 结构严重无效（无 findings / 全被剔除）时抛错，由调用方转为 failed。
 */
export function parseAndValidateNarrative(
  parsed: unknown,
  plan: AnalysisPlan,
  result: PlanExecutionResult,
  ctx: NarrativeContextData,
): AnalysisNarrative {
  if (!parsed || typeof parsed !== "object") throw new Error("解读输出结构无效");
  const raw = parsed as Record<string, unknown>;
  const rawFindings = Array.isArray(raw.findings) ? raw.findings : [];
  if (rawFindings.length === 0) throw new Error("解读未返回任何发现");

  const validResultIds = new Set(ctx.results.map((r) => r.resultId));
  const groupsByResult = new Map<string, Set<string>>();
  for (const r of ctx.results) groupsByResult.set(r.resultId, new Set(r.groups.map((g) => g.key)));

  const findings: NarrativeFinding[] = [];
  const caveats: string[] = [];

  for (const f of rawFindings) {
    if (!f || typeof f !== "object") continue;
    const fo = f as Record<string, unknown>;
    let kind = toStr(fo.kind) as NarrativeFindingKind;
    if (!KIND_SET.has(kind)) kind = "inference";
    const title = toStr(fo.title).slice(0, 80) || "发现";
    const statement = toStr(fo.statement).slice(0, 500);
    if (!statement) continue;
    let priority = toStr(fo.priority) as NarrativePriority;
    if (priority !== "high" && priority !== "medium" && priority !== "low") priority = "medium";

    // evidenceRefs：只保留能解析到确定性结果的引用
    const refs: EvidenceRef[] = [];
    const rawRefs = Array.isArray(fo.evidenceRefs) ? fo.evidenceRefs : [];
    for (const rr of rawRefs) {
      if (!rr || typeof rr !== "object") continue;
      const ro = rr as Record<string, unknown>;
      const resultId = toStr(ro.resultId);
      if (!validResultIds.has(resultId)) continue;
      const groupKey = toStr(ro.groupKey);
      const metricId = toStr(ro.metricId);
      const drilldownId = toStr(ro.drilldownId);
      if (groupKey && !groupsByResult.get(resultId)?.has(groupKey)) {
        caveats.push(`发现「${title}」引用的分组「${groupKey}」不在计算结果中，引用已忽略`);
        continue;
      }
      refs.push({
        resultId,
        ...(metricId ? { metricId } : {}),
        ...(groupKey ? { groupKey } : {}),
        ...(drilldownId ? { drilldownId } : {}),
      });
    }

    if (kind === "fact" && refs.length === 0) {
      caveats.push(`发现「${title}」标记为事实但无有效证据引用，已降级为推断`);
      kind = "inference";
    }

    const limitations = Array.isArray(fo.limitations)
      ? fo.limitations.map((l) => toStr(l).slice(0, 200)).filter(Boolean).slice(0, 3)
      : undefined;
    const suggestedAction = toStr(fo.suggestedAction).slice(0, 300) || undefined;

    findings.push({
      id: randomUUID().replace(/-/g, "").slice(0, 12),
      kind,
      title,
      statement,
      priority,
      evidenceRefs: refs,
      ...(limitations && limitations.length ? { limitations } : {}),
      ...(suggestedAction ? { suggestedAction } : {}),
    });
    if (findings.length >= NARRATIVE_MAX_FINDINGS) break;
  }

  if (findings.length === 0) throw new Error("解读返回的发现均无效");

  // 按优先级排序（high → medium → low），同优先级保持稳定顺序
  findings.sort((a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]);

  // 数据不足强制注入：attention 提示存在且无 insufficient_data → 注入
  const attentionCaveats = ctx.caveats.filter((c) => c.includes("无法得出结论") || c.includes("无有效数据"));
  if (attentionCaveats.length > 0 && !findings.some((f) => f.kind === "insufficient_data")) {
    findings.push({
      id: randomUUID().replace(/-/g, "").slice(0, 12),
      kind: "insufficient_data",
      title: "数据不足",
      statement: `${attentionCaveats.join("；")}。需要补充完整且满足过滤条件的数据后再判断。`,
      priority: "medium",
      evidenceRefs: [],
    });
  }

  const executiveSummary = toStr(raw.executiveSummary).slice(0, 300) || undefined;
  const allCaveats = Array.from(new Set([...ctx.caveats, ...caveats]));

  return {
    id: randomUUID().replace(/-/g, "").slice(0, 16),
    planId: plan.id,
    resultId: ctx.resultId,
    evidenceVersion: ctx.evidenceVersion,
    status: "ready",
    generatedAt: Date.now(),
    ...(executiveSummary ? { executiveSummary } : {}),
    findings,
    caveats: allCaveats,
  };
}
