/**
 * 表格处理 —— 字段画像层（Step 4）
 *
 * 逐列深度画像（分类/数值/日期/文本）+ 跨列关联检测（Pearson/函数依赖/层级）。
 * 纯计算、无 AI；输出 TableProfileResult 供 AI 推荐维度与前端可视化使用。
 */

import type {
  CategoryProfile,
  ColumnProfile,
  ColumnProfileUnion,
  ColumnRelation,
  DateProfile,
  DateGranularity,
  EffectiveDataset,
  FieldType,
  NumericProfile,
  TableProfileResult,
  TextProfile,
} from "./types";

/* ─────────────── 统计工具 ─────────────── */

/**
 * 计算有序数组指定百分位数（线性插值）
 * @param sorted 已升序排列的数值数组
 * @param p 百分位（0~100）
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** 平均值 */
function meanOf(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** 样本标准差 */
function stdDevOf(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const ss = values.reduce((a, v) => a + (v - mean) * (v - mean), 0);
  return Math.sqrt(ss / (values.length - 1));
}

/** 偏度（三阶中心矩 / 标准差³；样本公式） */
function skewnessOf(values: number[], mean: number, stdDev: number): number {
  if (values.length < 3 || stdDev === 0) return 0;
  const n = values.length;
  const m3 = values.reduce((a, v) => a + Math.pow(v - mean, 3), 0) / n;
  const s3 = Math.pow(stdDev, 3);
  return m3 / s3;
}

/**
 * 计算两列数值的 Pearson 相关系数
 * @returns r 值，范围 [-1, 1]，数据不足返回 null
 */
export function pearsonCorrelation(x: number[], y: number[]): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 3) return null;

  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0,
    sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }

  const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (denom === 0) return null;

  return (n * sumXY - sumX * sumY) / denom;
}

/**
 * IQR 方法检测异常值
 * @returns 异常值数组
 */
export function detectOutliersIQR(values: number[]): number[] {
  if (values.length < 4) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentile(sorted, 25);
  const q3 = percentile(sorted, 75);
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return values.filter((v) => v < lower || v > upper);
}

/* ─────────────── 公共画像基座 ─────────────── */

/** 组装 ColumnProfile 公共字段（完整性/唯一性/样本） */
function baseProfile(name: string, index: number, type: FieldType, values: unknown[]): ColumnProfile {
  const totalCount = values.length;
  const nonNullValues = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
  const nonNullCount = nonNullValues.length;
  const nullCount = totalCount - nonNullCount;
  const nonNullRate = totalCount > 0 ? nonNullCount / totalCount : 0;

  // 唯一性
  const counter = new Map<string, number>();
  for (const v of nonNullValues) {
    const k = String(v);
    counter.set(k, (counter.get(k) || 0) + 1);
  }
  const uniqueCount = counter.size;
  const uniqueRate = nonNullCount > 0 ? uniqueCount / nonNullCount : 0;
  const isUnique = uniqueCount === nonNullCount && nonNullCount > 0;

  // 重复值 Top10（带占比）
  const duplicateTopValues = [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([value, count]) => ({
      value,
      count,
      percentage: nonNullCount > 0 ? count / nonNullCount : 0,
    }));

  // 样本（前 20 个非空）
  const samples = nonNullValues.slice(0, 20);

  return {
    name,
    originalName: name,
    index,
    type,
    totalCount,
    nonNullCount,
    nullCount,
    nonNullRate,
    uniqueCount,
    uniqueRate,
    isUnique,
    duplicateTopValues,
    samples,
  };
}

/* ─────────────── 分类画像 ─────────────── */

