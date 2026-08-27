/**
 * 表格分析 —— AnalysisPlan 契约 + 确定性推荐与执行桥接（T2-A）
 *
 * 设计铁律（T2-A）：
 *  - AnalysisPlan 是一份「可理解、可核对」的分析计划；用户在确认口径后，
 *    确定性引擎（lib/table/analysis.ts 的 executeDimension）执行，LLM 不参与
 *    计算、不决定字段/公式/结论。
 *  - 推荐只依据「已确认的 EffectiveDataset + 已确认字段类型/override + 已确认分析列
 *    + 既有 profiler 统计」，纯规则、无 LLM、无网络。
 *  - 五类业务目标（营收 / 商品 / 物流 / 广告 / 客户）各有明确的字段前置条件；
 *    不满足时不生成假计划，返回缺失原因与可调整建议。
 *  - 低置信度且用户未确认的字段，禁止作为「指标（measure）」被任何 plan 使用；
 *  - 计划只消费 confirmed dataset（字段确认后服务端重画像并就地更新的缓存）。
 *  - 执行前校验 tableId / sheetId / 用户确认版本 / 字段存在性 / 字段类型 / 过滤规则；
 *    失败返回结构化原因，不产生空图表或伪结果。
 */

import type {
  AnalysisDimension,
  AnalysisResult,
  ChartType,
  FieldType,
  TableProfileResult,
  ColumnOverride,
} from "./types";
import { executeDimension } from "./analysis";

/** 低置信度阈值（与 T1-D3 column-confirmation.ts 一致） */
export const PLAN_LOW_CONF_THRESHOLD = 0.6;

/* ─────────────── 目标与角色 ─────────────── */

export type AnalysisObjective =
  | "revenue_overview"
  | "product_performance"
  | "logistics_cost"
  | "advertising_performance"
  | "customer_overview"
  | "custom";

export type PlanRole =
  | "time"
  | "geo"
  | "category"
  | "id"
  | "sku"
  | "product"
  | "measure"
  | "currency"
  | "quantity"
  | "channel"
  | "customer"
  | "email"
  | "spend"
  | "impressions"
  | "clicks"
  | "conversions"
  | "revenue"
  | "refund_status"
  | "status";

/* ─────────────── Plan 结构 ─────────────── */

export interface PlanDimension {
  /** 字段名（confirmed 后的表头名） */
  field: string;
  /** 展示名 */
  displayName: string;
  role: PlanRole;
}

export type PlanAggregation = "sum" | "mean" | "count" | "count_distinct" | "min" | "max";

export interface PlanMeasure {
  field: string;
  displayName: string;
  aggregation: PlanAggregation;
  /** 可选人话公式，如 "sum(销售额)" / "点击 / 曝光 × 100%" */
  formula?: string;
}

export type PlanFilterOperator = "eq" | "neq" | "not_null" | "is_null" | "in" | "gt" | "gte" | "lt" | "lte";

export interface PlanFilter {
  field: string;
  operator: PlanFilterOperator;
  value: unknown;
  /** 人话说明为何加此过滤（如「排除已退款订单」） */
  reason: string;
}

export type PlanOutputKind = "metric" | "chart" | "table";

/** 执行期派生的临时列（不写回数据集，仅本次执行使用） */
export interface DerivedColumn {
  /** 派生列名（与 analysisDimension.fields 对应） */
  name: string;
  expression: "date_diff_days" | "ratio" | "rate";
  args: { numerator?: string; denominator?: string; start?: string; end?: string };
  displayName: string;
  aggregation: PlanAggregation;
}

export interface PlanOutput {
  id: string;
  label: string;
  kind: PlanOutputKind;
  chartType: ChartType;
  dimension?: PlanDimension;
  measures: PlanMeasure[];
  derivedColumns?: DerivedColumn[];
  /** 直接可执行的维度（字段名对应执行期数据集，含派生列名） */
  analysisDimension: AnalysisDimension;
}

export type PlanStatus = "draft" | "ready" | "executed" | "failed";

export interface AnalysisPlan {
  id: string;
  tableId: string;
  sheetId: string;
  version: number;
  objective: AnalysisObjective;
  title: string;
  description: string;
  dimensions: PlanDimension[];
  measures: PlanMeasure[];
  filters: PlanFilter[];
  assumptions: string[];
  excludedDataNotes: string[];
  sampleSize: number;
  outputs: PlanOutput[];
  status: PlanStatus;
  createdAt: number;
  /** 引用当前确认的表头行（allRows 0-based） */
  headerRow: number;
  /** 引用当前字段确认的版本（执行时校验一致性） */
  confirmationVersion: number;
  /** 引用当前纳入分析的原始列下标 */
  confirmedColumns: number[];
}

/* ─────────────── 业务口径微调（前端可调整项，不做技术变量表单） ─────────────── */

export interface PlanOptions {
  /** 可选时间字段（覆盖默认检测到的日期字段） */
  timeField?: string;
  /** 可选分组字段（覆盖默认检测到的分组/地理字段） */
  groupField?: string;
  /** 是否包含退款订单（默认 true；设为 false 时排除已退款） */
  includeRefunded?: boolean;
  /** 是否包含指标为空的行（默认 true；设为 false 时排除空值） */
  includeNulls?: boolean;
}

/* ─────────────── 推荐结果（list_objectives 用） ─────────────── */

export interface ObjectiveMeta {
  objective: AnalysisObjective;
  title: string;
  description: string;
  /** 该方向能回答的业务问题 */
  questions: string[];
  /** 系统将使用哪些字段 */
  fieldsUsed: string[];
  /** 数据量 / 样本量 */
  sampleSize: number;
  /** 已知局限 */
  limitations: string[];
  available: boolean;
  missingReasons: string[];
  missingFieldTypes: string[];
  suggestions: string[];
}

export type PlanGenerationResult =
  | { ok: true; plan: AnalysisPlan }
  | { ok: false; missingReasons: string[]; missingFieldTypes: string[]; suggestions: string[] };

/* ─────────────── 执行结果 ─────────────── */

export interface AppliedFilter {
  field: string;
  operator: PlanFilterOperator;
  value: unknown;
  matchedRows: number;
}

export interface PlanExecutionResult {
  planId: string;
  objective: AnalysisObjective;
  status: "executed" | "failed";
  results: AnalysisResult[];
  /** T2-B：证据链（数据来源 / 字段 / 过滤 / 公式 / 质量提示 / 下钻），全程业务语言可溯源 */
  evidence: AnalysisEvidence;
  /** T2-B：过滤后的有效行（供前端下钻到明细 / 分组），上限 2000 行 */
  effectiveRows: unknown[][];
  /** T2-B：effectiveRows 是否被截断（原始有效行超过上限） */
  effectiveTruncated: boolean;
  appliedFilters: AppliedFilter[];
  actualSampleSize: number;
  usedFields: string[];
  caliberSummary: string;
  error?: string;
}

/* ─────────────── T2-B：AnalysisEvidence 证据链 ─────────────── */

export type EvidenceFieldRole = "dimension" | "measure" | "filter" | "derived";

