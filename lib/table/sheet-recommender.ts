/**
 * 表格处理板块 —— Sheet 推荐与表头确认策略（T1-D1，纯规则模块）
 *
 * 产品目标：上传工作簿后准确区分「主数据 / 次数据 / 汇总 / 备注」Sheet；
 * 当表头不确定时明确要求用户确认，而不是错误地直接进入后续分析。
 *
 * 设计铁律：
 *  - 纯规则、可解释、集中配置、稳定排序（同一输入永远得到同一输出）；
 *  - 输入仅为单个 Sheet 的「解析 / 清洗 / 画像摘要」：EffectiveDataset（有效行列边界）
 *    + 前若干行原始预览（仅用于表头候选评估）+ 可选 TableProfileResult；
 *  - 不调用 LLM、不发网络请求、不读数据库、不读其他用户数据、不扫描原始全量文本；
 *  - 绝不自动合并任何 Sheet：recommendSheets 输入 N 个 Sheet 必产出 N 条推荐，一一对应；
 *  - 不修改 detectHeaderRow / cleaner / profiler / 类型推断 / 质量清理逻辑：
 *    表头置信度在本模块内独立复算，只用于「是否需要用户确认」的判断；
 *  - 输出只含统计摘要与可解释理由，不承载单元格原文（避免样本/敏感数据泄露）。
 */

import type {
  EffectiveDataset,
  FieldType,
  HeaderCandidate,
  SheetHeaderAssessment,
  SheetInfo,
  SheetRecommendation,
  SheetRecommendationMetrics,
  SheetRole,
  TableProfileResult,
} from "./types";

/* ─────────────── 集中配置：评分权重 ─────────────── */

/**
 * 推荐总分权重（满分裁剪到 100）。所有魔法数字集中此处，便于调参与在报告中列表呈现。
 */
export const SHEET_RECOMMENDER_WEIGHTS = {
  /** 表头明确且高置信度：HEADER_CONFIDENCE × headerConfidence */
  HEADER_CONFIDENCE: 25,
  /** 有效行数分档（自上而下命中即止） */
  ROW_TIERS: [
    { min: 50, score: 20 },
    { min: 10, score: 14 },
    { min: 4, score: 8 },
    { min: 2, score: 3 },
  ],
  /** 有效列数分档（自上而下命中即止） */
  COLUMN_TIERS: [
    { min: 4, score: 12 },
    { min: 3, score: 8 },
    { min: 2, score: 4 },
  ],
  /** 可分析字段「存在性」加分（同类多列不重复累加） */
  FIELD_PRESENCE: { date: 8, numeric: 10, category: 6, id: 6 },
  /** 可分析字段占比加分：FIELD_RATIO × (可分析列 / 有效列) */
  FIELD_RATIO: 8,
  /** 字段维度合计上限（存在性 + 占比） */
  FIELD_CAP: 30,
  /** 行列结构稳定性加分：STABILITY × rowFillStability */
  STABILITY: 10,
  /** 降分：Sheet 名含备注/说明语义 */
  PENALTY_NAME_NOTES: 40,
  /** 降分：Sheet 名含汇总/概览语义 */
  PENALTY_NAME_SUMMARY: 30,
  /** 降分：有效行数过少（< MIN_ANALYZABLE_ROWS） */
  PENALTY_FEW_ROWS: 15,
  /** 降分：仅文本字段（无任何可分析字段） */
  PENALTY_TEXT_ONLY: 25,
  /** 降分：表头置信度低（< HEADER_CONFIDENCE_MEDIUM） */
  PENALTY_LOW_HEADER_CONFIDENCE: 15,
  /** 降分：空值比例极高（≥ NULL_RATIO_HIGH） */
  PENALTY_HIGH_NULL: 15,
  /** 降分：空值比例偏高（≥ NULL_RATIO_MID） */
  PENALTY_MID_NULL: 7,
} as const;

