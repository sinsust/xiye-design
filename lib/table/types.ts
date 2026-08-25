/**
 * 表格处理板块 —— 类型定义
 *
 * 覆盖「上传 → 解析 → 清洗 → 字段画像 → AI 分析推荐 → 可视化」全链路的共享类型。
 * 所有类型均 export，供 parser / cleaner / profiler / API 路由 / 前端组件复用。
 */

/* ─────────────── 基础字段类型 ─────────────── */

/** 单列的字段类型（推断结果） */
export type FieldType =
  | "boolean"
  | "date"
  | "integer"
  | "float"
  | "percentage"
  | "currency"
  | "category"
  | "text"
  | "id"
  | "email"
  | "url"
  | "phone";

/* ─────────────── 解析层 ─────────────── */

/** 单个工作表（sheet）的原始解析结果 */
export interface SheetInfo {
  /** sheet 名称（xlsx 的 sheet 名 / 文件名 / "Sheet1" 等兜底） */
  name: string;
  /** 表头行（清洗前的原始值） */
  headers: string[];
  /** 数据行（不含表头，每行与 headers 等长对齐） */
  rows: unknown[][];
  /** 数据行数 */
  rowCount: number;
  /** 列数 */
  colCount: number;
}

/** 文件解析的完整结果（可能含多个 sheet） */
export interface ParsedTable {
  /** 原始文件名 */
  fileName: string;
  /** 检测到的文件编码（utf-8 / gbk / big5 / shift-jis …） */
  encoding: string;
  /** 所有 sheet 的解析结果 */
  sheets: SheetInfo[];
  /** 结构相同的 sheet 合并后的结果（自动合并时存在） */
  mergedSheets?: SheetInfo;
}

/* ─────────────── 字段画像层 ─────────────── */

/** 字段画像的公共基座（所有类型画像的共有字段） */
export interface ColumnProfile {
  /** 清洗后的字段名（可能带序号去重后缀） */
  name: string;
  /** 原始表头名 */
  originalName: string;
  /** 列下标（0 起） */
  index: number;
  /** 推断出的字段类型 */
  type: FieldType;
  /** 总行数 */
  totalCount: number;
  /** 非空值数量 */
  nonNullCount: number;
  /** 空值数量 */
  nullCount: number;
  /** 非空率（0~1） */
  nonNullRate: number;
  /** 唯一值数量 */
  uniqueCount: number;
  /** 唯一率（0~1，uniqueCount / nonNullCount） */
  uniqueRate: number;
  /** 是否整列唯一（可作为主键候选） */
  isUnique: boolean;
  /** 出现次数最多的重复值（含计数、占比，按次数降序，最多 10 个） */
  duplicateTopValues: { value: string; count: number; percentage: number }[];
  /** 抽样值（最多 20 个，保留原始类型用于展示） */
  samples: unknown[];
}

/** 分类分布的一项 */
export interface DistributionItem {
  /** 类别值（字符串化） */
  value: string;
  /** 出现次数 */
  count: number;
  /** 占比（0~1） */
  percentage: number;
}

/** 分类字段画像（kind=category | boolean） */
export interface CategoryProfile extends ColumnProfile {
  /** 画像细分类别 */
  kind: "category" | "boolean";
  /** 各取值分布（按 count 降序） */
  distribution: DistributionItem[];
  /** 类别总数（含空值外的不同取值数） */
  totalCategories: number;
  /** 是否二元取值（true/false、是/否 等两种取值） */
  isBinary: boolean;
  /** 是否均衡（最大类别占比 < 0.5） */
  isBalanced: boolean;
  /** 占比最高的类别值 */
  topCategory: string | null;
  /** 最高类别占比（0~1） */
  topCategoryPercentage: number;
  /** 长尾类别数（占比 < 1% 的类别个数） */
  longTailCount: number;
  /** 值是否含层级结构（"-" 或 "/" 分隔符且前缀有规律） */
  hasHierarchy: boolean;
  /** 层级名称（如 ["省份","城市"]；非层级字段为空数组） */
  hierarchyLevels: string[];
}

/** 直方图的一个桶 */
export interface HistogramBin {
  /** 桶左边界（含） */
  start: number;
  /** 桶右边界（不含） */
  end: number;
  /** 桶内样本数 */
  count: number;
}

/** 分位数集合 */
export interface Quantiles {
  q25: number;
  q50: number;
  q75: number;
  q90: number;
  q95: number;
  q99: number;
}

/** 数值字段画像（kind=integer | float | percentage | currency） */
export interface NumericProfile extends ColumnProfile {
  /** 画像细分类别 */
  kind: "integer" | "float" | "percentage" | "currency";
  /** 单位（"元"/"%" 等，可空） */
  unit: string | null;
  min: number;
  max: number;
  mean: number;
  median: number;
  /** 标准差（样本） */
  stdDev: number;
  sum: number;
  quantiles: Quantiles;
  /** 是否近似正态分布（|偏度| < 0.5 的粗略判断） */
  isNormalDistribution: boolean;
  /** 偏度（三阶中心矩 / 标准差³） */
  skewness: number;
  hasOutliers: boolean;
  outlierCount: number;
  /** 异常值列表（最多 20 个） */
  outlierValues: number[];
  zeroCount: number;
  negativeCount: number;
  /** 20 桶直方图 */
  histogram: HistogramBin[];
}