export interface EvidenceUsedField {
  /** 内部列标识（UI 不展示） */
  columnId: string;
  displayName: string;
  type: FieldType;
  role: EvidenceFieldRole;
}

export interface EvidenceAppliedFilter {
  /** 业务语言标签，如「排除已退款订单」 */
  label: string;
  reason: string;
  /** 该过滤排除的行数 */
  affectedRows?: number;
}

export interface EvidenceFormula {
  label: string;
  expression: string;
  aggregation: string;
}

export interface EvidenceCalculation {
  summary: string;
  formulas: EvidenceFormula[];
}

export type QualityCaveatLevel = "attention" | "advisory";

export interface QualityCaveat {
  level: QualityCaveatLevel;
  message: string;
  affectedFieldIds?: string[];
}

export interface DrilldownInfo {
  resultId: string;
  title: string;
  available: boolean;
  rowCount: number;
}

/** 一份分析结果的完整证据链（T2-B）：让确定性引擎的结果可被信任、被复查、被溯源 */
export interface AnalysisEvidence {
  planId: string;
  tableId: string;
  sheetId: string;
  confirmationVersion: number;
  actualSampleSize: number;
  excludedRowCount: number;
  excludedColumnCount: number;
  usedFields: EvidenceUsedField[];
  appliedFilters: EvidenceAppliedFilter[];
  calculation: EvidenceCalculation;
  qualityCaveats: QualityCaveat[];
  drilldowns: DrilldownInfo[];
}

export interface PlanDataset {
  headers: string[];
  rows: unknown[][];
  columnTypes: FieldType[];
}

/* ════════════ 字段角色识别（纯规则，依据类型 + 列名关键词） ════════════ */

const ROLE_KEYWORDS: Record<PlanRole, string[]> = {
  time: ["日期", "时间", "下单", "创建", "发货", "签收", "date", "time", "order_date", "created", "day", "month", "year"],
  geo: ["国家", "地区", "省", "市", "region", "country", "province", "city", "area", "区域"],
  category: ["类别", "分类", "类型", "渠道", "状态", "标签", "等级", "category", "channel", "type", "status", "tag", "level"],
  id: ["订单号", "单号", "编号", "order", "order_id", "id", "no"],
  sku: ["sku", "货号", "商品编码", "product_code", "item_code"],
  product: ["商品", "产品", "产品名", "product", "item", "名称", "name"],
  measure: ["金额", "销售额", "营收", "收入", "费用", "成本", "售价", "单价", "总价", "数量", "库存", "销量", "price", "amount", "revenue", "cost", "sales", "fee", "total", "qty", "quantity", "stock", "volume"],
  currency: ["金额", "销售额", "营收", "收入", "费用", "成本", "售价", "单价", "总价", "price", "amount", "revenue", "cost", "sales", "fee", "total"],
  quantity: ["数量", "件数", "库存", "销量", "qty", "quantity", "stock", "volume", "库存量"],
  channel: ["渠道", "物流商", "物流", "carrier", "channel", "shipping"],
  customer: ["客户", "顾客", "会员", "buyer", "customer", "user", "姓名", "name"],
  email: ["邮箱", "email", "mail"],
  spend: ["消耗", "花费", "投入", "广告费", "spend", "expense"],
  impressions: ["曝光", "展示", "impressions", "impression", "views", "展示量"],
  clicks: ["点击", "clicks", "click"],
  conversions: ["转化", "conversion", "cvr", "下单量", "转化数"],
  revenue: ["收入", "营收", "revenue", "income"],
  refund_status: ["退款", "refund"],
  status: ["状态", "status"],
};

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

/** 依据列类型 + 列名关键词推断字段角色集合 */
export function detectRoles(name: string, type: FieldType): PlanRole[] {
  const roles = new Set<PlanRole>();
  const n = norm(name);
  if (type === "date") roles.add("time");
  if (type === "currency") {
    roles.add("currency");
    roles.add("measure");
  }
  if (type === "integer" || type === "float" || type === "percentage") roles.add("measure");
  if (type === "category" || type === "boolean") roles.add("category");
  if (type === "id") roles.add("id");
  if (type === "email") roles.add("email");

  for (const role of Object.keys(ROLE_KEYWORDS) as PlanRole[]) {
    if (ROLE_KEYWORDS[role].some((kw) => n.includes(norm(kw)))) roles.add(role);
  }
  return [...roles];
}

interface FieldInfo {
  index: number;
  name: string;
  type: FieldType;
  confidence: number;
  hasOverride: boolean;
  roles: PlanRole[];
}

function buildFields(
  profile: TableProfileResult,
  confirmedColumns?: number[],
  columnOverrides?: Record<number, ColumnOverride>,
): FieldInfo[] {
  return profile.columns.map((col, i) => {
    const confidence = col.inference?.confidence ?? (col.type !== "text" ? 0.9 : 0.3);
    const origIdx = confirmedColumns && confirmedColumns.length > i ? confirmedColumns[i] : i;
    const hasOverride = !!columnOverrides?.[origIdx]?.type;
    return {
      index: i,
      name: col.name,
      type: col.type,
      confidence,
      hasOverride,
      roles: detectRoles(col.name, col.type),
    };
  });
}

/** 低置信度但用户未确认的字段，禁止作为指标（measure）使用 */
function usableAsMeasure(f: FieldInfo): boolean {
  const numeric = f.type === "integer" || f.type === "float" || f.type === "percentage" || f.type === "currency";
  if (!numeric) return false;
  return f.confidence >= PLAN_LOW_CONF_THRESHOLD || f.hasOverride;
}

function firstWithRole(fields: FieldInfo[], role: PlanRole, opts?: { measure?: boolean }): FieldInfo | undefined {
  return fields.find((f) => f.roles.includes(role) && (!opts?.measure || usableAsMeasure(f)));
}

function firstMeasure(fields: FieldInfo[], prefer: "currency" | "any" = "any"): FieldInfo | undefined {
  if (prefer === "currency") {
    const c = fields.find((f) => f.roles.includes("currency") && usableAsMeasure(f));
    if (c) return c;
  }
  return fields.find((f) => f.roles.includes("measure") && usableAsMeasure(f));
}

/* ════════════ 生成入口 ════════════ */

export interface GeneratePlanParams {
  objective: AnalysisObjective;
  profile: TableProfileResult;
  headers: string[];
  rows: unknown[][];
  columnTypes: FieldType[];
  sheetId: string;
  headerRow: number;
  confirmationVersion: number;
  tableId: string;
  confirmedColumns?: number[];
  columnOverrides?: Record<number, ColumnOverride>;
  options?: PlanOptions;
}