/** 判定阈值集中配置 */
export const SHEET_RECOMMENDER_THRESHOLDS = {
  /** 表头候选扫描行数（仅看前若干行预览，不扫全量） */
  HEAD_ROWS: 10,
  /** 空值率/稳定性采样行数上限（确定性：固定取前 N 行） */
  SCAN_ROWS: 500,
  /** 可分析所需最小有效行数 */
  MIN_ANALYZABLE_ROWS: 3,
  /** primary_data 所需最小有效行数 */
  PRIMARY_MIN_ROWS: 4,
  /** primary_data 所需最小有效列数 */
  PRIMARY_MIN_COLUMNS: 2,
  /** primary_data 所需最低总分 */
  PRIMARY_MIN_SCORE: 60,
  /** secondary_data 所需最低总分 */
  SECONDARY_MIN_SCORE: 30,
  /** 表头高置信门槛 */
  HEADER_CONFIDENCE_HIGH: 0.8,
  /** 表头中置信门槛（低于此值视为低置信度 → 必须确认） */
  HEADER_CONFIDENCE_MEDIUM: 0.6,
  /** 表头候选竞争容差：最佳与次佳分差低于此值视为「多候选」 */
  HEADER_AMBIGUOUS_MARGIN: 0.08,
  /** 多候选时的置信度折扣 */
  HEADER_MARGIN_DISCOUNT: 0.6,
  /** 与既有 detectHeaderRow 结果不一致时的置信度折扣 */
  HEADER_MISMATCH_DISCOUNT: 0.7,
  /** 空值比例：极高 */
  NULL_RATIO_HIGH: 0.6,
  /** 空值比例：偏高 */
  NULL_RATIO_MID: 0.4,
  /** 表头标签合理长度上限（超长更像正文而非表头） */
  MAX_HEADER_LABEL_LENGTH: 30,
} as const;

/** 表头候选打分权重（各项之和 = 1，输出 0~1） */
export const HEADER_CANDIDATE_WEIGHTS = {
  /** 非空率（按全表最大列宽归一化，避免单元素说明行虚高） */
  NON_EMPTY: 0.3,
  /** 非数据形态率（表头应为文本，不应是数字/日期/金额） */
  TEXTUAL: 0.25,
  /** 唯一率（表头不应重复） */
  UNIQUE: 0.15,
  /** 短标签率（表头通常简短） */
  SHORT: 0.05,
  /** 与下一行的数据形态反差（下一行越像数据，本行越像表头） */
  CONTRAST: 0.15,
  /** 纯文本奖励（本行完全不含数据形态值时的二元加分） */
  PURE_TEXT_BONUS: 0.1,
} as const;

/** Sheet 名称语义词表（集中维护；命中即决定 summary / notes 角色） */
export const SHEET_NAME_HINTS = {
  notes: [
    "notes",
    "note",
    "readme",
    "instructions",
    "备注",
    "说明",
    "说明书",
    "字段说明",
    "填写说明",
    "须知",
    "免责声明",
    "disclaimer",
  ],
  summary: [
    "summary",
    "overview",
    "dashboard",
    "kpi",
    "汇总",
    "概览",
    "总览",
    "摘要",
    "总计",
    "统计汇总",
  ],
} as const;

/* ─────────────── 值形态判定（只看形态，不落库、不外传） ─────────────── */

const NUMERIC_LIKE_RE = /^[-+]?[¥$€£￥]?\s*\d[\d,\s]*(\.\d+)?\s*%?$/;
const DATE_LIKE_RE = /^\d{4}[-/.]\d{1,2}([-/.]\d{1,2})?([ T]\d{1,2}:\d{2})?$/;
const ID_LIKE_RE = /^[A-Za-z]{1,8}[-_]?\d{1,12}$/;
const EXCEL_SERIAL_LIKE_RE = /^\d{4,5}(\.\d+)?$/;

/** 该单元格是否呈现「数据形态」（数字 / 日期 / 金额 / 序列号 / ID 编码） */
function isDataLikeCell(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "number") return true;
  if (v instanceof Date) return true;
  const s = String(v).trim();
  if (s === "") return false;
  return (
    NUMERIC_LIKE_RE.test(s) ||
    DATE_LIKE_RE.test(s) ||
    EXCEL_SERIAL_LIKE_RE.test(s) ||
    ID_LIKE_RE.test(s)
  );
}

function isBlankCell(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === "";
}

function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n;
}