/** 分类字段画像 */
function profileCategory(name: string, index: number, values: unknown[]): CategoryProfile {
  const base = baseProfile(name, index, "category", values);
  const nonNull = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
  const total = nonNull.length;

  const counter = new Map<string, number>();
  for (const v of nonNull) {
    const k = String(v);
    counter.set(k, (counter.get(k) || 0) + 1);
  }
  const distribution = [...counter.entries()]
    .map(([value, count]) => ({
      value,
      count,
      percentage: total > 0 ? count / total : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const totalCategories = distribution.length;
  const isBinary = totalCategories === 2;
  const top = distribution[0];
  const topCategory = top?.value ?? null;
  const topCategoryPercentage = top?.percentage ?? 0;
  const isBalanced = topCategoryPercentage < 0.5;
  const longTailCount = distribution.filter((d) => d.percentage < 0.01).length;

  // 层级检测：值含 "-" 或 "/" 且前缀高度复用
  const { hasHierarchy, hierarchyLevels } = detectHierarchy(distribution.map((d) => d.value));

  return {
    ...base,
    kind: isBinary && isBooleanLike(nonNull) ? "boolean" : "category",
    distribution,
    totalCategories,
    isBinary,
    isBalanced,
    topCategory,
    topCategoryPercentage,
    longTailCount,
    hasHierarchy,
    hierarchyLevels,
  };
}

/** 是否类布尔取值（是/否、true/false 等） */
function isBooleanLike(values: unknown[]): boolean {
  const BOOL = /^(true|false|是|否|yes|no|y|n|t|f)$/i;
  const hit = values.filter((v) => BOOL.test(String(v))).length;
  return hit / Math.max(values.length, 1) > 0.8;
}

/** 层级检测：值含分隔符（- 或 /），且去重前缀数远小于总值数（前缀复用） */
function detectHierarchy(values: string[]): { hasHierarchy: boolean; hierarchyLevels: string[] } {
  if (values.length < 3) return { hasHierarchy: false, hierarchyLevels: [] };
  const parts = values.map((v) => {
    const m = v.split(/\s*[-/]\s*/);
    return m.length >= 2 ? m : null;
  });
  const split = parts.filter((p): p is string[] => p !== null);
  if (split.length < Math.max(3, values.length * 0.6)) {
    return { hasHierarchy: false, hierarchyLevels: [] };
  }
  const prefixes = new Set(split.map((p) => p[0]));
  // 前缀复用率高（前缀数 / 值数 < 0.5）才算层级
  if (prefixes.size / split.length > 0.5) return { hasHierarchy: false, hierarchyLevels: [] };
  return {
    hasHierarchy: true,
    hierarchyLevels: [...prefixes].slice(0, 5),
  };
}

/* ─────────────── 数值画像 ─────────────── */

/** 数值字段画像 */
function profileNumeric(name: string, index: number, values: unknown[], type: FieldType): NumericProfile {
  const base = baseProfile(name, index, type, values);
  const nums = values
    .map((v) => (typeof v === "number" ? v : Number(v)))
    .filter((n) => Number.isFinite(n));

  const sorted = [...nums].sort((a, b) => a - b);
  const min = sorted.length > 0 ? sorted[0] : 0;
  const max = sorted.length > 0 ? sorted[sorted.length - 1] : 0;
  const mean = meanOf(nums);
  const median = percentile(sorted, 50);
  const stdDev = stdDevOf(nums, mean);
  const sum = nums.reduce((a, b) => a + b, 0);
  const skewness = skewnessOf(nums, mean, stdDev);
  const isNormalDistribution = Math.abs(skewness) < 0.5;

  const outliers = detectOutliersIQR(nums);
  const hasOutliers = outliers.length > 0;
  const outlierValues = outliers.slice(0, 20);
  const zeroCount = nums.filter((n) => n === 0).length;
  const negativeCount = nums.filter((n) => n < 0).length;

  // 20 桶直方图
  const histogram = buildHistogram(nums, 20);

  // 单位推断：从列名提取（(万元)/（元）/% 等）
  const unit = inferUnitFromName(name);

  const kind = (type === "integer" || type === "float" || type === "percentage" || type === "currency"
    ? type
    : "float") as NumericProfile["kind"];

  return {
    ...base,
    kind,
    unit,
    min,
    max,
    mean,
    median,
    stdDev,
    sum,
    quantiles: {
      q25: percentile(sorted, 25),
      q50: percentile(sorted, 50),
      q75: percentile(sorted, 75),
      q90: percentile(sorted, 90),
      q95: percentile(sorted, 95),
      q99: percentile(sorted, 99),
    },
    isNormalDistribution,
    skewness,
    hasOutliers,
    outlierCount: outliers.length,
    outlierValues,
    zeroCount,
    negativeCount,
    histogram,
  };
}

/** 生成等宽直方图（N 桶）；所有值相同则单桶 */
function buildHistogram(nums: number[], bins: number): { start: number; end: number; count: number }[] {
  if (nums.length === 0) return [];
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (min === max) {
    return [{ start: min, end: max + 1, count: nums.length }];
  }
  const width = (max - min) / bins;
  const result = Array.from({ length: bins }, (_, i) => ({
    start: min + i * width,
    end: min + (i + 1) * width,
    count: 0,
  }));
  for (const n of nums) {
    let idx = Math.floor((n - min) / width);
    if (idx >= bins) idx = bins - 1;
    result[idx].count++;
  }
  return result;
}

/** 从列名提取单位（(万元)/万元/元/%/（元） 等） */
function inferUnitFromName(name: string): string | null {
  const m = name.match(/[（(]?\s*(万元|亿元|万|亿|元|美元|欧元|港币|%|百分比|kg|KG|吨|件|个|次)[）)]?\s*$/);
  return m ? m[1] : null;
}

/* ─────────────── 日期画像 ─────────────── */

/** 日期字段画像 */
function profileDate(name: string, index: number, values: unknown[]): DateProfile {
  const base = baseProfile(name, index, "date", values);
  const dates = values
    .map((v) => (typeof v === "string" && v.trim() ? parseDateForProfile(v) : null))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length === 0) {
    return {
      ...base,
      kind: "date",
      minDate: "",
      maxDate: "",
      dateRange: 0,
      detectedGranularity: "day",
      isContinuous: false,
      missingDates: [],
      dayOfWeekDistribution: [],
      monthDistribution: [],
    };
  }

  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];
  const dateRange = Math.round((maxDate.getTime() - minDate.getTime()) / 86400_000);

  const granularity = detectGranularity(dates);
  const { isContinuous, missingDates } = checkContinuity(dates, granularity);

  // 星期分布（0=周日 … 6=周六）
  const dowNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const dow = Array.from({ length: 7 }, (_, day) => ({
    day,
    label: dowNames[day],
    count: 0,
  }));
  for (const d of dates) dow[d.getDay()].count++;
  const dayOfWeekDistribution = dow.filter((d) => d.count > 0);

  // 月份分布（1~12）
  const month = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, count: 0 }));
  for (const d of dates) month[d.getMonth()].count++;
  const monthDistribution = month.filter((m) => m.count > 0);

  return {
    ...base,
    kind: "date",
    minDate: toISO(minDate),
    maxDate: toISO(maxDate),
    dateRange,
    detectedGranularity: granularity,
    isContinuous,
    missingDates,
    dayOfWeekDistribution,
    monthDistribution,
  };
}