function assemble(
  p: Omit<GeneratePlanParams, "objective">,
  objective: AnalysisObjective,
  title: string,
  description: string,
  dimensions: PlanDimension[],
  measures: PlanMeasure[],
  filters: PlanFilter[],
  outputs: PlanOutput[],
  assumptions: string[],
  excludedDataNotes: string[],
): AnalysisPlan {
  return {
    id: "",
    tableId: p.tableId,
    sheetId: p.sheetId,
    version: p.confirmationVersion,
    objective,
    title,
    description,
    dimensions,
    measures,
    filters,
    assumptions,
    excludedDataNotes,
    sampleSize: p.rows.length,
    outputs,
    status: "draft",
    createdAt: Date.now(),
    headerRow: p.headerRow,
    confirmationVersion: p.confirmationVersion,
    confirmedColumns: p.confirmedColumns ?? [],
  };
}

function dim(f: FieldInfo, role: PlanRole): PlanDimension {
  return { field: f.name, displayName: f.name, role };
}

function measureOf(f: FieldInfo, aggregation: PlanAggregation, formula?: string): PlanMeasure {
  return { field: f.name, displayName: f.name, aggregation, formula };
}

/* ── 各目标构建器 ── */

function buildRevenue(p: Omit<GeneratePlanParams, "objective">, fields: FieldInfo[]): PlanGenerationResult {
  const time = p.options?.timeField
    ? fields.find((f) => f.name === p.options!.timeField)
    : firstWithRole(fields, "time");
  const group =
    p.options?.groupField
      ? fields.find((f) => f.name === p.options!.groupField)
      : firstWithRole(fields, "geo") ?? firstWithRole(fields, "category") ?? firstWithRole(fields, "id");
  const measure = firstMeasure(fields, "currency") ?? firstMeasure(fields);
  const refund = firstWithRole(fields, "refund_status");

  const missing: string[] = [];
  const missingTypes: string[] = [];
  if (!measure) {
    missing.push("缺少金额 / 数值类指标字段（如 销售额、金额、营收）");
    missingTypes.push("currency", "numeric");
  }
  if (!group) {
    missing.push("缺少分组维度字段（如 国家 / 地区 / 品类 / 订单号）");
    missingTypes.push("category", "geo", "id");
  }
  if (missing.length) {
    return {
      ok: false,
      missingReasons: missing,
      missingFieldTypes: missingTypes,
      suggestions: ["确认表中是否含 销售额/金额 列与 国家/品类 列", "在「字段确认」中将这些列纳入分析并确认其类型"],
    };
  }

  const filters: PlanFilter[] = [];
  if (p.options?.includeRefunded === false && refund) {
    const idx = p.headers.indexOf(refund.name);
    const vals = p.rows.map((r) => r[idx]).filter((v) => v !== null && v !== "").map(String);
    if (vals.includes("已退款")) filters.push({ field: refund.name, operator: "neq", value: "已退款", reason: "排除已退款订单（仅统计有效交易）" });
    else if (vals.includes("未退款")) filters.push({ field: refund.name, operator: "eq", value: "未退款", reason: "仅包含未退款订单" });
  }
  if (p.options?.includeNulls === false && measure) {
    filters.push({ field: measure.name, operator: "not_null", value: null, reason: `排除「${measure.name}」为空的行` });
  }

  const g = group!;
  const m = measure!;
  const dimensions: PlanDimension[] = [dim(g, g.roles[0] ?? "category")];
  if (time) dimensions.push(dim(time, "time"));
  const measures: PlanMeasure[] = [measureOf(m, "sum", `sum(${m.name})`)];

  const outputs: PlanOutput[] = [];
  outputs.push({
    id: "rev_by_group",
    label: `按${g.name}的${m.name}`,
    kind: "chart",
    chartType: "bar",
    dimension: dimensions[0],
    measures: measures,
    analysisDimension: {
      name: `按${g.name}汇总${m.name}`,
      description: `按「${g.name}」分组，对「${m.name}」求和`,
      chartType: "bar",
      fields: [g.name, m.name],
      insight: "",
    },
  });
  if (time) {
    outputs.push({
      id: "rev_trend",
      label: `${m.name}时间趋势`,
      kind: "chart",
      chartType: "line",
      dimension: dim(time, "time"),
      measures: measures,
      analysisDimension: {
        name: `${m.name}逐期趋势`,
        description: `按「${time.name}」按月聚合「${m.name}」`,
        chartType: "mom",
        fields: [time.name, m.name],
        insight: "",
      },
    });
  }
  if (refund) {
    outputs.push({
      id: "rev_refund",
      label: `${refund.name}分布`,
      kind: "chart",
      chartType: "pie",
      dimension: dim(refund, "refund_status"),
      measures: [],
      analysisDimension: {
        name: `${refund.name}分布`,
        description: `「${refund.name}」各取值占比`,
        chartType: "pie",
        fields: [refund.name],
        insight: "",
      },
    });
  }

  const assumptions = [
    `${m.name} 按原始数值直接求和，不做汇率 / 币种换算`,
    time ? `${time.name} 按 YYYY-MM-DD 解析为月度聚合` : "未检测到日期字段，无法生成时间趋势",
  ];
  const excluded = ["空值行、幽灵列已在数据边界处剔除，不计入分析", "分析仅基于已确认纳入的字段"];

  return { ok: true, plan: assemble(p, "revenue_overview", "订单与营收概览", "按分组维度汇总销售额，并给出时间趋势与退款分布。", dimensions, measures, filters, outputs, assumptions, excluded) };
}

function buildProduct(p: Omit<GeneratePlanParams, "objective">, fields: FieldInfo[]): PlanGenerationResult {
  const key = firstWithRole(fields, "sku") ?? firstWithRole(fields, "product") ?? firstWithRole(fields, "id");
  const measure = firstMeasure(fields, "currency") ?? firstMeasure(fields);
  const qty = firstWithRole(fields, "quantity");
  const status = firstWithRole(fields, "status") ?? firstWithRole(fields, "category");

  const missing: string[] = [];
  const missingTypes: string[] = [];
  if (!key) {
    missing.push("缺少商品 / SKU 标识字段（如 SKU、商品编码、商品名）");
    missingTypes.push("sku", "product", "id");
  }
  if (!measure) {
    missing.push("缺少价格 / 成本 / 库存类数值字段（如 售价、成本、库存）");
    missingTypes.push("currency", "numeric");
  }
  if (missing.length) {
    return {
      ok: false,
      missingReasons: missing,
      missingFieldTypes: missingTypes,
      suggestions: ["确认表中含有 SKU / 商品 列与 售价 / 成本 / 库存 列", "在「字段确认」中确认这些列的类型"],
    };
  }

  const k = key!;
  const m = measure!;
  const dimensions: PlanDimension[] = [dim(k, k.roles.includes("sku") ? "sku" : "id")];
  const measures: PlanMeasure[] = [measureOf(m, "sum", `sum(${m.name})`)];

  const outputs: PlanOutput[] = [
    {
      id: "prod_top",
      label: `Top ${k.name}（按${m.name}）`,
      kind: "chart",
      chartType: "bar",
      dimension: dimensions[0],
      measures,
      analysisDimension: {
        name: `Top ${k.name} 排名`,
        description: `按「${k.name}」汇总「${m.name}」取 Top 10`,
        chartType: "topn",
        fields: [k.name, m.name],
        insight: "",
      },
    },
  ];
  if (qty) {
    outputs.push({
      id: "prod_stock",
      label: `${qty.name}分布`,
      kind: "chart",
      chartType: "histogram",
      dimension: dim(qty, "quantity"),
      measures: [measureOf(qty, "mean")],
      analysisDimension: {
        name: `${qty.name}分布`,
        description: `「${qty.name}」数值分布直方图`,
        chartType: "histogram",
        fields: [qty.name],
        insight: "",
      },
    });
  }
  if (status) {
    outputs.push({
      id: "prod_status",
      label: `${status.name}占比`,
      kind: "chart",
      chartType: "pie",
      dimension: dim(status, "status"),
      measures: [],
      analysisDimension: {
        name: `${status.name}占比`,
        description: `「${status.name}」各取值占比`,
        chartType: "pie",
        fields: [status.name],
        insight: "",
      },
    });
  }

  const assumptions = [`${m.name} 按原始数值求和`, qty ? `${qty.name} 按数值分布展示` : "未检测到数量字段"];
  const excluded = ["空值行、幽灵列已在数据边界处剔除", "分析仅基于已确认纳入的字段"];
  return { ok: true, plan: assemble(p, "product_performance", "商品 / SKU 表现", "按商品 / SKU 汇总价格与库存，识别主力商品与库存结构。", dimensions, measures, [], outputs, assumptions, excluded) };
}