function round(n: number, digits = 3): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** 名称归一化（小写、去空白与标点），用于语义词命中 */
function normalizeSheetName(name: string): string {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/** Sheet 名称语义命中结果 */
export type SheetNameHint = "notes" | "summary" | null;

/** 判定 Sheet 名称语义（notes 优先于 summary） */
export function detectSheetNameHint(name: string): {
  hint: SheetNameHint;
  matched: string | null;
} {
  const n = normalizeSheetName(name);
  if (!n) return { hint: null, matched: null };
  for (const w of SHEET_NAME_HINTS.notes) {
    if (n.includes(normalizeSheetName(w))) return { hint: "notes", matched: w };
  }
  for (const w of SHEET_NAME_HINTS.summary) {
    if (n.includes(normalizeSheetName(w))) return { hint: "summary", matched: w };
  }
  return { hint: null, matched: null };
}

/* ─────────────── 表头候选评估（不修改 detectHeaderRow） ─────────────── */

/**
 * 构造表头候选评估所需的「前若干行原始预览」。
 *
 * 坐标系与 cleaner 保持一致：allRows = [parser 表头行(若有), ...数据行]，
 * 因此下标可直接与 EffectiveDataset.detectedHeaderRow 比较。
 */
export function buildHeadRows(
  sheet: SheetInfo,
  maxRows: number = SHEET_RECOMMENDER_THRESHOLDS.HEAD_ROWS,
): unknown[][] {
  const hasHeader = Array.isArray(sheet.headers) && sheet.headers.length > 0;
  const all: unknown[][] = [
    ...(hasHeader ? [sheet.headers as unknown[]] : []),
    ...(Array.isArray(sheet.rows) ? sheet.rows : []),
  ];
  return all.slice(0, Math.max(1, maxRows));
}

/** 单个候选行的「表头样貌」得分（0~1） */
export function scoreHeaderCandidate(
  row: unknown[],
  next: unknown[] | undefined,
  maxWidth: number,
): number {
  const w = HEADER_CANDIDATE_WEIGHTS;
  const width = Math.max(1, maxWidth);
  const cells = Array.isArray(row) ? row : [];
  const nonBlank = cells.filter((c) => !isBlankCell(c));
  const nonEmptyRate = clamp(nonBlank.length / width, 0, 1);
  if (nonBlank.length === 0) return 0;

  const dataLikeCount = nonBlank.filter((c) => isDataLikeCell(c)).length;
  const textualRate = 1 - dataLikeCount / nonBlank.length;

  const seen = new Set<string>();
  for (const c of nonBlank) seen.add(String(c).trim());
  const uniqueRate = seen.size / nonBlank.length;

  const shortRate =
    nonBlank.filter(
      (c) => String(c).trim().length <= SHEET_RECOMMENDER_THRESHOLDS.MAX_HEADER_LABEL_LENGTH,
    ).length / nonBlank.length;

  let contrast = 0;
  if (Array.isArray(next) && next.length > 0) {
    const nextNonBlank = next.filter((c) => !isBlankCell(c));
    if (nextNonBlank.length > 0) {
      contrast = nextNonBlank.filter((c) => isDataLikeCell(c)).length / nextNonBlank.length;
    }
  }

  const pureText = dataLikeCount === 0 && nonBlank.length >= 2 ? 1 : 0;

  return (
    nonEmptyRate * w.NON_EMPTY +
    textualRate * w.TEXTUAL +
    uniqueRate * w.UNIQUE +
    shortRate * w.SHORT +
    contrast * w.CONTRAST +
    pureText * w.PURE_TEXT_BONUS
  );
}

/**
 * 独立评估表头位置与置信度（只读，不改动 detectHeaderRow 的结果）。
 *
 * 歧义（ambiguous）判定：低置信度 / 多候选竞争 / 与 detectHeaderRow 结果不一致 / 无有效列。
 * 歧义即意味着「必须由用户确认表头」，且不得标为可直接分析的 primary_data。
 */
export function assessSheetHeader(
  headRows: unknown[][],
  detectedHeaderRow: number,
  effectiveColumnCount: number,
): SheetHeaderAssessment {
  const th = SHEET_RECOMMENDER_THRESHOLDS;
  const rows = Array.isArray(headRows) ? headRows.slice(0, th.HEAD_ROWS) : [];
  const maxWidth = Math.max(1, ...rows.map((r) => (Array.isArray(r) ? r.length : 0)));

  let bestRow = 0;
  let bestScore = -1;
  let secondScore = -1;
  for (let i = 0; i < rows.length; i++) {
    const s = scoreHeaderCandidate(rows[i] || [], rows[i + 1], maxWidth);
    if (s > bestScore) {
      secondScore = bestScore;
      bestScore = s;
      bestRow = i;
    } else if (s > secondScore) {
      secondScore = s;
    }
  }
  if (bestScore < 0) bestScore = 0;
  const margin = secondScore < 0 ? bestScore : bestScore - secondScore;

  let confidence = clamp(bestScore, 0, 1);
  if (margin < th.HEADER_AMBIGUOUS_MARGIN) confidence *= th.HEADER_MARGIN_DISCOUNT;
  if (bestRow !== detectedHeaderRow) confidence *= th.HEADER_MISMATCH_DISCOUNT;
  if (effectiveColumnCount <= 0) confidence = 0;

  const ambiguous =
    effectiveColumnCount <= 0 ||
    confidence < th.HEADER_CONFIDENCE_MEDIUM ||
    margin < th.HEADER_AMBIGUOUS_MARGIN ||
    bestRow !== detectedHeaderRow;

  return {
    detectedHeaderRow,
    bestCandidateRow: bestRow,
    confidence: round(clamp(confidence, 0, 1)),
    margin: round(clamp(margin, 0, 1)),
    ambiguous,
    headerRowIsFirstRow: detectedHeaderRow === 0,
  };
}

/**
 * 预计算可选表头候选（T1-D2 前端确认面板用）：仅扫描前若干行（与 assessSheetHeader 同一窗口），
 * 不依赖 LLM、不落库。返回按表头样貌得分降序的候选列表（最多 maxCandidates 个），
 * 供用户在确认面板点击切换、静态预览「以某行作为表头时长什么样」。
 */
export function listHeaderCandidates(
  sheet: SheetInfo,
  maxCandidates = 8,
  maxRows: number = SHEET_RECOMMENDER_THRESHOLDS.HEAD_ROWS,
): HeaderCandidate[] {
  const headRows = buildHeadRows(sheet, maxRows);
  const maxWidth = Math.max(1, ...headRows.map((r) => (Array.isArray(r) ? r.length : 0)));
  const candidates: HeaderCandidate[] = [];
  for (let i = 0; i < headRows.length; i++) {
    const row = Array.isArray(headRows[i]) ? headRows[i] : [];
    const nonBlank = row.filter((c) => !isBlankCell(c)).length;
    if (nonBlank < 2) continue; // 过于稀疏，不像表头
    const score = scoreHeaderCandidate(row, headRows[i + 1], maxWidth);
    candidates.push({
      rowIndex: i,
      headerNames: row.slice(0, 8).map((c) => (c == null ? "" : String(c))),
      sampleRows: (headRows.slice(i + 1, i + 1 + 10) as unknown[][]).map((r) =>
        Array.isArray(r) ? r.slice(0, 8) : [],
      ),
      score: round(clamp(score, 0, 1)),
    });
  }
  candidates.sort((a, b) => b.score - a.score || a.rowIndex - b.rowIndex);
  return candidates.slice(0, maxCandidates);
}

/* ─────────────── 字段与结构统计摘要 ─────────────── */

const NUMERIC_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
  "integer",
  "float",
  "currency",
  "percentage",
]);
const CATEGORY_TYPES: ReadonlySet<FieldType> = new Set<FieldType>(["category", "boolean"]);

