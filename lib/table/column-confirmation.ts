/**
 * 表格分析 —— T1-D3 字段确认与数据质量前台化（纯逻辑层）
 *
 * 把「哪些字段需要用户确认」「数据质量问题如何分组成人话」「覆盖项如何校验与落库重画像」
 * 等可判定逻辑从组件/路由里抽出来，便于 validation-table-column-confirmation 复用同一套规则，
 * 也避免把复杂状态塞回单一 TableAnalysisPage。
 *
 * 约束（T1-D3，与 T1-D2 一致）：
 *  - 不调用 LLM、不发网络、不读库；
 *  - 不改动 parser/cleaner/profiler/type-inference/quality/sheet-recommender 算法（只消费其输出）；
 *  - 业务语言化：不向 UI 暴露 EffectiveDataset / inference confidence / Jaccard 等工程术语；
 *  - 覆盖只改「展示名 / 数据类型 / 是否纳入分析候选列」，绝不编辑单元格、删除真实记录、
 *    去重、修改原值、创建计算列；原始 rawSheet 始终保持非破坏性。
 */

import type {
  ColumnOverride,
  ColumnProfile,
  FieldType,
  QualityIssue,
  TableProfileResult,
} from "./types";
import { profileTable } from "./profiler";

/** 低置信阈值：低于此值的字段视为「系统不确定，需用户确认」 */
export const LOW_CONFIDENCE_THRESHOLD = 0.6;

/** 展示名最大长度（防滥用 / 存储膨胀） */
export const MAX_DISPLAY_NAME_LENGTH = 30;

