/**
 * 表格金标样本 —— Expected Contract 类型定义（金标，不可为迁就现状而降低标准）
 *
 * 本文件是 T0「表格金标样本 + 确定性解析基线」支线的共享契约。
 * - 被 scripts/generate-table-fixtures.mts（生成器说明）与
 *   scripts/validation-table-baseline.mts（验证脚本）共同使用；
 * - 用 zod 同时提供「运行时结构校验」与「TS 类型推断」；
 * - FieldType 与 lib/table/types.ts 保持一致，但此处自包含一份字面量联合，
 *   避免 data/ 目录与 lib/ 目录的跨目录耦合。
 *
 * 设计原则：
 * - 对"无法要求完全自动识别"的场景，合约允许声明
 *   headerConfirmationRequired=true 或 lowConfidenceAllowed=true，
 *   但必须在对应 sheet 的 note 字段说明原因。
 * - 本文件与验证脚本均不调用 LLM / 网络 / 生产库。
 */

import { z } from "zod";

/** 字段类型（与 lib/table/types.ts FieldType 对齐） */
export const FIELD_TYPES = [
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
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** 单个期望字段 */
export const ExpectedColumnSchema = z.object({
  /** 清洗后应出现的列名（重复列名会带 _2 / _3 后缀，需与 cleanSheet 行为一致） */
  displayName: z.string(),
  /** 归一化名（小写、去空格、去标点），用于模糊匹配断言 */
  normalizedName: z.string(),
  /** 期望推断出的字段类型 */
  expectedType: z.enum(FIELD_TYPES),
  /** 是否为关键字段（验证脚本会硬断言其存在与类型） */
  required: z.boolean(),
});
export type ExpectedColumn = z.infer<typeof ExpectedColumnSchema>;

/** 期望被识别出的质量问题 */
export const QualityIssueSchema = z.object({
  /** 问题代码（语义化，便于 T1 排期） */
  code: z.string(),
  /** 关联列（displayName）；与整表相关时为 null */
  field: z.string().nullable(),
  /** 最小受影响行数（用于断言"问题确实被数据支撑"，而非凭空要求） */
  minimumAffectedRows: z.number().int().nonnegative(),
  /** 可选说明 */
  note: z.string().optional(),
});
export type QualityIssue = z.infer<typeof QualityIssueSchema>;

/**
 * 单个 sheet 的期望契约（T1-A 起为 Sheet 作用域）
 *
 * 字段与质量问题随 T1-A 从「workbook 全局」下沉到「单个 sheet」：
 * 不同 sheet 往往拥有完全不同的字段集合（如 Orders 的订单号/金额 与 Products 的 SKU/库存），
 * 全局字段契约会导致跨 sheet 误断言。每个 sheet 独立声明自己的 expectedColumns / expectedQualityIssues。
 */
export const ExpectedSheetContractSchema = z.object({
  /** sheet 名称（xlsx 的 sheet 名 / CSV 固定为 "Sheet1"） */
  name: z.string(),
  /** 是否应被推荐为核心分析 sheet（Overview/Notes 之类应=false） */
  recommended: z.boolean(),
  /** 表头行在"原始解析 rows"中的 0-based 索引（CSV 通常为 0；header-offset 为 2） */
  expectedHeaderRow: z.number().int().nonnegative(),
  /** 清洗后的有效数据行数（不含表头与空行/说明行） */
  expectedEffectiveRows: z.number().int().nonnegative(),
  /** 清洗后的有效列数（幽灵列裁剪后；重复列名仍各算一列） */
  expectedEffectiveColumns: z.number().int().positive(),
  /** 是否要求用户确认表头（表头不在首行、或存在歧义时） */
  headerConfirmationRequired: z.boolean().optional(),
  /** 是否允许当前实现以低置信度推断（而非 100% 确定） */
  lowConfidenceAllowed: z.boolean().optional(),
  /** 备注：说明为何需确认/低置信度，或该 sheet 的特殊处理 */
  note: z.string().optional(),
  /** 本 sheet 期望出现的字段（T1-A 起为 sheet 作用域，不再 workbook 全局） */
  expectedColumns: z.array(ExpectedColumnSchema).default([]),
  /** 本 sheet 期望被识别出的质量问题（T1-A 起为 sheet 作用域） */
  expectedQualityIssues: z.array(QualityIssueSchema).default([]),
});
export type ExpectedSheetContract = z.infer<typeof ExpectedSheetContractSchema>;

/** 向后兼容别名（旧代码可能引用 SheetContract） */
export type SheetContract = ExpectedSheetContract;
export const SheetContractSchema = ExpectedSheetContractSchema;

/** 分析冒烟用例（仅声明预期，不执行 LLM） */
export const AnalysisSmokeCaseSchema = z.object({
  name: z.string(),
  chartType: z.string(),
  fields: z.array(z.string()),
  note: z.string().optional(),
});
export type AnalysisSmokeCase = z.infer<typeof AnalysisSmokeCaseSchema>;

/** 完整 Fixture 契约（workbook 作用域，仅保留跨 sheet 共享的元信息） */
export const FixtureContractSchema = z.object({
  fixtureId: z.string(),
  /** 业务场景描述 */
  purpose: z.string(),
  /** 文件种类，用于 file-magic 断言映射（csv-text→csv / xlsx→xlsx） */
  fileKind: z.enum(["csv", "xlsx"]),
  /** 断言容差：允许实际值与期望值相差的行列数（默认 0 表示严格） */
  tolerance: z
    .object({
      effectiveRows: z.number().int().nonnegative().default(0),
      effectiveColumns: z.number().int().nonnegative().default(0),
    })
    .default({ effectiveRows: 0, effectiveColumns: 0 }),
  /** 各 sheet 的独立契约（字段与质量问题已下沉到 sheet 作用域，见 ExpectedSheetContract） */
  expectedSheets: z.array(ExpectedSheetContractSchema),
  expectedWarnings: z.array(z.string()).optional(),
  analysisSmokeCases: z.array(AnalysisSmokeCaseSchema).optional(),
  /** 整体备注 */
  notes: z.string().optional(),
});
export type FixtureContract = z.infer<typeof FixtureContractSchema>;

/** 校验一份 JSON 是否为合法契约，返回解析结果或抛出 */
export function parseContract(json: unknown): FixtureContract {
  return FixtureContractSchema.parse(json);
}