function buildMetrics(
  ds: EffectiveDataset,
  profile?: TableProfileResult,
): SheetRecommendationMetrics {
  const th = SHEET_RECOMMENDER_THRESHOLDS;
  const cols = Array.isArray(ds.columns) ? ds.columns : [];
  let dateColumnCount = 0;
  let numericColumnCount = 0;
  let categoryColumnCount = 0;
  let idColumnCount = 0;
  for (const t of cols) {
    if (t === "date") dateColumnCount++;
    else if (NUMERIC_TYPES.has(t)) numericColumnCount++;
    else if (CATEGORY_TYPES.has(t)) categoryColumnCount++;
    else if (t === "id") idColumnCount++;
  }
  const analyzableColumnCount =
    dateColumnCount + numericColumnCount + categoryColumnCount + idColumnCount;

  // 空值比例：优先用同一 dataset 的画像（更精确），否则在有效集内固定采样前 N 行
  const scanRows = ds.rows.slice(0, th.SCAN_ROWS);
  let nullRatio = 0;
  if (profile && profile.columns.length > 0) {
    const mean =
      profile.columns.reduce((a, c) => a + (Number.isFinite(c.nonNullRate) ? c.nonNullRate : 0), 0) /
      profile.columns.length;
    nullRatio = clamp(1 - mean, 0, 1);
  } else if (scanRows.length > 0 && ds.effectiveColumnCount > 0) {
    let blanks = 0;
    for (const r of scanRows) {
      for (let i = 0; i < ds.effectiveColumnCount; i++) if (isBlankCell(r[i])) blanks++;
    }
    nullRatio = clamp(blanks / (scanRows.length * ds.effectiveColumnCount), 0, 1);
  }

  // 行填充稳定性：各行非空率的一致程度（标准差越小越像规整明细表）
  let rowFillStability = 1;
  if (scanRows.length > 1 && ds.effectiveColumnCount > 0) {
    const fills = scanRows.map((r) => {
      let n = 0;
      for (let i = 0; i < ds.effectiveColumnCount; i++) if (!isBlankCell(r[i])) n++;
      return n / ds.effectiveColumnCount;
    });
    const mean = fills.reduce((a, b) => a + b, 0) / fills.length;
    const variance = fills.reduce((a, b) => a + (b - mean) ** 2, 0) / fills.length;
    rowFillStability = clamp(1 - Math.sqrt(variance) * 2, 0, 1);
  }

  return {
    effectiveRowCount: ds.effectiveRowCount,
    effectiveColumnCount: ds.effectiveColumnCount,
    analyzableColumnCount,
    dateColumnCount,
    numericColumnCount,
    categoryColumnCount,
    idColumnCount,
    textOnly: analyzableColumnCount === 0,
    nullRatio: round(nullRatio),
    rowFillStability: round(rowFillStability),
    excludedRowCount: ds.excludedRows?.length ?? 0,
    excludedColumnCount: ds.excludedColumns?.length ?? 0,
  };
}

