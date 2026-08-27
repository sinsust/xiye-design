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

/**
 * 字段类型推断结果（T1-B）：可解释的候选类型、置信度与理由。
 *
 * 设计原则（T1-B）：
 *  - 不只靠列名，也不只靠值形态，而是 列名语义 + 样本值形态 + 非空比例 + 唯一率 +
 *    可解析比例 + 混合值比例 → 推断类型 / 置信度 / 理由；
 *  - 低置信度仍允许推断，但必须明确标记（confidence 低 + reasons 说明），不得伪装为确定类型；
 *  - 该结构是 ColumnProfile 的可选附加字段，向后兼容（既有的 type 字段仍是权威类型，
 *    本结构为其提供解释性元数据，供 T2 用户确认界面使用）。
 */
export interface TypeInferenceResult {
  /** 推断出的字段类型（与 ColumnProfile.type 一致） */
  inferredType: FieldType;
  /** 置信度 0~1（< 0.6 视为低置信度，需在 UI 明确提示） */
  confidence: number;
  /** 推断理由（人类可读，供用户确认界面展示） */
  reasons: string[];
  /** 推断所依据的样本统计 */
  parseStats: {
    /** 非空值数量 */
    nonNullCount: number;
    /** 可解析为本推断类型的值数量 */
    parseableCount: number;
    /** 唯一值数量（非空去重后） */
    uniqueCount: number;
    /** 唯一率 0~1（uniqueCount / nonNullCount） */
    uniqueRatio: number;
    /** 不可解析为本类型的值数量（nonNullCount - parseableCount） */
    invalidCount: number;
  };
}

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

/* ─────────────── 有效数据集边界（T1-A：cleaner → profiler 唯一事实源） ─────────────── */

/**
 * 被排除（裁剪）的行：记录原始行下标与原因，供下游（profiler / 审计）追溯边界，
 * 避免下游从 raw 重建时丢失「哪些行被判定为无效」的信息。
 */
export interface ExcludedRow {
  /** 在原始解析 rows（不含表头行）中的 0-based 下标 */
  rowIndex: number;
  /** 排除原因（如 "空行" / "说明行" / "全 NULL"） */
  reason: string;
  /** 可选预览（原始行前若干个单元格的字符串化，截断以避免大值/敏感值；不含完整业务数据） */
  preview?: unknown[];
}

/**
 * 被排除（裁剪）的列：记录原始列下标、清洗后列名与原因。
 */
export interface ExcludedColumn {
  /** 在清洗后 headers 中的 0-based 下标 */
  columnIndex: number;
  /** 清洗后列名（可能带 _N 去重后缀） */
  name: string;
  /** 排除原因（如 "幽灵列（全空）" / "无表头"） */
  reason: string;
  /** 该列在有效行中的非空值数量（用于审计与报告） */
  nonNullCount?: number;
}

/* ─────────────── 数据质量信号（T1-C 结构化输出） ─────────────── */

/** 质量信号严重度 */
export type QualitySeverity = "info" | "warning" | "error";

/**
 * 结构化数据质量问题（T1-C）：由纯质量检测模块 detectTableQualityIssues 产出，
 * 与清洗解耦——除空白行/幽灵列这些结构性无效项外，检测器只报告问题、不自动改写业务值。
 *
 * 设计为可追溯、可截断、低敏感暴露：samples 仅保留少量去敏感的样本（如行号、列名、序列号），
 * 不承载完整业务记录；affectedRows / affectedColumns 给出影响面供下游（profiler / 分析推荐 /
 * 后续 LLM Context）消费。
 */
export interface QualityIssue {
  /** 问题代码（与 Expected Contract 的 expectedQualityIssues.code 对齐，便于断言） */
  code: string;
  /** 严重度 */
  severity: QualitySeverity;
  /** 关联字段归一化 id（可选） */
  fieldId?: string;
  /** 关联列显示名（可选） */
  columnName?: string;
  /** 人类可读描述 */
  message: string;
  /** 受影响行数（可选） */
  affectedRows?: number;
  /** 受影响列数（可选） */
  affectedColumns?: number;
  /** 样本（严格截断，最多 5 项，不暴露不必要敏感值） */
  samples?: string[];
  /** 建议处置动作（可选） */
  suggestedAction?: string;
}

/**
 * EffectiveDataset：表头识别之后、已完成无效空行/无效空列裁剪、
 * 但未对原始业务值做破坏性改写的数据集边界契约。
 *
 * 语义（T1-A 铁律）：
 *  - 它是 parser / cleaner / profiler 之间唯一、可追踪的「有效数据集边界」；
 *  - cleaner 必须产出它，profiler 必须消费它（或经由 profileEffectiveDataset 适配器），
 *    不得从 raw 重建而丢失 excludedRows / excludedColumns 边界信息；
 *  - rows 用引用（不复制整行），避免行数据双倍内存；
 *  - 本阶段仅「捕获并传递边界」：若 cleaner 当前尚未实现空行/幽灵列裁剪，
 *    excludedRows / excludedColumns 为空数组，effectiveRowCount/ColumnCount 仍等于
 *    cleaner 当前产出的有效行/列数（裁剪算法本身属 T1-B/T1-C，不在本阶段改动）。
 */
