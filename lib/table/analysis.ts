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
    case "topn":
      return execTopN(dimension, colIndex, fields, rows, columnTypes);
    case "mom":
      return execMoM(dimension, colIndex, fields, rows, columnTypes);
    case "groupbar":
      return execGroupBar(dimension, colIndex, fields, rows, columnTypes);
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

/**
 * TopN 排名：按分类字段分组求和数值字段，输出 Top N（默认 10）。
 * data: [{name, value, count}] 与 bar/pie 同构，图表可直接用 bar。
 */
function execTopN(
  d: AnalysisDimension,
  colIndex: (n: string) => number,
  fields: string[],
  rows: Row[],
  columnTypes: FieldType[],
): AnalysisExecutionResult {
  const groupIdx = colIndex(fields[0]);
  const valIdx = fields.length > 1 ? colIndex(fields[1]) : null;
  const valIsNumeric = valIdx !== null && isNumericType(columnTypes[valIdx]);
  // 支持从 description 提取 "Top N"（默认 10）
  const topN = /top\s*(\d+)/i.exec(d.description) ? Number(/top\s*(\d+)/i.exec(d.description)![1]) : 10;

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
    .sort((a, b) => b.value - a.value)
    .slice(0, topN);

  return {
    name: d.name,
    chartType: "bar",
    data,
    rows: rows.slice(0, 20),
    summary: `按 ${fields[0]} 排名 Top ${data.length}（值 = ${
      valIsNumeric ? fields[1] + " 合计" : "记录数"
    }）：1.${data[0]?.name}(${data[0]?.value.toFixed(1)}) 2.${data[1]?.name}(${data[1]?.value.toFixed(1)}) 3.${data[2]?.name}(${data[2]?.value.toFixed(1)})`,
  };
}

/**
 * 同比环比：日期列按周期（月/周/日，默认月）聚合数值字段，
 * 每期输出 {x, y, mom}（mom 为环比增速，无上期时为 null）。
 * 图表用 line 画 y；summary 给出环比最高/最低期，供 AI 解读。
 */
function execMoM(
  d: AnalysisDimension,
  colIndex: (n: string) => number,
  fields: string[],
  rows: Row[],
  columnTypes: FieldType[],
): AnalysisExecutionResult {
  const dateIdx = colIndex(fields[0]);
  const valIdx = fields.length > 1 ? colIndex(fields[1]) : null;
  const period = /月/.test(d.description) ? "month" : /周/.test(d.description) ? "week" : "month";

  const periodKey = (s: string): string => {
    // 期望 ISO 日期 YYYY-MM-DD；非日期格式原样返回
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return s;
    if (period === "month") return `${m[1]}-${m[2]}`;
    if (period === "week") {
      const d0 = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      const day = d0.getDay() || 7;
      const monday = new Date(d0.getTime() - (day - 1) * 86400_000);
      return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
    }
    return s.slice(0, 10);
  };

  const map = new Map<string, number>();
  for (const r of rows) {
    const key = periodKey(toStr(r[dateIdx]));
    const n = valIdx !== null ? toNum(r[valIdx]) : 1;
    if (n !== null) map.set(key, (map.get(key) || 0) + n);
  }
  const keys = [...map.keys()].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const data = keys.map((x, i) => {
    const y = map.get(x) ?? 0;
    const prev = i > 0 ? map.get(keys[i - 1]) : null;
    const mom = prev != null && prev !== 0 ? (y - prev) / prev : null;
    return { x, y, mom };
  });

  return {
    name: d.name,
    chartType: "line",
    data,
    rows: rows.slice(0, 20),
    summary: `${fields[0]} 按${period === "month" ? "月" : period === "week" ? "周" : "日"}聚合 ${
      fields[1] ?? "记录数"
    }（${data.length} 期），环比最大: ${
      data.filter((v) => v.mom !== null).sort((a, b) => (b.mom ?? -9) - (a.mom ?? -9))[0]?.x ?? "-"
    }，环比最小: ${
      data.filter((v) => v.mom !== null).sort((a, b) => (a.mom ?? 9) - (b.mom ?? 9))[0]?.x ?? "-"
    }`,
  };
}

/**
 * 分组多维对比：按分类字段分组，对多个数值字段（2-3 个）分别求均值，
 * 输出多 series 柱状图数据 {categories, series:[{name, data}]}。
 */