function tierScore(value: number, tiers: ReadonlyArray<{ min: number; score: number }>): number {
  for (const t of tiers) if (value >= t.min) return t.score;
  return 0;
}

/* ─────────────── 推荐主流程 ─────────────── */

/** 单 Sheet 推荐输入（仅摘要，不含全量原始文本） */
export interface SheetRecommendationInput {
  /** 有效数据集边界（唯一事实源；不得绕过其有效行列边界） */
  dataset: EffectiveDataset;
  /** 前若干行原始预览（与 detectedHeaderRow 同坐标系），仅用于表头候选评估 */
  headRows?: unknown[][];
  /** 可选：来自同一 dataset 的画像（提供时用其 nonNullRate 计算空值比例） */
  profile?: TableProfileResult;
}

/** 从 SheetInfo + EffectiveDataset 组装推荐输入（便捷入口） */
export function buildSheetRecommendationInput(
  sheet: SheetInfo,
  dataset: EffectiveDataset,
  profile?: TableProfileResult,
): SheetRecommendationInput {
  return { dataset, headRows: buildHeadRows(sheet), profile };
}

function decideRole(
  hint: SheetNameHint,
  score: number,
  metrics: SheetRecommendationMetrics,
  header: SheetHeaderAssessment,
): SheetRole {
  const th = SHEET_RECOMMENDER_THRESHOLDS;
  // 名称语义命中：直接归入非明细角色（不参与 primary/secondary 竞争）
  if (hint === "notes") return "notes";
  if (hint === "summary") return "summary";

  // 纯文本（无任何可分析字段）：一律不得作为 primary_data
  if (metrics.textOnly) {
    return metrics.effectiveRowCount >= th.MIN_ANALYZABLE_ROWS && score >= th.SECONDARY_MIN_SCORE
      ? "secondary_data"
      : "unknown";
  }

  // 表头歧义（低置信 / 多候选 / 无明确表头）：必须先确认表头，不得 primary_data
  if (header.ambiguous) {
    return score >= th.SECONDARY_MIN_SCORE && metrics.effectiveRowCount >= th.MIN_ANALYZABLE_ROWS
      ? "secondary_data"
      : "unknown";
  }

  const structureOk =
    metrics.effectiveRowCount >= th.PRIMARY_MIN_ROWS &&
    metrics.effectiveColumnCount >= th.PRIMARY_MIN_COLUMNS;
  if (score >= th.PRIMARY_MIN_SCORE && structureOk) return "primary_data";
  if (score >= th.SECONDARY_MIN_SCORE && metrics.effectiveRowCount >= th.MIN_ANALYZABLE_ROWS)
    return "secondary_data";
  return "unknown";
}