/** 展示名非法字符（文件名禁用集，避免落库后路径/渲染异常） */
const ILLEGAL_DISPLAY_NAME_RE = /[<>:"/\\|?*\x00-\x1f]/;

/** FieldType 全量取值（运行时校验用；与 types.ts 的 FieldType 联合类型保持一致） */
export const FIELD_TYPE_VALUES: FieldType[] = [
  "boolean",
  "date",
  "integer",
  "float",
  "percentage",
  "currency",
  "category",
  "text",
  "id",
  "email",
  "url",
  "phone",
];

/** 用户可改的数据类型白名单（覆盖项 type 仅允许取这些；与 FieldType 对齐，未做裁剪） */
export const ALLOWED_OVERRIDE_TYPES: FieldType[] = FIELD_TYPE_VALUES;

/* ─────────────── 低置信字段判定 ─────────────── */

/** 单字段是否低置信（系统拿不准类型，默认回退为文本处理） */
export function isLowConfidenceField(col: ColumnProfile): boolean {
  if (!col.inference) return false;
  return col.inference.confidence < LOW_CONFIDENCE_THRESHOLD;
}

/** 列出画像中所有低置信字段（需用户确认的类型） */
export function listLowConfidenceFields(profile: TableProfileResult): ColumnProfile[] {
  return profile.columns.filter((c) => isLowConfidenceField(c as ColumnProfile));
}

/**
 * 是否「关键字段」候选：唯一标识型（整列唯一）或系统倾向识别为 id/date/currency 的列。
 * 关键字段一旦低置信，必须让用户确认类型，否则可能被错误回退为文本、导致分析失真。
 */
export function isKeyCandidate(col: ColumnProfile): boolean {
  if (col.isUnique && col.nonNullCount > 0) return true;
  const t = col.inference?.inferredType;
  return t === "id" || t === "date" || t === "currency";
}

/* ─────────────── 数据质量问题分组（人话） ─────────────── */

export type QualityGroup = "auto_handled" | "attention" | "advisory";

export interface QualityDisplayMeta {
  /** 展示分组 */
  group: QualityGroup;
  /** 业务语言标题（不含工程术语） */
  title: string;
  /** 系统当前如何处理 */
  currentHandling: string;
  /** 对分析的影响 */
  analysisImpact: string;
  /** 可执行动作文案（auto_handled 为 undefined，表示无需用户操作） */
  actionLabel?: string;
  /** 是否阻断「确认并开始分析」主按钮 */
  blocking: boolean;
}

/**
 * 各质量问题的业务化展示元数据。
 * 规则（T1-D3）：
 *  - auto_handled：空行/幽灵列等结构性问题，系统已自动裁剪，仅陈述「已处理」，不要求确认、不阻断；
 *  - attention：混合日期/金额格式，系统识别但不改写原值，提示影响，建议后续统一；
 *  - advisory：重复行/高缺失率，提示风险供用户判断，不自动去重/补全。
 */
export const QUALITY_META: Record<QualityIssue["code"], QualityDisplayMeta> = {
  EMPTY_ROWS_SKIPPABLE: {
    group: "auto_handled",
    title: "已自动排除空白行",
    currentHandling: "系统在分析前已自动跳过空行与格式残留行，不计入统计。",
    analysisImpact: "空白行不会影响任何指标，无需你额外处理。",
    blocking: false,
  },
  GHOST_COLUMNS_PRESENT: {
    group: "auto_handled",
    title: "已自动排除无效列",
    currentHandling: "系统已自动移除非业务的占位列（无真实表头），不参与分析。",
    analysisImpact: "无效列不会被任何维度或指标消费。",
    blocking: false,
  },
  MIXED_DATE_FORMAT: {
    group: "attention",
    title: "日期字段存在多种写法",
    currentHandling: "系统按标准格式识别日期，但不会自动改写你原始数据中的写法。",
    analysisImpact: "序列号、中文日期等混用可能导致按时间维度的分析出现偏差。",
    actionLabel: "建议后续统一为 ISO 标准日期（如 2026-08-27）",
    blocking: false,
  },
  MIXED_CURRENCY: {
    group: "attention",
    title: "金额字段混用多种币种",
    currentHandling: "系统仅识别币种符号，不会自动换算或改写原值。",
    analysisImpact: "混合币种直接求和会严重失真，金额类指标需谨慎解读。",
    actionLabel: "建议统一货币口径，或拆分为独立币种列",
    blocking: false,
  },
  DUPLICATE_ROWS: {
    group: "advisory",
    title: "存在完全重复的数据行",
    currentHandling: "系统不自动去重，保留所有原始行。",
    analysisImpact: "重复行会被重复计数，可能放大汇总类指标。",
    actionLabel: "建议分析前确认是否剔除重复行",
    blocking: false,
  },
  HIGH_NULL_RATIO: {
    group: "advisory",
    title: "部分字段缺失值较多",
    currentHandling: "系统保留空值（不参与聚合计算）。",
    analysisImpact: "缺失过多时该字段不宜作为主要分析维度，结论代表性有限。",
    actionLabel: "建议补全数据，或从分析中排除该列",
    blocking: false,
  },
};

/** 取单条质量问题的展示元数据（未知 code 兜底为 advisory） */
export function qualityMeta(issue: QualityIssue): QualityDisplayMeta {
  return (
    QUALITY_META[issue.code] ?? {
      group: "advisory",
      title: issue.message || "数据质量提示",
      currentHandling: "系统已记录该提示，供你参考。",
      analysisImpact: "可能影响相关分析结论的代表性或准确性。",
      actionLabel: "建议结合业务判断是否需要处理",
      blocking: false,
    }
  );
}

/** 按分组归类质量问题（供 UI 三段式展示） */
export function groupQualityIssues(issues: QualityIssue[]): Record<QualityGroup, QualityIssue[]> {
  const out: Record<QualityGroup, QualityIssue[]> = {
    auto_handled: [],
    attention: [],
    advisory: [],
  };
  for (const it of issues) out[qualityMeta(it).group].push(it);
  return out;
}

/* ─────────────── 阻断判定（主按钮可用性） ─────────────── */

export interface BlockingResult {
  /** 是否阻断「确认并开始分析」 */
  blocked: boolean;
  /** 阻断原因（人话，供 UI 提示） */
  reasons: string[];
}

/**
 * 判断当前是否应阻断主按钮。
 * 规则（T1-D3）：仅当「未获用户覆盖的低置信关键字段」存在时阻断；
 * 其余质量警告（含混合日期/币种、重复行、高缺失、空行、幽灵列）均不阻断。
 * 预留：若未来出现 severity=error 的质量问题，也会阻断（当前 quality 模块仅产 warning）。
 */
export function evaluateBlocking(
  profile: TableProfileResult,
  qualityIssues: QualityIssue[],
  overrides?: Record<number, ColumnOverride>,
): BlockingResult {
  const reasons: string[] = [];

  // 1) 未确认的低置信关键字段 → 阻断
  const low = listLowConfidenceFields(profile);
  for (const col of low) {
    if (overrides && overrides[col.index]) continue; // 用户已做决定，视为已确认
    if (isKeyCandidate(col)) {
      reasons.push(`字段「${col.name}」系统无法确定其类型（疑似关键标识），请先确认它应作为什么类型`);
    }
  }

  // 2) 预留：error 级质量问题 → 阻断
  for (const it of qualityIssues) {
    if (it.severity === "error") {
      reasons.push(qualityMeta(it).title);
    }
  }

  return { blocked: reasons.length > 0, reasons };
}

/* ─────────────── 覆盖项校验 ─────────────── */

export interface ValidateOverridesParams {
  /** 当前 session 当前 Sheet 的有效列数（覆盖项列下标必须落在 [0, columnCount)） */
  columnCount: number;
  columnOverrides?: Record<number, ColumnOverride>;
  /** 用户确认纳入分析的列下标集合（undefined 表示全部纳入） */
  confirmedColumns?: number[];
}

export interface ValidateOverridesResult {
  ok: boolean;
  /** 统一错误码（与 API 响应码一致） */
  errorCode?: "invalid_column" | "invalid_override";
  /** 越界 / 非法的列下标 */
  invalidColumnIds: number[];
  messages: string[];
}

/**
 * 校验字段覆盖项（服务端 + 客户端共用）。
 * 不抛异常，返回结构化结果，便于 API 直接映射错误码。
 */
export function validateColumnOverrides(params: ValidateOverridesParams): ValidateOverridesResult {
  const { columnCount, columnOverrides, confirmedColumns } = params;
  const invalidColumnIds: number[] = [];
  const messages: string[] = [];

  // 1) 列下标边界（覆盖项 + 确认列集合）
  const checkRange = (ids: number[], label: string) => {
    for (const id of ids) {
      if (!Number.isInteger(id) || id < 0 || id >= columnCount) {
        if (!invalidColumnIds.includes(id)) invalidColumnIds.push(id);
        messages.push(`${label} 引用了不存在的列 #${id}（有效范围 0~${columnCount - 1}）`);
      }
    }
  };
  if (columnOverrides) checkRange(Object.keys(columnOverrides).map(Number), "字段覆盖");
  if (confirmedColumns) checkRange(confirmedColumns, "确认列集合");

  if (invalidColumnIds.length > 0) {
    return { ok: false, errorCode: "invalid_column", invalidColumnIds, messages };
  }

  // 2) 覆盖项内容（类型枚举 + 展示名约束）
  if (columnOverrides) {
    for (const [rawId, ov] of Object.entries(columnOverrides)) {
      const id = Number(rawId);
      if (ov.type !== undefined && !FIELD_TYPE_VALUES.includes(ov.type)) {
        if (!invalidColumnIds.includes(id)) invalidColumnIds.push(id);
        messages.push(`列 #${id} 的数据类型「${ov.type}」不在允许范围内`);
      }
      if (ov.displayName !== undefined) {
        const name = ov.displayName.trim();
        if (name.length === 0) {
          messages.push(`列 #${id} 的展示名不能为空`);
        } else if (name.length > MAX_DISPLAY_NAME_LENGTH) {
          messages.push(`列 #${id} 的展示名过长（≤${MAX_DISPLAY_NAME_LENGTH} 字）`);
        } else if (ILLEGAL_DISPLAY_NAME_RE.test(name)) {
          messages.push(`列 #${id} 的展示名含非法字符`);
        }
      }
      if (messages.length > 0) {
        return { ok: false, errorCode: "invalid_override", invalidColumnIds, messages };
      }
    }
  }

  return { ok: true, invalidColumnIds: [], messages: [] };
}

/* ─────────────── 覆盖项应用 + 重画像 ─────────────── */

export interface ApplyOverridesParams {
  /** 当前 session 缓存的有效表头（清洗后） */
  headers: string[];
  /** 当前 session 缓存的有效数据行（对齐 headers） */
  rows: unknown[][];
  /** 当前 session 缓存的列类型 */
  columnTypes: FieldType[];
  /** 工作表名（用于重画像标注） */
  sheetName?: string;
  columnOverrides?: Record<number, ColumnOverride>;
  /** 确认纳入分析的列下标集合（undefined=全部纳入；[]=用户明确排除所有列） */
  confirmedColumns?: number[];
}

export interface ApplyOverridesResult {
  headers: string[];
  rows: unknown[][];
  columnTypes: FieldType[];
  /** 基于覆盖后的有效集重画像结果（分析/LLM/图表消费此 profile） */
  profile: TableProfileResult;
}

/**
 * 应用字段覆盖并基于现有有效数据集重画像。
 *
 * 关键不变量：
 *  - 不修改 rawSheet / 原始业务数据，仅对「已缓存的有效集」做展示级变换；
 *  - 覆盖顺序：先按列下标应用「重命名 + 类型覆盖」，再按 confirmedColumns 过滤列；
 *  - 过滤后列下标重新连续编号，再调用既有 profileTable 重画像（不改动 profiler 算法）；
 *  - 覆盖后的列名写回 profile.name；originalName 保留为覆盖前原始表头（便于展示溯源）。
 *
 * @returns 新的 headers/rows/columnTypes + 重画像 profile，可直接 updateTableCache + 返回前端。
 */
export function applyColumnOverrides(params: ApplyOverridesParams): ApplyOverridesResult {
  const {
    headers,
    rows,
    columnTypes,
    sheetName,
    columnOverrides,
    confirmedColumns,
  } = params;

  const n = headers.length;

  // 1) 应用展示名 + 类型覆盖（基于原始列下标，过滤前）
  const workHeaders = headers.map((h, i) =>
    columnOverrides && columnOverrides[i]?.displayName?.trim()
      ? columnOverrides[i].displayName!.trim()
      : h,
  );
  const workTypes = columnTypes.map((t, i) =>
    columnOverrides && columnOverrides[i]?.type ? columnOverrides[i].type! : t,
  );
  const originalHeaders = headers.slice();

  // 2) 确定保留列下标
  const keptIndices =
    confirmedColumns === undefined
      ? Array.from({ length: n }, (_, i) => i)
      : confirmedColumns.filter((i) => i >= 0 && i < n).sort((a, b) => a - b);

  // 3) 过滤列（表头 / 类型 / 原始名 / 数据行）
  const newHeaders = keptIndices.map((i) => workHeaders[i]);
  const newTypes = keptIndices.map((i) => workTypes[i]);
  const newOriginal = keptIndices.map((i) => originalHeaders[i]);
  const newRows = rows.map((r) => keptIndices.map((i) => r[i]));

  // 4) 基于既有 profiler 重画像（不改动算法）
  const profile = profileTable(newHeaders, newRows, newTypes, sheetName);

  // 5) 还原 originalName 为覆盖前原始表头（便于 UI 溯源；name 用覆盖后展示名）
  profile.columns.forEach((c, idx) => {
    (c as ColumnProfile).originalName = newOriginal[idx];
  });

  return {
    headers: newHeaders,
    rows: newRows,
    columnTypes: newTypes,
    profile,
  };
}