/** 解析为 Date（"YYYY-MM-DD" 及 "YYYY-MM-DD HH:MM:SS"；本地时区解析，避免 UTC 偏移导致 getHours() 误判） */
function parseDateForProfile(s: string): Date | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  const d = new Date(
    +m[1],
    +m[2] - 1,
    +m[3],
    m[4] !== undefined ? +m[4] : 0,
    m[5] !== undefined ? +m[5] : 0,
    m[6] !== undefined ? +m[6] : 0,
  );
  return isNaN(d.getTime()) ? null : d;
}

/** 检测日期粒度：year/quarter/month/week/day/hour */
function detectGranularity(dates: Date[]): DateGranularity {
  if (dates.length < 2) return "day";

  const allDay1 = dates.every((d) => d.getDate() === 1);
  const allJan1 = dates.every((d) => d.getMonth() === 0 && d.getDate() === 1);
  const allMonday = dates.every((d) => d.getDay() === 1);
  const hasTime = dates.some((d) => d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0);

  if (hasTime) return "hour";
  if (allJan1) return "year";
  if (allDay1 && allMonday) return "quarter"; // 季度首日
  if (allDay1) return "month";
  if (allMonday) return "week";
  return "day";
}

/** 连续性检测（仅 day/week/month 粒度有意义）；缺失日期最多返回 10 个 */
function checkContinuity(
  dates: Date[],
  granularity: DateGranularity,
): { isContinuous: boolean; missingDates: string[] } {
  if (dates.length < 2) return { isContinuous: true, missingDates: [] };
  const min = dates[0].getTime();
  const max = dates[dates.length - 1].getTime();
  const day = 86400_000;

  if (granularity === "day") {
    const present = new Set(dates.map((d) => toISO(d)));
    const missing: string[] = [];
    for (let t = min; t <= max; t += day) {
      const iso = toISO(new Date(t));
      if (!present.has(iso)) missing.push(iso);
    }
    return { isContinuous: missing.length === 0, missingDates: missing.slice(0, 10) };
  }

  if (granularity === "week") {
    const present = new Set(dates.map((d) => toISO(d)));
    // 周粒度按周一判定
    const weekKeys = new Set<string>();
    for (const d of dates) {
      const mon = new Date(d);
      mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      weekKeys.add(toISO(mon));
    }
    const missing: string[] = [];
    for (let t = min; t <= max; t += 7 * day) {
      const weekStart = new Date(t);
      const mon = new Date(weekStart);
      mon.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
      const key = toISO(mon);
      if (!weekKeys.has(key)) missing.push(key);
    }
    return { isContinuous: missing.length === 0, missingDates: missing.slice(0, 10) };
  }

  if (granularity === "month") {
    const present = new Set(dates.map((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`));
    const missing: string[] = [];
    const y0 = min / (12 * 30.44 * day); // 粗略估算起点年份
    for (let t = new Date(Math.floor(y0) * 12 * 30.44 * day); t.getTime() <= max; t.setMonth(t.getMonth() + 1)) {
      const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
      if (!present.has(key)) missing.push(key);
    }
    return { isContinuous: missing.length === 0, missingDates: missing.slice(0, 10) };
  }

  // year/quarter/hour 不做连续性
  return { isContinuous: true, missingDates: [] };
}

/** 本地时区 ISO 日期（避免 UTC 偏移差一天） */
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ─────────────── 文本画像 ─────────────── */

/** 文本字段画像 */
function profileText(name: string, index: number, values: unknown[]): TextProfile {
  const base = baseProfile(name, index, "text", values);
  const strs = values
    .map((v) => (v === null || v === undefined ? null : String(v).trim()))
    .filter((s): s is string => s !== null && s !== "");

  const lengths = strs.map((s) => s.length);
  const avgLength = strs.length > 0 ? lengths.reduce((a, b) => a + b, 0) / strs.length : 0;
  const maxLength = strs.length > 0 ? Math.max(...lengths) : 0;
  const minLength = strs.length > 0 ? Math.min(...lengths) : 0;

  const joined = strs.join(" ");
  const containsChinese = /[\u4e00-\u9fa5]/.test(joined);
  const containsEnglish = /[a-zA-Z]/.test(joined);
  const containsNumbers = /\d/.test(joined);

  // 格式检测（按列名 + 内容模式推断 kind + idPattern）
  const { kind, idPattern } = detectTextKind(name, base, strs);

  // Top20 高频词（空格/标点切分）
  const topWords = buildTopWords(strs, 20);

  return {
    ...base,
    kind,
    avgLength,
    maxLength,
    minLength,
    containsChinese,
    containsEnglish,
    containsNumbers,
    idPattern,
    topWords,
  };
}

/** 推断文本子类型（email/url/phone/id/text）并返回 id 正则 */
function detectTextKind(
  name: string,
  base: ColumnProfile,
  strs: string[],
): { kind: TextProfile["kind"]; idPattern: string | null } {
  if (strs.length === 0) return { kind: "text", idPattern: null };

  const hit = (re: RegExp) => strs.filter((s) => re.test(s)).length / strs.length;
  if (hit(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) > 0.9) return { kind: "email", idPattern: null };
  if (hit(/^(https?:\/\/|www\.)[^\s]+$/) > 0.9) return { kind: "url", idPattern: null };
  if (hit(/^1[3-9]\d{9}$/) > 0.9) return { kind: "phone", idPattern: null };

  // ID 候选：全唯一 + 固定格式（数字+字母混合）
  const idLike =
    base.isUnique &&
    base.nonNullCount > 5 &&
    /[a-zA-Z]/.test(name) &&
    hit(/^[A-Za-z0-9_-]{3,30}$/) > 0.9;
  if (idLike) {
    // 尝试提取模式（如 ORD-2026-0001 → [A-Z]+-\d{4}-\d{4}）
    const sample = strs.slice(0, 10);
    const pattern = inferIdPattern(sample);
    return { kind: "id", idPattern: pattern };
  }
  return { kind: "text", idPattern: null };
}

/** 从样本推断 ID 正则模式（简化：字母段+数字段组合） */
function inferIdPattern(samples: string[]): string | null {
  for (const s of samples) {
    const parts = s.split("-");
    if (parts.length >= 2) {
      const seg = parts.map((p) => (/^\d+$/.test(p) ? "\\d+".replace("\\d+", `\\d{${p.length}}`) : "[A-Za-z]+"));
      return seg.join("-");
    }
  }
  return null;
}

/** 高频词统计（空格/标点切分，Top N） */
function buildTopWords(strs: string[], topN: number): { word: string; count: number }[] {
  const counter = new Map<string, number>();
  for (const s of strs) {
    const words = s.split(/[\s,，。;；:：、|/\\()[\]{}"'<>《》!?！？]+/).filter((w) => w.length > 0);
    for (const w of words) {
      counter.set(w, (counter.get(w) || 0) + 1);
    }
  }
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({ word, count }));
}

/* ─────────────── 画像分发 ─────────────── */

/**
 * 单列画像（按类型分发）
 */
export function profileColumn(
  name: string,
  index: number,
  values: unknown[],
  type: FieldType,
): ColumnProfileUnion {
  switch (type) {
    case "boolean":
    case "category":
      return profileCategory(name, index, values);
    case "integer":
    case "float":
    case "percentage":
    case "currency":
      return profileNumeric(name, index, values, type);
    case "date":
      return profileDate(name, index, values);
    case "id":
    case "email":
    case "url":
    case "phone":
    case "text":
    default:
      return profileText(name, index, values);
  }
}

/* ─────────────── 跨列关联 ─────────────── */

/**
 * 检测跨列关联：correlation（|r|>0.7）/ functional_dependency / hierarchy
 * @param columns 画像列
 * @param rows 清洗后的数据行（对齐 columns）
 */
export function detectRelations(columns: ColumnProfileUnion[], rows: unknown[][]): ColumnRelation[] {
  const relations: ColumnRelation[] = [];
  if (columns.length < 2 || rows.length === 0) return relations;

  // 按列提取数据
  const colData = columns.map((c) => rows.map((r) => r[c.index] ?? null));

  // 1. 数值相关性
  const numericCols = columns.filter((c) => "mean" in c) as NumericProfile[];
  for (let i = 0; i < numericCols.length; i++) {
    for (let j = i + 1; j < numericCols.length; j++) {
      const a = numericCols[i];
      const b = numericCols[j];
      const pairs: Array<[number, number]> = [];
      for (let r = 0; r < rows.length; r++) {
        const x = colData[a.index][r];
        const y = colData[b.index][r];
        if (typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y)) {
          pairs.push([x, y]);
        }
      }
      const xs = pairs.map((p) => p[0]);
      const ys = pairs.map((p) => p[1]);
      const r = pearsonCorrelation(xs, ys);
      if (r !== null && Math.abs(r) > 0.7) {
        relations.push({
          type: "correlation",
          columns: [a.name, b.name],
          detail: `Pearson r = ${r.toFixed(3)}（基于 ${pairs.length} 对样本）`,
          strength: Math.abs(r),
        });
      }
    }
  }

  // 2. 函数依赖（A 每个值唯一对应 B 一个值）
  for (let i = 0; i < columns.length; i++) {
    for (let j = 0; j < columns.length; j++) {
      if (i === j) continue;
      const a = columns[i];
      const b = columns[j];
      const mapAtoB = new Map<string, Set<string>>();
      let checked = 0;
      for (let r = 0; r < rows.length; r++) {
        const av = colData[a.index][r];
        const bv = colData[b.index][r];
        if (av === null || av === undefined || bv === null || bv === undefined) continue;
        const key = String(av);
        const val = String(bv);
        if (!mapAtoB.has(key)) mapAtoB.set(key, new Set());
        mapAtoB.get(key)!.add(val);
        checked++;
      }
      // 每个 A 值对应唯一 B 值；排除 A 为唯一列（id/日期列天然函数决定一切 → trivial）
      const deps = [...mapAtoB.values()].filter((set) => set.size === 1).length;
      if (mapAtoB.size > 0 && deps / mapAtoB.size > 0.95 && !a.isUnique) {
        // 排除 A、B 都是 id 列（trivial）
        if (!(a.isUnique && b.isUnique)) {
          relations.push({
            type: "functional_dependency",
            columns: [a.name, b.name],
            detail: `${a.name} 的每个值唯一对应 ${b.name} 的一个值（覆盖率 ${(deps / mapAtoB.size).toFixed(2)}）`,
            strength: deps / mapAtoB.size,
          });
        }
      }
    }
  }

  // 3. 层级包含（两分类列，A 的值是 B 值的分隔前缀，如 省份-城市）
  const catCols = columns.filter((c) => "distribution" in c) as CategoryProfile[];
  for (let i = 0; i < catCols.length; i++) {
    for (let j = i + 1; j < catCols.length; j++) {
      const a = catCols[i];
      const b = catCols[j];
      // 取两列并集样本，检查 a 值是否为 b 值前缀（按 - / 分隔）
      const aVals = new Set(colData[a.index].map((v) => (v === null ? "" : String(v))).filter(Boolean));
      const bVals = new Set(colData[b.index].map((v) => (v === null ? "" : String(v))).filter(Boolean));
      let hit = 0;
      let total = 0;
      for (const bv of bVals) {
        const parts = bv.split(/\s*[-/]\s*/);
        if (parts.length >= 2 && aVals.has(parts[0])) {
          hit++;
        }
        total++;
      }
      if (total > 0 && hit / total > 0.5) {
        relations.push({
          type: "hierarchy",
          columns: [a.name, b.name],
          detail: `${b.name} 的值以 ${a.name} 为前缀（层级包含，命中 ${hit}/${total}）`,
          strength: hit / total,
        });
      }
    }
  }

  return relations;
}

/* ─────────────── 组装 ─────────────── */

/**
 * 生成完整画像结果
 * @param cleanedHeaders 清洗后表头
 * @param cleanedRows 清洗后数据行（对齐 headers）
 * @param columnTypes 每列类型
 * @param sheetName sheet 名
 */
export function profileTable(
  cleanedHeaders: string[],
  cleanedRows: unknown[][],
  columnTypes: FieldType[],
  sheetName = "Sheet1",
): TableProfileResult {
  const colCount = cleanedHeaders.length;
  const columns: ColumnProfileUnion[] = cleanedHeaders.map((name, i) =>
    profileColumn(name, i, cleanedRows.map((r) => r[i] ?? null), columnTypes[i] ?? "text"),
  );
  const relations = detectRelations(columns, cleanedRows);

  return {
    sheetName,
    rowCount: cleanedRows.length,
    colCount,
    columns,
    relations,
  };
}

/* ─────────────── EffectiveDataset 适配器（T1-A） ─────────────── */

/**
 * 从 cleaner 产出的 EffectiveDataset 生成画像，确保 profiler 的有效行/列数
 * 与 cleaner 声明的边界（effectiveRowCount / effectiveColumnCount）严格一致，
 * 不会从 raw 重建而丢失 excludedRows / excludedColumns 信息。
 *
 * 兼容性：原有的 profileTable(headers, rows, types, name) 签名保持不变，
 * 真实产品 API（app/api/brain/table/upload/route.ts）继续走旧路径；
 * 本适配器供确定性验证链与后续 T1-B/T1-C 使用。
 */
export function profileEffectiveDataset(ds: EffectiveDataset): TableProfileResult {
  const profile = profileTable(ds.headers, ds.rows, ds.columns, ds.sheetName);
  // 用 EffectiveDataset 边界覆盖（防止下游误用 rows.length 之外的口径）
  return {
    ...profile,
    sheetName: ds.sheetName,
    rowCount: ds.effectiveRowCount,
    colCount: ds.effectiveColumnCount,
  };
}
