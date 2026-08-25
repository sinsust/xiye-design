/**
 * 表格处理 —— 分析执行层
 *
 * 纯 JS 计算（不经过 AI）：按 AnalysisDimension 执行聚合/排名/交叉/趋势/分布/异常检测。
 * AI 只负责：推荐维度、自然语言解读、自然语言查询理解。
 */

import type {
  AnalysisDimension,
  AnalysisExecutionResult,
  FieldType,
  TableProfileResult,
} from "./types";

/** 明细行的数值类型容忍 */
type Row = unknown[];

/* ─────────────── 主入口 ─────────────── */

/**
 * 执行一个分析维度（纯 JS 计算）
 * @param dimension 分析维度（AI 推荐或用户选择）
 * @param headers 清洗后表头
 * @param rows 清洗后数据行
 * @param columnTypes 每列类型
 */
export function executeDimension(
  dimension: AnalysisDimension,
  headers: string[],
  rows: Row[],
  columnTypes: FieldType[],
): AnalysisExecutionResult {
  const colIndex = (name: string): number => {
    const idx = headers.indexOf(name);
    if (idx === -1) {
      throw new Error(`字段不存在: ${name}`);
    }
    return idx;
  };
  const fields = dimension.fields.length > 0 ? dimension.fields : inferFields(headers, columnTypes);

  switch (dimension.chartType) {
    case "line":
      return execLine(dimension, colIndex, fields, rows, columnTypes);
    case "bar":
    case "pie":
      return execGroup(dimension, colIndex, fields, rows, columnTypes);
    case "scatter":
      return execScatter(dimension, colIndex, fields, rows);
    case "histogram":
      return execHistogram(dimension, colIndex, fields, rows);
    case "boxplot":
      return execBoxplot(dimension, colIndex, fields, rows);
    case "heatmap":
      return execHeatmap(dimension, colIndex, fields, rows);
    case "table":
    default:
      return execTable(dimension, colIndex, fields, rows);
  }
}

/** 未指定 fields 时按类型推断：优先第一个非 text 的列 */
function inferFields(headers: string[], columnTypes: FieldType[]): string[] {
  const numeric = headers.filter((_, i) => isNumericType(columnTypes[i]));
  const categorical = headers.filter((_, i) => columnTypes[i] === "category" || columnTypes[i] === "boolean");
  if (numeric.length >= 2) return [categorical[0] || headers[0], numeric[0]];
  if (categorical.length >= 1 && numeric.length >= 1) return [categorical[0], numeric[0]];
  return headers.slice(0, 2);
}

function isNumericType(t: FieldType): boolean {
  return t === "integer" || t === "float" || t === "percentage" || t === "currency";
}