function buildLogistics(p: Omit<GeneratePlanParams, "objective">, fields: FieldInfo[]): PlanGenerationResult {
  const channel = firstWithRole(fields, "channel") ?? firstWithRole(fields, "geo") ?? firstWithRole(fields, "category");
  const fee = firstMeasure(fields, "currency");
  const ship = firstWithRole(fields, "time") ?? fields.find((f) => /发货|ship/i.test(f.name));
  const delivery = fields.find((f) => /签收|delivery|sign/i.test(f.name)) ?? firstWithRole(fields, "time");
  const status = firstWithRole(fields, "status") ?? firstWithRole(fields, "category");

  const hasDatePair = !!ship && !!delivery && ship.name !== delivery.name;
  const missing: string[] = [];
  const missingTypes: string[] = [];
  if (!channel) {
    missing.push("缺少渠道 / 分类字段（如 物流渠道、国家、运输方式）");
    missingTypes.push("channel", "category");
  }
  if (!fee && !hasDatePair) {
    missing.push("缺少费用字段（如 运费、物流费）或 发货 / 签收日期对");
    missingTypes.push("currency", "date");
  }
  if (missing.length) {
    return {
      ok: false,
      missingReasons: missing,
      missingFieldTypes: missingTypes,
      suggestions: ["确认表中含有 物流渠道 与 费用 / 发货日期 / 签收日期 列", "在「字段确认」中确认其类型"],
    };
  }

  const c = channel!;
  const dimensions: PlanDimension[] = [dim(c, c.roles.includes("channel") ? "channel" : "category")];
  const measures: PlanMeasure[] = [];
  const outputs: PlanOutput[] = [];

  if (fee) {
    measures.push(measureOf(fee, "sum", `sum(${fee.name})`));
    dimensions.push(dim(fee, "currency"));
    outputs.push({
      id: "logi_fee",
      label: `各${c.name}费用合计`,
      kind: "chart",
      chartType: "bar",
      dimension: dimensions[0],
      measures: [measures[measures.length - 1]],
      analysisDimension: {
        name: `各${c.name}费用合计`,
        description: `按「${c.name}」对「${fee.name}」求和`,
        chartType: "bar",
        fields: [c.name, fee.name],
        insight: "",
      },
    });
  }
  if (hasDatePair) {
    const daysName = "签收时效(天)";
    const derived: DerivedColumn = {
      name: daysName,
      expression: "date_diff_days",
      args: { start: ship!.name, end: delivery!.name },
      displayName: daysName,
      aggregation: "mean",
    };
    measures.push({ field: daysName, displayName: daysName, aggregation: "mean", formula: `mean(${delivery.name} - ${ship.name})` });
    dimensions.push(dim(delivery, "time"));
    outputs.push({
      id: "logi_lead",
      label: `各${c.name}平均签收时效`,
      kind: "chart",
      chartType: "bar",
      dimension: dimensions[0],
      measures: [measures[measures.length - 1]],
      derivedColumns: [derived],
      analysisDimension: {
        name: `各${c.name}平均签收时效`,
        description: `按「${c.name}」对「${daysName}」求均值`,
        chartType: "bar",
        fields: [c.name, daysName],
        insight: "",
      },
    });
  }
  if (status) {
    outputs.push({
      id: "logi_status",
      label: `${status.name}分布`,
      kind: "chart",
      chartType: "pie",
      dimension: dim(status, "status"),
      measures: [],
      analysisDimension: {
        name: `${status.name}分布`,
        description: `「${status.name}」各取值占比`,
        chartType: "pie",
        fields: [status.name],
        insight: "",
      },
    });
  }

  const assumptions = [
    fee ? `${fee.name} 按原始数值求和` : "未提供费用字段",
    hasDatePair ? `签收时效 = ${delivery!.name} − ${ship!.name}（自然日）` : "未检测到完整日期对，无法计算时效",
  ];
  const excluded = ["空值行、幽灵列已在数据边界处剔除", "签收日期缺失的行不计入时效均值"];
  return { ok: true, plan: assemble(p, "logistics_cost", "物流费用与时效", "按渠道汇总物流费用，并计算签收时效与状态分布。", dimensions, measures, [], outputs, assumptions, excluded) };
}