/**
 * 单个 Sheet 推荐（纯函数）。rank 固定为 0，需经 recommendSheets 稳定排序后赋值。
 */
export function recommendSheet(input: SheetRecommendationInput): SheetRecommendation {
  const W = SHEET_RECOMMENDER_WEIGHTS;
  const th = SHEET_RECOMMENDER_THRESHOLDS;
  const ds = input.dataset;
  const metrics = buildMetrics(ds, input.profile);
  const headRows = input.headRows ?? [];
  const header = assessSheetHeader(headRows, ds.detectedHeaderRow, ds.effectiveColumnCount);
  const { hint, matched } = detectSheetNameHint(ds.sheetName);

  const reasons: string[] = [];

  /* ① 加分：表头置信度 */
  const headerScore = W.HEADER_CONFIDENCE * header.confidence;
  if (header.headerRowIsFirstRow) {
    reasons.push(
      `表头位于第 1 行，识别置信度 ${header.confidence}（候选分差 ${header.margin}）`,
    );
  } else {
    reasons.push(
      `表头不在首行：识别到表头位于第 ${header.detectedHeaderRow + 1} 行（其上 ${header.detectedHeaderRow} 行为前置说明/标题行），` +
        `独立复算最佳候选=第 ${header.bestCandidateRow + 1} 行，置信度 ${header.confidence}（候选分差 ${header.margin}）`,
    );
  }

  /* ② 加分：行列规模 */
  const rowScore = tierScore(metrics.effectiveRowCount, W.ROW_TIERS);
  const colScore = tierScore(metrics.effectiveColumnCount, W.COLUMN_TIERS);
  reasons.push(
    `有效数据 ${metrics.effectiveRowCount} 行 × ${metrics.effectiveColumnCount} 列` +
      (metrics.excludedRowCount || metrics.excludedColumnCount
        ? `（已排除 ${metrics.excludedRowCount} 空行 / ${metrics.excludedColumnCount} 幽灵列）`
        : ""),
  );

  /* ③ 加分：可分析字段 */
  let fieldScore = 0;
  if (metrics.dateColumnCount > 0) fieldScore += W.FIELD_PRESENCE.date;
  if (metrics.numericColumnCount > 0) fieldScore += W.FIELD_PRESENCE.numeric;
  if (metrics.categoryColumnCount > 0) fieldScore += W.FIELD_PRESENCE.category;
  if (metrics.idColumnCount > 0) fieldScore += W.FIELD_PRESENCE.id;
  const analyzableRatio =
    metrics.effectiveColumnCount > 0
      ? metrics.analyzableColumnCount / metrics.effectiveColumnCount
      : 0;
  fieldScore = Math.min(W.FIELD_CAP, fieldScore + W.FIELD_RATIO * analyzableRatio);
  if (metrics.analyzableColumnCount > 0) {
    reasons.push(
      `含可分析字段：日期 ${metrics.dateColumnCount} / 数值 ${metrics.numericColumnCount} / ` +
        `分类 ${metrics.categoryColumnCount} / ID ${metrics.idColumnCount}（占比 ${Math.round(analyzableRatio * 100)}%）`,
    );
  }

  /* ④ 加分：结构稳定性 */
  const stabilityScore = W.STABILITY * metrics.rowFillStability;

  /* ⑤ 降分项 */
  let penalty = 0;
  if (hint === "notes") {
    penalty += W.PENALTY_NAME_NOTES;
    reasons.push(`Sheet 名称含备注/说明语义（“${matched}”），判定为说明表而非数据表`);
  } else if (hint === "summary") {
    penalty += W.PENALTY_NAME_SUMMARY;
    reasons.push(`Sheet 名称含汇总/概览语义（“${matched}”），判定为汇总表而非明细数据`);
  }
  if (metrics.effectiveRowCount < th.MIN_ANALYZABLE_ROWS) {
    penalty += W.PENALTY_FEW_ROWS;
    reasons.push(`有效行数过少（${metrics.effectiveRowCount} < ${th.MIN_ANALYZABLE_ROWS}），不足以支撑分析`);
  }
  if (metrics.textOnly) {
    penalty += W.PENALTY_TEXT_ONLY;
    reasons.push("无可分析字段（全部为文本类），不得作为主数据 Sheet");
  }
  if (header.confidence < th.HEADER_CONFIDENCE_MEDIUM) {
    penalty += W.PENALTY_LOW_HEADER_CONFIDENCE;
    reasons.push(`表头置信度低（${header.confidence} < ${th.HEADER_CONFIDENCE_MEDIUM}）`);
  }
  if (metrics.nullRatio >= th.NULL_RATIO_HIGH) {
    penalty += W.PENALTY_HIGH_NULL;
    reasons.push(`空值比例极高（${Math.round(metrics.nullRatio * 100)}%）`);
  } else if (metrics.nullRatio >= th.NULL_RATIO_MID) {
    penalty += W.PENALTY_MID_NULL;
    reasons.push(`空值比例偏高（${Math.round(metrics.nullRatio * 100)}%）`);
  }

  const score = round(
    clamp(headerScore + rowScore + colScore + fieldScore + stabilityScore - penalty, 0, 100),
    1,
  );

  /* ⑥ 表头确认策略：歧义 或 表头非首行 → 必须由用户确认 */
  const requiresHeaderConfirmation = header.ambiguous || !header.headerRowIsFirstRow;
  if (requiresHeaderConfirmation) {
    if (header.ambiguous && !header.headerRowIsFirstRow) {
      reasons.push("需用户确认表头：表头非首行且候选存在歧义");
    } else if (header.ambiguous) {
      reasons.push("需用户确认表头：表头候选存在竞争或置信度不足");
    } else {
      reasons.push("需用户确认表头：表头非首行（偏移量需确认后再进入分析）");
    }
  }

  const role = decideRole(hint, score, metrics, header);

  /* ⑦ 判定置信度：表头置信度 + 可分析字段覆盖 + 规模饱和度；命名命中则该角色证据很强 */
  const sizeSat =
    0.5 * clamp(metrics.effectiveRowCount / 10, 0, 1) +
    0.5 * clamp(metrics.effectiveColumnCount / 5, 0, 1);
  let confidence = clamp(
    0.45 * header.confidence + 0.3 * clamp(analyzableRatio, 0, 1) + 0.25 * sizeSat,
    0,
    1,
  );
  if (hint) confidence = Math.max(confidence, 0.85);

  const roleLabel: Record<SheetRole, string> = {
    primary_data: "主数据 Sheet（可直接分析）",
    secondary_data: "次数据 Sheet（可分析，建议先确认表头/字段）",
    summary: "汇总 Sheet（不适合作为明细分析对象）",
    notes: "备注/说明 Sheet（非结构化数据）",
    unknown: "无法判断（结构不足）",
  };
  reasons.push(`判定：${roleLabel[role]}，得分 ${score}`);

  return {
    sheetId: ds.sheetId,
    sheetName: ds.sheetName,
    role,
    score,
    confidence: round(confidence),
    reasons,
    requiresHeaderConfirmation,
    recommended: role === "primary_data" || role === "secondary_data",
    rank: 0,
    header,
    metrics,
  };
}

/**
 * 多 Sheet 推荐（稳定排序，绝不合并）。
 *
 * 排序键：score 降序 → confidence 降序 → sheetName 码点升序（确定性，不依赖输入顺序与 locale）。
 * 输入 N 个 Sheet 必输出 N 条推荐，sheetId 一一对应，不新增、不裁剪、不合并。
 */
export function recommendSheets(inputs: SheetRecommendationInput[]): SheetRecommendation[] {
  const list = (Array.isArray(inputs) ? inputs : []).map((i) => recommendSheet(i));
  list.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (a.sheetName === b.sheetName) return 0;
    return a.sheetName < b.sheetName ? -1 : 1;
  });
  return list.map((r, i) => ({ ...r, rank: i + 1 }));
}