function execGroupBar(
  d: AnalysisDimension,
  colIndex: (n: string) => number,
  fields: string[],
  rows: Row[],
  columnTypes: FieldType[],
): AnalysisExecutionResult {
  const groupIdx = colIndex(fields[0]);
  const numFields = fields.slice(1).filter((f) => isNumericType(columnTypes[colIndex(f)]));
  const numIdxs = numFields.map(colIndex);
  if (numIdxs.length === 0) {
    // 无数值字段时退化为计数分组
    return execGroup(d, colIndex, [fields[0]], rows, columnTypes);
  }
  const agg = new Map<string, number[]>();
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = toStr(r[groupIdx]) || "(空)";
    let arr = agg.get(key);
    if (!arr) {
      arr = new Array(numIdxs.length).fill(0);
      agg.set(key, arr);
      counts.set(key, 0);
    }
    numIdxs.forEach((idx, k) => {
      const n = toNum(r[idx]);
      if (n !== null) arr[k] += n;
    });
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const categories = [...agg.keys()].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const series = numFields.map((f, k) => ({
    name: f,
    data: categories.map((c) => {
      const cnt = counts.get(c) || 1;
      return agg.get(c)![k] / cnt;
    }),
  }));
  const data = { categories, series };
  return {
    name: d.name,
    chartType: "bar",
    data,
    rows: rows.slice(0, 20),
    summary: `按 ${fields[0]} 分组对比 ${numFields.join(" / ")}（${categories.length} 组，各指标为组内均值）`,
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
  - description: 具体分析思路（用哪些字段、怎么算；TopN 排名可写 "Top 10"）
  - chartType: 'line'|'bar'|'pie'|'heatmap'|'scatter'|'boxplot'|'histogram'|'table'|'topn'|'mom'|'groupbar'
  - fields: 用到的字段名数组（按上述 chartType 要求的顺序）
  - insight: 预期能得出什么业务洞察

  图表类型说明：
  - topn：按某分类字段对数值字段排名（fields: [分类, 数值]）
  - mom：时间序列按周期（月/周）聚合 + 环比（fields: [日期, 数值]）
  - groupbar：按分类字段对比多个数值字段（fields: [分类, 数值1, 数值2, ...]）
  - 其余为基础图表。

  返回纯 JSON 数组，不要 markdown 代码块，不要其他文字。`;
}

/* ─────────────── 推荐维度可读化描述（前端展示用） ─────────────── */

/**
 * 把分析维度翻译成用户一眼能懂的「怎么算 + 示例」。
 * 不依赖 AI 的 description（可能抽象），全部由 chartType + 真实字段名 + 画像数据生成。
 * @param d 分析维度
 * @param profile 字段画像（取 distribution/mean/range 等拼真实示例）
 */
export function describeDimension(
  d: AnalysisDimension,
  profile: TableProfileResult,
): { how: string; example: string } {
  const f = d.fields;
  const f0 = f[0] ?? "";
  const f1 = f[1] ?? "";
  const quote = (s: string) => `「${s}」`;

  let how = "";
  switch (d.chartType) {
    case "topn":
      how = `按 ${quote(f0)} 统计 ${quote(f1)} 合计 · 排名柱状图`;
      break;
    case "mom":
      how = `按 ${quote(f0)} 按月聚合 ${quote(f1)} · 折线 + 环比`;
      break;
    case "groupbar":
      how = `按 ${quote(f0)} 对比 ${f.slice(1).map(quote).join(" / ")} · 分组柱状`;
      break;
    case "line":
      how = `按 ${quote(f0)} 的趋势（${quote(f1 || "记录数")}）· 折线`;
      break;
    case "bar":
      how = `按 ${quote(f0)} 分组统计 ${quote(f1 || "记录数")} · 柱状`;
      break;
    case "pie":
      how = `按 ${quote(f0)} 占比 · 饼图`;
      break;
    case "scatter":
      how = `${quote(f0)} 与 ${quote(f1)} 的相关性 · 散点`;
      break;
    case "histogram":
      how = `${quote(f0)} 的数值分布 · 直方图`;
      break;
    case "boxplot":
      how = `${quote(f0)} 的分布区间（异常值）· 箱线`;
      break;
    case "heatmap":
      how = `${quote(f0)} × ${quote(f1)} 交叉分布 · 热力图`;
      break;
    case "table":
      how = `${f.map(quote).join("、")} 明细列表`;
      break;
    default:
      how = `按 ${quote(f0)} 做分析`;
      break;
  }

  // 示例：用主字段的画像拼真实值
  const col = profile.columns.find((c) => c.name === f0);
  let example = "";
  if (col && "distribution" in col) {
    example = col.distribution
      .slice(0, 3)
      .map((x) => `${x.value} ${(x.percentage * 100).toFixed(0)}%`)
      .join(" · ");
  } else if (col && "mean" in col) {
    example = `均值 ${col.mean.toFixed(1)} · 范围 ${col.min}~${col.max}`;
  } else if (col && "minDate" in col) {
    example = `${col.minDate} ~ ${col.maxDate}`;
  } else if (col) {
    example = `唯一值 ${col.uniqueCount.toLocaleString()} 个`;
  }
  return { how, example };
}