function buildAdvertising(p: Omit<GeneratePlanParams, "objective">, fields: FieldInfo[]): PlanGenerationResult {
  const adGroup = firstWithRole(fields, "category") ?? firstWithRole(fields, "id");
  const time = firstWithRole(fields, "time");
  const spend = firstWithRole(fields, "spend") ?? firstMeasure(fields, "currency");
  const impressions = firstWithRole(fields, "impressions");
  const clicks = firstWithRole(fields, "clicks");
  const conversions = firstWithRole(fields, "conversions");
  const revenue = firstWithRole(fields, "revenue") ?? firstMeasure(fields, "currency");

  const present = [spend, impressions, clicks, conversions, revenue].filter(Boolean) as FieldInfo[];
  const missing: string[] = [];
  const missingTypes: string[] = [];
  if (present.length < 2) {
    missing.push("至少需要 2 个广告指标（消耗 / 曝光 / 点击 / 转化 / 收入）");
    missingTypes.push("spend", "impressions", "clicks", "conversions", "revenue");
  }
  if (!adGroup && !time) {
    missing.push("缺少分组 / 时间字段（如 广告组、日期）");
    missingTypes.push("category", "date");
  }
  if (missing.length) {
    return {
      ok: false,
      missingReasons: missing,
      missingFieldTypes: missingTypes,
      suggestions: ["确认表中含有 消耗 / 曝光 / 点击 / 转化 / 收入 等列", "在「字段确认」中确认其类型"],
    };
  }

  const group = adGroup ?? time!;
  const dimensions: PlanDimension[] = [dim(group, adGroup ? "category" : "time")];
  const measures: PlanMeasure[] = [];
  const outputs: PlanOutput[] = [];

  if (spend) {
    measures.push(measureOf(spend, "sum", `sum(${spend.name})`));
    dimensions.push(dim(spend, "spend"));
    outputs.push({
      id: "ads_spend",
      label: `各${group.name}消耗`,
      kind: "chart",
      chartType: "bar",
      dimension: dimensions[0],
      measures: [measures[measures.length - 1]],
      analysisDimension: {
        name: `各${group.name}消耗`,
        description: `按「${group.name}」对「${spend.name}」求和`,
        chartType: "bar",
        fields: [group.name, spend.name],
        insight: "",
      },
    });
  }
  if (impressions && clicks) {
    const name = "点击率(%)";
    measures.push({ field: name, displayName: name, aggregation: "mean", formula: `${clicks.name} / ${impressions.name} × 100%` });
    outputs.push({
      id: "ads_ctr",
      label: `各${group.name}点击率`,
      kind: "chart",
      chartType: "bar",
      dimension: dimensions[0],
      measures: [measures[measures.length - 1]],
      derivedColumns: [{ name, expression: "rate", args: { numerator: clicks.name, denominator: impressions.name }, displayName: name, aggregation: "mean" }],
      analysisDimension: { name: `各${group.name}点击率`, description: `按「${group.name}」对点击率求均值`, chartType: "bar", fields: [group.name, name], insight: "" },
    });
  }
  if (clicks && conversions) {
    const name = "转化率(%)";
    measures.push({ field: name, displayName: name, aggregation: "mean", formula: `${conversions.name} / ${clicks.name} × 100%` });
    outputs.push({
      id: "ads_cvr",
      label: `各${group.name}转化率`,
      kind: "chart",
      chartType: "bar",
      dimension: dimensions[0],
      measures: [measures[measures.length - 1]],
      derivedColumns: [{ name, expression: "rate", args: { numerator: conversions.name, denominator: clicks.name }, displayName: name, aggregation: "mean" }],
      analysisDimension: { name: `各${group.name}转化率`, description: `按「${group.name}」对转化率求均值`, chartType: "bar", fields: [group.name, name], insight: "" },
    });
  }
  if (spend && revenue) {
    const name = "ROI";
    measures.push({ field: name, displayName: name, aggregation: "mean", formula: `${revenue.name} / ${spend.name}` });
    outputs.push({
      id: "ads_roi",
      label: `各${group.name}ROI`,
      kind: "chart",
      chartType: "bar",
      dimension: dimensions[0],
      measures: [measures[measures.length - 1]],
      derivedColumns: [{ name, expression: "ratio", args: { numerator: revenue.name, denominator: spend.name }, displayName: name, aggregation: "mean" }],
      analysisDimension: { name: `各${group.name}ROI`, description: `按「${group.name}」对 ROI 求均值`, chartType: "bar", fields: [group.name, name], insight: "" },
    });
  }
  if (time && spend) {
    outputs.push({
      id: "ads_trend",
      label: `${spend.name}时间趋势`,
      kind: "chart",
      chartType: "line",
      dimension: dim(time, "time"),
      measures: [measureOf(spend, "sum")],
      analysisDimension: { name: `${spend.name}逐期趋势`, description: `按「${time.name}」按月聚合「${spend.name}」`, chartType: "mom", fields: [time.name, spend.name], insight: "" },
    });
  }

  const assumptions = ["消耗 / 收入 按原始数值求和", "点击率 / 转化率 / ROI 为派生比率（每行计算后取均值）", "分母为 0 或缺失的行不计入比率均值"];
  const excluded = ["空值行、幽灵列已在数据边界处剔除", "分析仅基于已确认纳入的字段"];
  return { ok: true, plan: assemble(p, "advertising_performance", "广告投放表现", "按广告组汇总消耗，并计算点击率、转化率、ROI 与时间趋势。", dimensions, measures, [], outputs, assumptions, excluded) };
}

function buildCustomer(p: Omit<GeneratePlanParams, "objective">, fields: FieldInfo[]): PlanGenerationResult {
  const customer = firstWithRole(fields, "customer") ?? firstWithRole(fields, "email") ?? firstWithRole(fields, "id");
  const time = firstWithRole(fields, "time");
  const tag = firstWithRole(fields, "category") ?? firstWithRole(fields, "status");

  const missing: string[] = [];
  const missingTypes: string[] = [];
  if (!customer) {
    missing.push("缺少客户标识字段（如 客户名、邮箱、会员 ID）");
    missingTypes.push("customer", "email", "id");
  }
  if (!time && !tag) {
    missing.push("缺少时间或分类字段（如 注册日期、标签、等级）");
    missingTypes.push("date", "category");
  }
  if (missing.length) {
    return {
      ok: false,
      missingReasons: missing,
      missingFieldTypes: missingTypes,
      suggestions: ["确认表中含有 客户 / 邮箱 列与 注册日期 / 标签 列", "在「字段确认」中确认其类型"],
    };
  }

  const c = customer!;
  const dimensions: PlanDimension[] = [dim(c, c.roles.includes("email") ? "email" : "customer")];
  const measures: PlanMeasure[] = [];
  const outputs: PlanOutput[] = [];

  if (tag) {
    outputs.push({
      id: "cust_tag",
      label: `${tag.name}分布`,
      kind: "chart",
      chartType: "pie",
      dimension: dim(tag, "category"),
      measures: [],
      analysisDimension: { name: `${tag.name}分布`, description: `「${tag.name}」各取值占比`, chartType: "pie", fields: [tag.name], insight: "" },
    });
  }
  if (time) {
    dimensions.push(dim(time, "time"));
    outputs.push({
      id: "cust_trend",
      label: `月度新增${c.name}`,
      kind: "chart",
      chartType: "line",
      dimension: dim(time, "time"),
      measures: [],
      analysisDimension: { name: `月度新增${c.name}`, description: `按「${time.name}」月度统计${c.name}数`, chartType: "mom", fields: [time.name], insight: "" },
    });
  }
  // 明细抽样（table 输出）
  outputs.push({
    id: "cust_detail",
    label: `${c.name}明细抽样`,
    kind: "table",
    chartType: "table",
    dimension: dimensions[0],
    measures: [],
    analysisDimension: { name: `${c.name}明细抽样`, description: `展示${c.name}相关明细`, chartType: "table", fields: fields.slice(0, Math.min(4, fields.length)).map((f) => f.name), insight: "" },
  });

  const assumptions = [time ? `${time.name} 按 YYYY-MM-DD 解析为月度聚合` : "未检测到日期字段，无法生成新增趋势", tag ? `${tag.name} 按取值占比展示` : "未检测到分类字段"];
  const excluded = ["空值行、幽灵列已在数据边界处剔除", "分析仅基于已确认纳入的字段"];
  return { ok: true, plan: assemble(p, "customer_overview", "客户概览", "按标签 / 等级分布客户，并给出注册时间趋势与客户明细。", dimensions, measures, [], outputs, assumptions, excluded) };
}