export interface EffectiveDataset {
  /** sheet 唯一标识（当前用 sheet 名） */
  sheetId: string;
  /** sheet 名称 */
  sheetName: string;
  /** 检测到的表头行（在 allRows = [parsedHeader, ...parsedRows] 坐标系下的 0-based 索引） */
  detectedHeaderRow: number;
  /** 裁前原始总行数（含表头行） */
  rawRowCount: number;
  /** 裁前原始最大列数 */
  rawColumnCount: number;
  /** 有效数据行数（不含表头、不含被排除行） */
  effectiveRowCount: number;
  /** 有效列数（不含被排除列） */
  effectiveColumnCount: number;
  /** 清洗后表头（已 trim、空名兜底 column_N、重复列名加 _N 后缀） */
  headers: string[];
  /** 清洗后数据行（按 headers 对齐；业务值已 normalize，但未破坏性改写） */
  rows: unknown[][];
  /** 每列推断类型（与 headers 对齐） */
  columns: FieldType[];
  /** 被排除的行（边界追溯；本阶段可能为空） */
  excludedRows: ExcludedRow[];
  /** 被排除的列（边界追溯；本阶段可能为空） */
  excludedColumns: ExcludedColumn[];
  /** 非阻断的边界警告（如幽灵列未裁剪等） */
  warnings: string[];
  /** 结构化数据质量信号（T1-C：由 detectTableQualityIssues 产出；未实现检测时为可选空数组） */
  qualityIssues?: QualityIssue[];
}

/* ─────────────── Sheet 推荐与表头确认（T1-D1） ─────────────── */

/**
 * Sheet 角色（T1-D1）：用于区分主数据 / 次数据 / 汇总 / 备注 / 无法判断。
 *
 * 语义：
 *  - primary_data：明细业务数据，表头明确、行列充足、含可分析字段，可直接进入分析；
 *  - secondary_data：可分析但需人工确认（表头需确认、行数偏少、可分析字段较弱）；
 *  - summary：汇总/概览类（KPI 表），不适合作为明细分析对象；
 *  - notes：说明/备注/README 类纯文本；
 *  - unknown：结构不足以判断（无表头、无可分析字段且行数极少）。
 */
export type SheetRole = "primary_data" | "secondary_data" | "summary" | "notes" | "unknown";

/**
 * 表头评估结果（T1-D1）：在不修改 detectHeaderRow 的前提下，
 * 由 sheet-recommender 独立复算候选并给出置信度与歧义判定，用于决定是否要求用户确认表头。
 */
export interface SheetHeaderAssessment {
  /** EffectiveDataset 给出的表头行（allRows 坐标系，0-based） */
  detectedHeaderRow: number;
  /** 推荐器独立评估出的最佳表头候选行（同坐标系） */
  bestCandidateRow: number;
  /** 表头置信度 0~1 */
  confidence: number;
  /** 最佳与次佳候选的分差（越小越有歧义） */
  margin: number;
  /** 是否存在歧义（低置信 / 多候选竞争 / 与检测结果不一致 / 无有效表头） */
  ambiguous: boolean;
  /** 表头是否位于第 1 行 */
  headerRowIsFirstRow: boolean;
}

/**
 * 推荐所依据的统计摘要（T1-D1）：只含聚合统计，不含任何单元格原文，
 * 避免推荐结果泄露样本或敏感业务数据。
 */
export interface SheetRecommendationMetrics {
  /** 有效数据行数（EffectiveDataset 边界） */
  effectiveRowCount: number;
  /** 有效列数（EffectiveDataset 边界） */
  effectiveColumnCount: number;
  /** 可分析列数（日期 / 数值 / 分类 / ID） */
  analyzableColumnCount: number;
  dateColumnCount: number;
  numericColumnCount: number;
  categoryColumnCount: number;
  idColumnCount: number;
  /** 是否仅有文本类字段（无任何可分析字段） */
  textOnly: boolean;
  /** 空值比例 0~1（有效集内） */
  nullRatio: number;
  /** 行填充稳定性 0~1（各行非空率的一致程度，越高越像规整明细表） */
  rowFillStability: number;
  /** 被排除的行 / 列数（来自 EffectiveDataset 边界，供解释） */
  excludedRowCount: number;
  excludedColumnCount: number;
}

/**
 * Sheet 推荐结果（T1-D1）：向后兼容的加法结构，
 * 由纯规则模块 lib/table/sheet-recommender.ts 产出，不调用 LLM、不读其他用户数据。
 *
 * 铁律：
 *  - 只做「推荐 + 是否需确认表头」，绝不自动合并任何 Sheet；
 *  - 输入仅为单个 Sheet 的解析/清洗/画像摘要（含前若干行预览用于表头候选评估）；
 *  - reasons 必须可解释（含表头位置说明），且不承载单元格原文。
 */
export interface SheetRecommendation {
  /** 与 EffectiveDataset.sheetId 一致 */
  sheetId: string;
  sheetName: string;
  /** 角色判定 */
  role: SheetRole;
  /** 综合得分 0~100（集中权重配置，稳定可复现） */
  score: number;
  /** 判定置信度 0~1 */
  confidence: number;
  /** 可解释理由（人类可读，供 UI 展示；不含样本原文） */
  reasons: string[];
  /** 是否必须由用户确认表头（表头非首行 / 低置信 / 多候选 / 无有效表头） */
  requiresHeaderConfirmation: boolean;
  /** 是否推荐为可分析对象（role ∈ primary_data | secondary_data） */
  recommended: boolean;
  /** 稳定排序后的序号（1 起） */
  rank: number;
  /** 表头评估细节 */
  header: SheetHeaderAssessment;
  /** 统计摘要 */
  metrics: SheetRecommendationMetrics;
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
  /** 字段类型推断解释（T1-B）：可解释的类型/置信度/理由，向后兼容可选字段 */
  inference?: TypeInferenceResult;
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

/** 图表类型（含 P0 新增：topn 排名 / mom 同比环比 / groupbar 分组多维对比） */
export type ChartType =
  | "line"
  | "bar"
  | "pie"
  | "heatmap"
  | "scatter"
  | "boxplot"
  | "histogram"
  | "table"
  | "topn"
  | "mom"
  | "groupbar";

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