/** 取单元格数值（容忍 number/string） */
function toNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toStr(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

/* ─────────────── 各图表执行器 ─────────────── */

/** 折线：按日期/分类 key 排序聚合 */
function execLine(
  d: AnalysisDimension,
  colIndex: (n: string) => number,
  fields: string[],
  rows: Row[],
  columnTypes: FieldType[],
): AnalysisExecutionResult {
  const xIdx = colIndex(fields[0]);
  const yIdx = fields.length > 1 ? colIndex(fields[1]) : null;
  const yIsNumeric = yIdx !== null && isNumericType(columnTypes[yIdx]);

  const map = new Map<string, { sum: number; count: number; total: number }>();
  for (const r of rows) {
    const key = toStr(r[xIdx]) || "(空)";
    const entry = map.get(key) || { sum: 0, count: 0, total: 0 };
    entry.total++;
    const n = yIdx !== null ? toNum(r[yIdx]) : null;
    if (n !== null) {
      entry.sum += n;
      entry.count++;
    }
    map.set(key, entry);
  }

  const data = [...map.entries()]
    .map(([x, v]) => ({
      x,
      y: yIsNumeric ? (v.count > 0 ? v.sum / v.count : 0) : v.count,
      count: v.total,
    }))
    .sort((a, b) => a.x.localeCompare(b.x, "zh-CN"));

  return {
    name: d.name,
    chartType: "line",
    data,
    rows: rows.slice(0, 20),
    summary: `${fields[0]} 按时间/类别趋势（共 ${data.length} 个点），Y 轴 = ${
      yIsNumeric ? fields[1] + " 均值" : "记录数"
    }`,
  };
}

/** 柱/饼：按分类字段分组聚合数值（sum/mean/count） */
function execGroup(
  d: AnalysisDimension,
  colIndex: (n: string) => number,
  fields: string[],
  rows: Row[],
  columnTypes: FieldType[],
): AnalysisExecutionResult {
  const groupIdx = colIndex(fields[0]);
  const valIdx = fields.length > 1 ? colIndex(fields[1]) : null;
  const valIsNumeric = valIdx !== null && isNumericType(columnTypes[valIdx]);

  const map = new Map<string, { sum: number; count: number; n: number }>();
  for (const r of rows) {
    const key = toStr(r[groupIdx]) || "(空)";
    const entry = map.get(key) || { sum: 0, count: 0, n: 0 };
    entry.n++;
    if (valIdx !== null) {
      const v = toNum(r[valIdx]);
      if (v !== null) {
        entry.sum += v;
        entry.count++;
      }
    }
    map.set(key, entry);
  }

  const data = [...map.entries()]
    .map(([name, e]) => ({
      name,
      value: valIsNumeric ? (e.count > 0 ? e.sum / e.count : 0) : e.n,
      count: e.n,
    }))
    .sort((a, b) => b.value - a.value);

  return {
    name: d.name,
    chartType: d.chartType,
    data,
    rows: rows.slice(0, 20),
    summary: `按 ${fields[0]} 分组（${data.length} 组），值 = ${
      valIsNumeric ? fields[1] + " 均值" : "记录数"
    }；Top: ${data.slice(0, 3).map((x) => `${x.name}(${x.value.toFixed(1)})`).join("、")}`,
  };
}

/** 散点：两数值列配对 */
function execScatter(
  d: AnalysisDimension,
  colIndex: (n: string) => number,
  fields: string[],
  rows: Row[],
): AnalysisExecutionResult {
  const xIdx = colIndex(fields[0]);
  const yIdx = colIndex(fields[1]);
  const data: { x: number; y: number }[] = [];
  for (const r of rows) {
    const x = toNum(r[xIdx]);
    const y = toNum(r[yIdx]);
    if (x !== null && y !== null) data.push({ x, y });
  }
  return {
    name: d.name,
    chartType: "scatter",
    data,
    rows: rows.slice(0, 20),
    summary: `${fields[0]} vs ${fields[1]}（${data.length} 对有效样本）`,
  };
}

/** 直方图：数值列 20 桶 */
function execHistogram(
  d: AnalysisDimension,
  colIndex: (n: string) => number,
  fields: string[],
  rows: Row[],
): AnalysisExecutionResult {
  const idx = colIndex(fields[0]);
  const nums = rows.map((r) => toNum(r[idx])).filter((n): n is number => n !== null);
  const data = buildHistogram(nums, 20);
  return {
    name: d.name,
    chartType: "histogram",
    data,
    rows: rows.slice(0, 20),
    summary: `${fields[0]} 分布（${nums.length} 个有效值，20 桶）`,
  };
}

/** 箱线图：数值列 min/q1/median/q3/max */
function execBoxplot(
  d: AnalysisDimension,
  colIndex: (n: string) => number,
  fields: string[],
  rows: Row[],
): AnalysisExecutionResult {
  const idx = colIndex(fields[0]);
  const nums = rows.map((r) => toNum(r[idx])).filter((n): n is number => n !== null);
  const sorted = [...nums].sort((a, b) => a - b);
  const q = (p: number) => {
    if (sorted.length === 0) return 0;
    const pos = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  };
  const data = {
    min: sorted[0] ?? 0,
    q1: q(25),
    median: q(50),
    q3: q(75),
    max: sorted[sorted.length - 1] ?? 0,
    count: sorted.length,
  };
  return {
    name: d.name,
    chartType: "boxplot",
    data,
    rows: rows.slice(0, 20),
    summary: `${fields[0]} 箱线：min=${data.min} q1=${data.q1} median=${data.median} q3=${data.q3} max=${data.max}（n=${data.count}）`,
  };
}

/** 热力图：两分类列交叉计数 */
function execHeatmap(
  d: AnalysisDimension,
  colIndex: (n: string) => number,
  fields: string[],
  rows: Row[],
): AnalysisExecutionResult {
  const xIdx = colIndex(fields[0]);
  const yIdx = colIndex(fields[1]);
  const map = new Map<string, number>();
  const xSet = new Set<string>();
  const ySet = new Set<string>();
  for (const r of rows) {
    const x = toStr(r[xIdx]) || "(空)";
    const y = toStr(r[yIdx]) || "(空)";
    xSet.add(x);
    ySet.add(y);
    const key = `${x}\u0000${y}`;
    map.set(key, (map.get(key) || 0) + 1);
  }
  const xs = [...xSet];
  const ys = [...ySet];
  const data = {
    x: xs,
    y: ys,
    values: xs.map((x) => ys.map((y) => map.get(`${x}\u0000${y}`) || 0)),
  };
  return {
    name: d.name,
    chartType: "heatmap",
    data,
    rows: rows.slice(0, 20),
    summary: `${fields[0]} × ${fields[1]} 交叉分布（${xs.length} × ${ys.length}）`,
  };
}

/** 表格：Top N 明细 */
function execTable(
  d: AnalysisDimension,
  colIndex: (n: string) => number,
  fields: string[],
  rows: Row[],
): AnalysisExecutionResult {
  const idxs = fields.map(colIndex);
  const data = rows.slice(0, 50).map((r) => {
    const row: Record<string, unknown> = {};
    idxs.forEach((i, k) => {
      row[fields[k] ?? `col_${i}`] = r[i] ?? null;
    });
    return row;
  });
  return {
    name: d.name,
    chartType: "table",
    data,
    rows,
    summary: `${fields.join("、")} 明细（展示前 ${data.length} 条 / 共 ${rows.length} 条）`,
  };
}

/** 等宽直方图（与分析画像共用同一算法，避免复制） */
function buildHistogram(nums: number[], bins: number): { start: number; end: number; count: number }[] {
  if (nums.length === 0) return [];
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (min === max) return [{ start: min, end: max + 1, count: nums.length }];
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

/* ─────────────── AI 推荐 Prompt（第二段模板） ─────────────── */

/**
 * 构造 AI 推荐维度 prompt
 * @param profile 字段画像
 * @param fileName 文件名（可选）
 */
export function buildRecommendPrompt(profile: TableProfileResult, fileName?: string): string {
  const lines = profile.columns.map((col) => {
    const base = `${col.name} · ${col.type}`;
    if ("distribution" in col) {
      return `${base} · ${col.totalCategories}类 · ${col.isBalanced ? "均衡" : "偏态"} · Top:${col.topCategory}(${(col.topCategoryPercentage * 100).toFixed(0)}%)`;
    }
    if ("mean" in col) {
      return `${base} · 均值${col.mean.toFixed(1)} · 中位数${col.median.toFixed(1)} · 范围${col.min}~${col.max}${col.hasOutliers ? " · ⚠️异常值" : ""}`;
    }
    if ("minDate" in col) {
      return `${base} · ${col.minDate}~${col.maxDate} · ${col.detectedGranularity}粒度 · ${col.isContinuous ? "连续" : "有缺失"}`;
    }
    return `${base} · 唯一值${col.uniqueCount} · 非空率${(col.nonNullRate * 100).toFixed(0)}%`;
  });

  const relLines = profile.relations.map(
    (r) => `- ${r.columns.join(" ↔ ")} (${r.type}, strength=${r.strength.toFixed(2)})`,
  );

  return `你是数据分析专家。以下是表格字段画像摘要（${profile.rowCount}行×${profile.colCount}列${fileName ? `，文件：${fileName}` : ""}）：

${lines.join("\n")}

跨列关联：
${relLines.join("\n") || "无显著关联"}

请推荐 8-10 个有价值的分析维度，每个包含：
- name: 分析名称（简短）
- description: 具体分析思路（用哪些字段、怎么算）
- chartType: 'line'|'bar'|'pie'|'heatmap'|'scatter'|'boxplot'|'histogram'|'table'
- fields: 用到的字段名数组
- insight: 预期能得出什么业务洞察

返回纯 JSON 数组，不要 markdown 代码块，不要其他文字。`;
}