const BUILDERS: Record<Exclude<AnalysisObjective, "custom">, (p: Omit<GeneratePlanParams, "objective">, fields: FieldInfo[]) => PlanGenerationResult> = {
  revenue_overview: buildRevenue,
  product_performance: buildProduct,
  logistics_cost: buildLogistics,
  advertising_performance: buildAdvertising,
  customer_overview: buildCustomer,
};

/** 生成单个目标的 AnalysisPlan（确定性、无 LLM） */
export function generatePlan(params: GeneratePlanParams): PlanGenerationResult {
  if (params.objective === "custom") {
    return {
      ok: false,
      missingReasons: ["custom 目标需要显式指定维度 / 指标，本版本仅支持 5 个预置业务方向"],
      missingFieldTypes: [],
      suggestions: ["选择 revenue_overview / product_performance / logistics_cost / advertising_performance / customer_overview 之一"],
    };
  }
  const fields = buildFields(params.profile, params.confirmedColumns, params.columnOverrides);
  return BUILDERS[params.objective](params, fields);
}

const OBJECTIVE_META: Record<Exclude<AnalysisObjective, "custom">, { title: string; description: string; questions: string[] }> = {
  revenue_overview: {
    title: "订单与营收概览",
    description: "按国家 / 品类 / 订单等维度汇总销售额，并给出时间趋势与退款分布。",
    questions: ["哪个国家 / 地区的销售额最高？", "销售额随时间如何变化？", "退款订单占比多少？"],
  },
  product_performance: {
    title: "商品 / SKU 表现",
    description: "按商品 / SKU 汇总价格与库存，识别主力商品与库存结构。",
    questions: ["哪些 SKU 贡献了最高的销售额？", "库存分布是否健康？", "不同商品状态占比如何？"],
  },
  logistics_cost: {
    title: "物流费用与时效",
    description: "按渠道汇总物流费用，并计算签收时效与状态分布。",
    questions: ["哪个物流渠道费用最高？", "平均签收时效是多少天？", "在途 / 已签收占比如何？"],
  },
  advertising_performance: {
    title: "广告投放表现",
    description: "按广告组汇总消耗，并计算点击率、转化率、ROI 与时间趋势。",
    questions: ["哪个广告组消耗最高？", "点击率 / 转化率 / ROI 分别是多少？", "消耗随时间如何变化？"],
  },
  customer_overview: {
    title: "客户概览",
    description: "按标签 / 等级分布客户，并给出注册时间趋势与客户明细。",
    questions: ["客户标签 / 等级分布如何？", "每月新增多少客户？", "客户明细长什么样？"],
  },
};

/** 列出全部 5 个业务方向的可用性与元信息（供前端展示「可用分析方向」） */
export function listObjectives(params: Omit<GeneratePlanParams, "objective">): ObjectiveMeta[] {
  const fields = buildFields(params.profile, params.confirmedColumns, params.columnOverrides);
  const objectives = Object.keys(OBJECTIVE_META) as Exclude<AnalysisObjective, "custom">[];
  return objectives.map((obj) => {
    const meta = OBJECTIVE_META[obj];
    const res = BUILDERS[obj](params, fields);
    if (res.ok) {
      const plan = res.plan;
      return {
        objective: obj,
        title: meta.title,
        description: meta.description,
        questions: meta.questions,
        fieldsUsed: Array.from(new Set([...plan.dimensions.map((d) => d.displayName), ...plan.measures.map((m) => m.displayName)])),
        sampleSize: plan.sampleSize,
        limitations: plan.assumptions.concat(plan.excludedDataNotes),
        available: true,
        missingReasons: [],
        missingFieldTypes: [],
        suggestions: [],
      };
    }
    return {
      objective: obj,
      title: meta.title,
      description: meta.description,
      questions: meta.questions,
      fieldsUsed: [],
      sampleSize: params.rows.length,
      limitations: [],
      available: false,
      missingReasons: res.missingReasons,
      missingFieldTypes: res.missingFieldTypes,
      suggestions: res.suggestions,
    };
  });
}

/* ════════════ 执行桥接（复用 lib/table/analysis.ts） ════════════ */