/** 日期粒度（年/季/月/周/日/时，覆盖 Q3 2026 季度、"2026-08-25 14:30" 情况） */
export type DateGranularity = "year" | "quarter" | "month" | "week" | "day" | "hour";

/** 星期分布项（0=周日 … 6=周六） */
export interface DayOfWeekDistributionItem {
  /** 星期数字（0~6，0 为周日） */
  day: number;
  /** 星期名（"周日"…"周六"） */
  label: string;
  count: number;
}

/** 月份分布项（1~12） */
export interface MonthDistributionItem {
  month: number;
  count: number;
}

/** 日期字段画像（kind=date | datetime） */
export interface DateProfile extends ColumnProfile {
  /** 画像细分类别 */
  kind: "date" | "datetime";
  /** 最早日期（YYYY-MM-DD） */
  minDate: string;
  /** 最晚日期（YYYY-MM-DD） */
  maxDate: string;
  /** 跨度天数 = maxDate - minDate */
  dateRange: number;
  /** 检测到的粒度（day/week/month/year） */
  detectedGranularity: DateGranularity;
  /** 是否连续（无缺失日期） */
  isContinuous: boolean;
  /** 缺失日期列表（最多 10 个，仅日粒度时检测） */
  missingDates: string[];
  dayOfWeekDistribution: DayOfWeekDistributionItem[];
  monthDistribution: MonthDistributionItem[];
}

/** 高频词项 */
export interface TopWordItem {
  word: string;
  count: number;
}

/** 文本字段画像（kind=text | id | email | url | phone） */
export interface TextProfile extends ColumnProfile {
  /** 画像细分类别 */
  kind: "text" | "id" | "email" | "url" | "phone";
  avgLength: number;
  maxLength: number;
  minLength: number;
  containsChinese: boolean;
  containsEnglish: boolean;
  containsNumbers: boolean;
  /** 命中的 ID 模式（正则字符串；未命中为 null） */
  idPattern: string | null;
  /** Top 20 高频词（按空格/标点简单切分） */
  topWords: TopWordItem[];
}

/** 各字段画像的联合类型 */
export type ColumnProfileUnion =
  | CategoryProfile
  | NumericProfile
  | DateProfile
  | TextProfile;

/* ─────────────── 跨列关联 ─────────────── */

/** 关联类型：数值相关 / 函数依赖 / 层级包含 */
export type RelationType = "correlation" | "functional_dependency" | "hierarchy";

/** 两列之间的关联发现 */
export interface ColumnRelation {
  type: RelationType;
  /** 参与关联的两列字段名 */
  columns: [string, string];
  /** 关联详情（如相关系数公式、依赖方向 A→B） */
  detail: string;
  /** 强度（correlation 为 |r|；函数依赖/层级为 1 或覆盖率 0~1） */
  strength: number;
}

/* ─────────────── 画像总结果 ─────────────── */

/** 单个 sheet 的完整画像结果 */
export interface TableProfileResult {
  sheetName: string;
  rowCount: number;
  colCount: number;
  columns: ColumnProfileUnion[];
  relations: ColumnRelation[];
}

/* ─────────────── 分析推荐与结果（Step 5/8 使用） ─────────────── */

/** 图表类型 */
export type ChartType =
  | "line"
  | "bar"
  | "pie"
  | "heatmap"
  | "scatter"
  | "boxplot"
  | "histogram"
  | "table";

/** AI 推荐的一个分析维度 */
export interface AnalysisDimension {
  /** 分析名称 */
  name: string;
  /** 分析思路（用哪些字段、怎么算） */
  description: string;
  chartType: ChartType;
  /** 用到的字段名数组 */
  fields: string[];
  /** 预期业务洞察 */
  insight: string;
}

/** 单个分析执行的原始结果（纯 JS 计算，供图表与 AI 解读使用） */
export interface AnalysisExecutionResult {
  /** 维度名称 */
  name: string;
  chartType: ChartType;
  /** 图表数据（结构由 chartType 决定：bar/pie 为 {name,value}[]，line 为 {x,y}[] 等） */
  data: unknown;
  /** 明细行（二维，配 headers 渲染表格，最多 20 条） */
  rows: unknown[][];
  /** 计算摘要（供 AI 解读的文本） */
  summary: string;
}

/** 完整分析结果（API 返回 + 前端展示） */
export interface AnalysisResult {
  dimension: AnalysisDimension;
  execution: AnalysisExecutionResult;
  /** AI 生成的解读文本 */
  interpretation: string;
  /** 保存为笔记/提取任务时的可选标题 */
  title: string;
}