function toStr(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}
function toNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/[¥$,\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function parseDate(s: string): number | null {
  const m = toStr(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  return Number.isNaN(t) ? null : t;
}

function applyFilter(value: unknown, flt: PlanFilter): boolean {
  switch (flt.operator) {
    case "eq":
      return toStr(value) === toStr(flt.value);
    case "neq":
      return toStr(value) !== toStr(flt.value);
    case "not_null":
      return value !== null && value !== undefined && toStr(value) !== "";
    case "is_null":
      return value === null || value === undefined || toStr(value) === "";
    case "in":
      return Array.isArray(flt.value) && flt.value.map(String).includes(toStr(value));
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const n = toNum(value);
      const t = toNum(flt.value);
      if (n === null || t === null) return false;
      if (flt.operator === "gt") return n > t;
      if (flt.operator === "gte") return n >= t;
      if (flt.operator === "lt") return n < t;
      return n <= t;
    }
    default:
      return true;
  }
}

/**
 * 预聚合：把「按分组字段求聚合值」落到每组 1 行上。
 * 因 analysis.ts 的 execGroup/execTopN 对数值列固定取均值，T2-A 先在此把
 * sum/min/max/count/count_distinct 算好，使执行期「取均值」恰好等于目标聚合值。
 * mean 聚合不预聚合（直接交给执行期求均值）。
 */
function preAggregate(
  headers: string[],
  rows: unknown[][],
  columnTypes: FieldType[],
  groupField: string,
  measureField: string,
  aggregation: PlanAggregation,
): { headers: string[]; rows: unknown[][]; columnTypes: FieldType[] } {
  const gi = headers.indexOf(groupField);
  const mi = headers.indexOf(measureField);
  if (gi < 0 || mi < 0) return { headers, rows, columnTypes };
  const groups = new Map<string, number[]>();
  for (const r of rows) {
    const key = toStr(r[gi]) || "(空)";
    const arr = groups.get(key) ?? [];
    const v = toNum(r[mi]);
    if (v !== null) arr.push(v);
    groups.set(key, arr);
  }
  const measureType = columnTypes[mi];
  const newRows = [...groups.entries()].map(([key, vals]) => {
    let agg: number;
    if (vals.length === 0) agg = 0;
    else if (aggregation === "min") agg = Math.min(...vals);
    else if (aggregation === "max") agg = Math.max(...vals);
    else if (aggregation === "count") agg = vals.length;
    else if (aggregation === "count_distinct") agg = new Set(vals).size;
    else agg = vals.reduce((a, b) => a + b, 0); // sum
    return [key, agg];
  });
  return {
    headers: [groupField, measureField],
    rows: newRows,
    columnTypes: [columnTypes[gi], measureType],
  };
}

const PRE_AGG_CHARTS = new Set(["bar", "pie", "topn"]);

function materializeDerived(dc: DerivedColumn, headers: string[], rows: unknown[][]): (number | null)[] {
  if (dc.expression === "date_diff_days") {
    const si = headers.indexOf(dc.args.start ?? "");
    const ei = headers.indexOf(dc.args.end ?? "");
    return rows.map((r) => {
      const s = si >= 0 ? parseDate(toStr(r[si])) : null;
      const e = ei >= 0 ? parseDate(toStr(r[ei])) : null;
      if (s === null || e === null) return null;
      return Math.max(0, Math.round((e - s) / 86400000));
    });
  }
  // ratio / rate
  const ni = headers.indexOf(dc.args.numerator ?? "");
  const di = headers.indexOf(dc.args.denominator ?? "");
  return rows.map((r) => {
    const n = ni >= 0 ? toNum(r[ni]) : null;
    const d = di >= 0 ? toNum(r[di]) : null;
    if (n === null || d === null || d === 0) return null;
    const ratio = n / d;
    return dc.expression === "rate" ? ratio * 100 : ratio;
  });
}

/**
 * 执行分析计划（确定性、纯 JS、无 LLM）。
 * 复用 executeDimension；执行前校验字段存在性 / 类型；失败返回结构化原因。
 * 同时构建 T2-B 证据链（AnalysisEvidence）与下钻明细行（effectiveRows）。
 */
export interface PlanQualityContext {
  /** 字段名 → 推断置信度（来自 profile） */
  confidenceByName?: Record<string, number>;
  /** 字段名 → 用户是否覆盖类型（来自 confirmation.columnOverrides） */
  overrideByName?: Record<string, boolean>;
}

const EVIDENCE_ROW_CAP = 2000;

function aggLabel(a: PlanAggregation): string {
  return { sum: "求和", mean: "均值", count: "计数", count_distinct: "去重计数", min: "最小", max: "最大" }[a] ?? a;
}

export function executeAnalysisPlan(
  plan: AnalysisPlan,
  dataset: PlanDataset,
  qualityContext?: PlanQualityContext,
): PlanExecutionResult {
  const allFields = [
    ...plan.dimensions.map((d) => d.field),
    ...plan.measures.map((m) => m.field),
    ...plan.filters.map((f) => f.field),
  ];
  // 派生列（如 点击率(%) / ROI）在执行期材化，不计入「原始字段缺失」校验
  const derivedNames = new Set(
    plan.outputs.flatMap((o) => (o.derivedColumns ?? []).map((d) => d.name)),
  );
  const missingFields = allFields.filter((f) => !dataset.headers.includes(f) && !derivedNames.has(f));
  if (missingFields.length > 0) {
    const failedResult: PlanExecutionResult = {
      planId: plan.id,
      objective: plan.objective,
      status: "failed",
      results: [],
      evidence: emptyEvidence(plan, dataset),
      effectiveRows: [],
      effectiveTruncated: false,
      appliedFilters: [],
      actualSampleSize: 0,
      usedFields: [],
      caliberSummary: "",
      error: `字段不存在: ${missingFields.join(", ")}`,
    };
    return failedResult;
  }

  // 应用过滤（在 confirmed dataset 上），并记录每个过滤排除的行数
  const preFilterCount = dataset.rows.length;
  let rows = dataset.rows;
  const applied: AppliedFilter[] = [];
  const filterExcluded: number[] = [];
  for (const flt of plan.filters) {
    const idx = dataset.headers.indexOf(flt.field);
    const prev = rows.length;
    let matched = 0;
    rows = rows.filter((r) => {
      const keep = applyFilter(r[idx], flt);
      if (keep) matched++;
      return keep;
    });
    applied.push({ field: flt.field, operator: flt.operator, value: flt.value, matchedRows: matched });
    filterExcluded.push(prev - rows.length);
  }

  // 下钻明细 = 过滤后的有效行（全部列），上限截断
  const effectiveTruncated = rows.length > EVIDENCE_ROW_CAP;
  const effectiveRows = rows.slice(0, EVIDENCE_ROW_CAP);

  const results: AnalysisResult[] = [];
  const derivedNonNull: Record<string, number> = {}; // outputId → 派生列非空计数
  for (const out of plan.outputs) {
    let h = dataset.headers.slice();
    let rr = rows.map((r) => r.slice());
    let t = dataset.columnTypes.slice();
    if (out.derivedColumns?.length) {
      for (const dc of out.derivedColumns) {
        const col = materializeDerived(dc, h, rr);
        derivedNonNull[out.id] = (derivedNonNull[out.id] ?? 0) + col.filter((v) => v !== null).length;
        h = [...h, dc.name];
        rr = rr.map((row, i) => [...row, col[i]]);
        t = [...t, dc.expression === "rate" ? "percentage" : "float"];
      }
    }
    // 非均值聚合（sum/min/max/count/count_distinct）先预聚合，使执行期「取均值」= 目标聚合值
    const measure = out.measures[0];
    if (measure && measure.aggregation !== "mean" && PRE_AGG_CHARTS.has(out.analysisDimension.chartType)) {
      const groupField = out.analysisDimension.fields[0];
      const agg = preAggregate(h, rr, t, groupField, measure.field, measure.aggregation);
      h = agg.headers;
      rr = agg.rows;
      t = agg.columnTypes;
    }
    const exec = executeDimension(out.analysisDimension, h, rr, t);
    results.push({ dimension: out.analysisDimension, execution: exec, interpretation: "", title: out.label });
  }

  const usedFields = Array.from(
    new Set([
      ...plan.dimensions.map((d) => d.field),
      ...plan.measures.map((m) => m.field),
      ...plan.filters.map((f) => f.field),
    ]),
  );

  const caliber = [plan.description, ...plan.assumptions, ...plan.filters.map((f) => f.reason)].join("；");
  const evidence = buildEvidence(plan, dataset, {
    effectiveRows,
    excludedRowCount: preFilterCount - rows.length,
    filterExcluded,
    derivedNonNull,
    qualityContext,
    results,
  });

  return {
    planId: plan.id,
    objective: plan.objective,
    status: "executed",
    results,
    evidence,
    effectiveRows,
    effectiveTruncated,
    appliedFilters: applied,
    actualSampleSize: rows.length,
    usedFields,
    caliberSummary: caliber,
  };
}

/** 过滤失败时的最小证据（仍给出来源与版本，便于前端展示「无法分析」） */
function emptyEvidence(plan: AnalysisPlan, dataset: PlanDataset): AnalysisEvidence {
  return {
    planId: plan.id,
    tableId: plan.tableId,
    sheetId: plan.sheetId,
    confirmationVersion: plan.confirmationVersion,
    actualSampleSize: 0,
    excludedRowCount: 0,
    excludedColumnCount: dataset.headers.length,
    usedFields: [],
    appliedFilters: [],
    calculation: { summary: plan.description, formulas: [] },
    qualityCaveats: [{ level: "attention", message: "分析计划存在缺失字段，无法执行计算。" }],
    drilldowns: [],
  };
}

interface BuildEvidenceCtx {
  effectiveRows: unknown[][];
  excludedRowCount: number;
  filterExcluded: number[];
  derivedNonNull: Record<string, number>;
  qualityContext?: PlanQualityContext;
  results: AnalysisResult[];
}

/** 由 plan + 执行上下文构建证据链（T2-B） */
function buildEvidence(plan: AnalysisPlan, dataset: PlanDataset, ctx: BuildEvidenceCtx): AnalysisEvidence {
  const usedFieldSet = new Set<string>();
  const usedFields: EvidenceUsedField[] = [];

  // 派生列信息（名称 → 执行期类型）：派生列同时出现在 plan.measures 与 outputs.derivedColumns，
  // 优先以「derived」角色入证据，且类型按表达式推断（percentage/float），不从 dataset 兜底
  const derivedInfo = new Map<string, FieldType>();
  plan.outputs.forEach((o) =>
    (o.derivedColumns ?? []).forEach((dc) => derivedInfo.set(dc.name, dc.expression === "rate" ? "percentage" : "float")),
  );

  const pushField = (name: string, role: EvidenceFieldRole, explicitType?: FieldType) => {
    if (usedFieldSet.has(name)) return;
    usedFieldSet.add(name);
    const idx = dataset.headers.indexOf(name);
    const type = explicitType ?? (idx >= 0 ? dataset.columnTypes[idx] : "text");
    usedFields.push({ columnId: idx >= 0 ? `col-${idx}` : `derived-${name}`, displayName: name, type, role });
  };
  plan.dimensions.forEach((d) => pushField(d.field, "dimension"));
  plan.measures.forEach((m) => {
    const derivedType = derivedInfo.get(m.field);
    pushField(m.field, derivedType ? "derived" : "measure", derivedType);
  });
  plan.filters.forEach((f) => pushField(f.field, "filter"));
  plan.outputs.forEach((o) =>
    (o.derivedColumns ?? []).forEach((dc) => pushField(dc.name, "derived", derivedInfo.get(dc.name))),
  );

  const excludedColumnCount = Math.max(0, dataset.headers.length - usedFieldSet.size);

  const appliedFilters: EvidenceAppliedFilter[] = plan.filters.map((f, i) => ({
    label: filterLabel(f),
    reason: f.reason,
    affectedRows: ctx.filterExcluded[i] ?? 0,
  }));

  const formulas: EvidenceFormula[] = plan.measures.map((m) => ({
    label: `${m.displayName}（${aggLabel(m.aggregation)}）`,
    expression: m.formula ?? `${m.aggregation}(${m.field})`,
    aggregation: m.aggregation,
  }));

  // 下钻：每个输出是否可下钻（有数据点 + 有有效行）；行数为有效行总数
  const drilldowns: DrilldownInfo[] = plan.outputs.map((out, i) => {
    const exec = ctx.results[i]?.execution;
    const hasData = Array.isArray(exec?.data) && (exec!.data as unknown[]).length > 0;
    return {
      resultId: out.id,
      title: out.label,
      available: hasData && ctx.effectiveRows.length > 0,
      rowCount: ctx.effectiveRows.length,
    };
  });

  // 质量提示：数据不足 / 空包 / 除零 / 不适用 / 未用列 / 过滤 0 排除 / 低置信覆盖
  const caveats: QualityCaveat[] = [];
  if (ctx.effectiveRows.length === 0) {
    caveats.push({ level: "attention", message: "没有满足过滤条件的有效数据，无法得出结论。" });
  }
  plan.outputs.forEach((out, i) => {
    const exec = ctx.results[i]?.execution;
    const hasData = Array.isArray(exec?.data) && (exec!.data as unknown[]).length > 0;
    if (!hasData) {
      caveats.push({
        level: "attention",
        message: `「${out.label}」无有效数据，无法得出结论（该字段可能为空或已被全部过滤）。`,
        affectedFieldIds: out.analysisDimension.fields.map((f) => `col-${dataset.headers.indexOf(f)}`),
      });
    }
    if (out.derivedColumns?.length && (ctx.derivedNonNull[out.id] ?? 0) === 0) {
      caveats.push({
        level: "advisory",
        message: `「${out.label}」的分母缺失或为 0，无法计算有效比率，相关计算已跳过。`,
      });
    }
  });
  plan.filters.forEach((f, i) => {
    if ((ctx.filterExcluded[i] ?? 0) === 0) {
      caveats.push({
        level: "advisory",
        message: `过滤条件「${f.reason || f.field}」未排除任何行（数据中可能没有对应取值）。`,
      });
    }
  });
  if (excludedColumnCount > 0) {
    const unused = dataset.headers.filter((h) => !usedFieldSet.has(h)).slice(0, 2);
    caveats.push({
      level: "advisory",
      message: `本次分析未使用 ${excludedColumnCount} 个字段${unused.length ? `（如 ${unused.join("、")}）` : ""}，如需纳入请在字段确认中调整。`,
    });
  }
  if (ctx.qualityContext) {
    for (const f of [...plan.dimensions, ...plan.measures]) {
      const conf = ctx.qualityContext.confidenceByName?.[f.field];
      const overridden = ctx.qualityContext.overrideByName?.[f.field];
      const idx = dataset.headers.indexOf(f.field);
      if (overridden && conf !== undefined && conf < PLAN_LOW_CONF_THRESHOLD) {
        caveats.push({
          level: "advisory",
          message: `「${f.field}」由你确认覆盖了低置信类型（原推断置信度 ${(conf * 100).toFixed(0)}%），数值准确性需留意。`,
          affectedFieldIds: [idx >= 0 ? `col-${idx}` : `derived-${f.field}`],
        });
      } else if (!overridden && conf !== undefined && conf < PLAN_LOW_CONF_THRESHOLD) {
        caveats.push({
          level: "advisory",
          message: `「${f.field}」类型识别置信度较低（${(conf * 100).toFixed(0)}%），分组口径可能受影响。`,
          affectedFieldIds: [idx >= 0 ? `col-${idx}` : `derived-${f.field}`],
        });
      }
    }
  }

  return {
    planId: plan.id,
    tableId: plan.tableId,
    sheetId: plan.sheetId,
    confirmationVersion: plan.confirmationVersion,
    actualSampleSize: ctx.effectiveRows.length,
    excludedRowCount: ctx.excludedRowCount,
    excludedColumnCount,
    usedFields,
    appliedFilters,
    calculation: { summary: [plan.description, ...plan.assumptions].join("；"), formulas },
    qualityCaveats: caveats,
    drilldowns,
  };
}

function filterLabel(f: PlanFilter): string {
  const v = f.value === null || f.value === undefined ? "" : String(f.value);
  switch (f.operator) {
    case "neq":
      return `${f.reason || `${f.field} ≠ ${v}`}`;
    case "eq":
      return `${f.reason || `${f.field} = ${v}`}`;
    case "not_null":
      return `${f.reason || `仅保留「${f.field}」非空`}`;
    case "is_null":
      return `${f.reason || `仅保留「${f.field}」为空`}`;
    default:
      return f.reason || `${f.field} ${f.operator} ${v}`;
  }
}
