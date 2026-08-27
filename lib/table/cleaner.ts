/**
 * 表格处理 —— 清洗标准化层（Step 3）
 *
 * 链路：detectHeaderRow → cleanCellValue（逐 cell）→ inferColumnType（逐列）→ cleanSheet 整合。
 * 纯计算，错误信息明确抛出；覆盖第二段规格：全角→半角/千分位/中文单位/百分比/货币/括号负数/Excel 序列号/季度标记等。
 */

import type { EffectiveDataset, ExcludedColumn, ExcludedRow, FieldType, SheetInfo } from "./types";

/* ─────────────── 单元常量 ─────────────── */

/** 常见空值文本（不区分大小写） */
const NULL_LIKE_PATTERNS = /^(n\/?a|null|nil|无|没有|暂无|-{1,2}|—|--|nan)$/i;

/** 布尔判定：匹配 80% 以上即认为列是 boolean */
const BOOLEAN_REGEX = /^(true|false|是|否|yes|no|y|n|t|f)$/i;

/** 日期判定（粗筛：表层符合日期格式才进入深解析） */
const DATE_SURFACE_REGEX =
  /^(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/;

/** 货币符号 */
const CURRENCY_REGEX = /[¥$€£￥]/;

/** 中文大数单位 */
const CHINESE_UNIT = /[万亿]$/;

/* ─────────────── 单 cell 清洗 ─────────────── */

/**
 * 单 cell 清洗：空白处理 → 空值匹配 → 数字/日期解析 → 返回原 string（兜底）
 * @param value 原始值
 * @param inferredType 可选；指定后会优先按该类型解析
 */
export function cleanCellValue(value: unknown, inferredType?: FieldType): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return value;

  // ① 空白字符处理：全角→半角、零宽字符删除、trim、连续空白压缩
  const s = value
    .replace(/\u3000/g, " ") // 全角空格
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // 零宽字符
    .trim()
    .replace(/\s+/g, " ");

  if (s === "") return null;

  // ② 空值标准化（"0" 保留）
  if (s === "0" || s === "0.0" || s === "0.00") return 0;
  if (NULL_LIKE_PATTERNS.test(s)) return null;

  // ③ 数字解析
  if (
    !inferredType ||
    inferredType === "integer" ||
    inferredType === "float" ||
    inferredType === "percentage" ||
    inferredType === "currency"
  ) {
    const num = parseNumericString(s);
    if (num !== null) return num;
  }

  // ④ 日期解析
  if (!inferredType || inferredType === "date") {
    const date = parseDateString(s);
    if (date !== null) return date;
  }

  // ⑤ 兜底：返回清洗后的字符串
  return s;
}

/**
 * 数字字符串解析：覆盖 千分位 / 中文单位 / 百分比 / 货币 / 括号负数 / 中文负数 / 科学计数
 * @returns 数字；解析失败返回 null
 */
export function parseNumericString(s: string): number | null {
  if (!s) return null;
  let t = s.trim();
  if (!t) return null;

  // 括号负数 (500) → -500
  if (/^\(.*\)$/.test(t)) t = "-" + t.slice(1, -1);

  // 中文负数 "负500" → -500
  t = t.replace(/^负(?=[\d.])/, "-");

  // 货币符号
  t = t.replace(CURRENCY_REGEX, "");

  // 千分位逗号
  t = t.replace(/,/g, "");

  // 中文单位
  let mult = 1;
  if (t.endsWith("亿")) {
    mult = 1e8;
    t = t.slice(0, -1);
  } else if (t.endsWith("万")) {
    mult = 1e4;
    t = t.slice(0, -1);
  }

  // 百分比
  let isPct = false;
  if (t.endsWith("%")) {
    isPct = true;
    t = t.slice(0, -1);
  }

  const num = Number(t);
  if (!Number.isFinite(num)) return null;
  return isPct ? num / 100 : num * mult;
}

/**
 * 日期字符串解析：覆盖 5 种格式 + Excel 序列号 + Unix 时间戳
 * @returns ISO 字符串（YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS）；无法解析返回 null
 */
export function parseDateString(s: string): string | null {
  const t = s.trim();
  if (!t) return null;

  // 1. ISO YYYY-MM-DD 或 YYYY/MM/DD（可含时间）
  let m = t.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/,
  );
  if (m) {
    return formatDate(+m[1], +m[2], +m[3], m[4] !== undefined ? +m[4] : undefined);
  }

  // 2. 中文 YYYY年M月D日
  m = t.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (m) return formatDate(+m[1], +m[2], +m[3]);

  // 3. 美式 MM/DD/YYYY 或 欧式 DD/MM/YYYY（若首段>12 必为欧式）
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    if (a > 12) return formatDate(+m[3], b, a); // 欧式
    return formatDate(+m[3], a, b); // 美式
  }

  // 4. 两位年 MM/DD/YY
  m = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    const y = 2000 + +m[3];
    if (a > 12) return formatDate(y, b, a);
    return formatDate(y, a, b);
  }

  // 5. Excel 序列号（数字 1000~100000 → 1900-01-01 起算）
  if (/^\d{4,5}(\.\d+)?$/.test(t)) {
    const n = Number(t);
    if (n >= 1000 && n < 100000) {
      return excelSerialToISO(n);
    }
  }

  // 6. Unix 时间戳（10 位秒级，13 位毫秒级）
  if (/^\d{10}$/.test(t)) {
    const d = new Date(+t * 1000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (/^\d{13}$/.test(t)) {
    const d = new Date(+t);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 19).replace("T", " ");
  }

  return null;
}

/** Excel 序列号 → ISO（1900 系统，含 1900 闰年 bug） */
function excelSerialToISO(n: number): string {
  // 1899-12-30 作为基准（避开 Excel 1900-02-29 假闰日）
  const base = Date.UTC(1899, 11, 30);
  const d = new Date(base + Math.floor(n) * 86400_000);
  return d.toISOString().slice(0, 10);
}

function formatDate(y: number, mo: number, d: number, h?: number): string | null {
  if (!isValidDate(y, mo, d)) return null;
  const date = `${pad4(y)}-${pad2(mo)}-${pad2(d)}`;
  if (h === undefined || isNaN(h)) return date;
  return `${date} ${pad2(h)}:00:00`;
}

function isValidDate(y: number, mo: number, d: number): boolean {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  if (y < 1900 || y > 2100) return false;
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function pad4(n: number): string {
  return String(n).padStart(4, "0");
}

/* ─────────────── 表头识别 ─────────────── */

/**
 * 自动检测表头行索引：扫描前 10 行打分（最高分行 = 表头）
 * 打分维度：非空率(40) + 字符串占比(30) + 与下一行类型差异(20) + 唯一性(10)
 */
export function detectHeaderRow(rows: unknown[][]): number {
  const MAX = 10;
  const candidates = rows.slice(0, MAX);
  if (candidates.length === 0) return 0;

  let best = 0;
  let bestScore = -1;

  for (let i = 0; i < candidates.length; i++) {
    const row = candidates[i] || [];
    const next = candidates[i + 1] || [];
    let score = 0;

    // ① 非空率
    const nonEmpty = row.filter((c) => c != null && String(c).trim() !== "").length;
    const nonEmptyRate = row.length > 0 ? nonEmpty / row.length : 0;
    score += nonEmptyRate * 40;

    // ② 字符串占比（表头通常全是文本）
    const strCount = row.filter((c) => typeof c === "string" || c == null).length;
    const strRate = row.length > 0 ? strCount / row.length : 0;
    score += strRate * 30;

    // ③ 与下一行的类型差异（表头全字符串，下一行开始有数字/日期）
    if (next.length > 0) {
      const nextNumeric = next.filter(
        (c) =>
          typeof c === "number" ||
          (typeof c === "string" && /^-?[\d.,]+/.test(String(c).trim())),
      ).length;
      const nextNumericRate = nextNumeric / next.length;
      score += nextNumericRate * 20;
    }

    // ④ 唯一性（表头不应有重复）
    const seen = new Set<string>();
    let unique = 0;
    for (const c of row) {
      const k = String(c ?? "").trim();
      if (k && !seen.has(k)) {
        seen.add(k);
        unique++;
      }
    }
    const uniqueRate = row.length > 0 ? unique / row.length : 0;
    score += uniqueRate * 10;

    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }

  return best;
}

/* ─────────────── 字段类型推断 ─────────────── */

/**
 * 字段类型推断（按优先级）：boolean → date → number → percentage → currency → string(category|text)
 * @param values 同一列的样本（已清洗或原始都可）
 */
export function inferColumnType(values: unknown[]): FieldType {
  const nonNull = values.filter((v) => {
    if (v === null || v === undefined) return false;
    const s = String(v).trim();
    return s !== "" && !NULL_LIKE_PATTERNS.test(s);
  });
  if (nonNull.length === 0) return "text";

  // 1. boolean
  const boolCount = nonNull.filter((v) => BOOLEAN_REGEX.test(String(v).trim())).length;
  if (boolCount / nonNull.length > 0.8) return "boolean";

  // 2. date
  const dateCount = nonNull.filter((v) => {
    const s = String(v).trim();
    if (!DATE_SURFACE_REGEX.test(s)) return false;
    if (parseDateString(s) === null) return false;
    return true;
  }).length;
  if (dateCount / nonNull.length > 0.8) return "date";

  // 3. number（含 percentage / currency / integer / float）
  const numericValues: number[] = [];
  let pctCount = 0;
  let currencyCount = 0;
  for (const v of nonNull) {
    const s = String(v).trim();
    if (/%$/.test(s)) pctCount++;
    if (CURRENCY_REGEX.test(s) || (CHINESE_UNIT.test(s) && /^\d/.test(s))) currencyCount++;
    const n = parseNumericString(s);
    if (n !== null) numericValues.push(n);
  }
  if (numericValues.length / nonNull.length > 0.8) {
    if (pctCount / nonNull.length > 0.5) return "percentage";
    if (currencyCount / nonNull.length > 0.5) return "currency";
    const intCount = numericValues.filter((n) => Number.isInteger(n)).length;
    if (intCount / numericValues.length > 0.9) return "integer";
    return "float";
  }

  // 4. string：category vs text（unique 占比 < 10% 且 unique 数 < 50 → category）
  const unique = new Set(nonNull.map((v) => String(v).trim()));
  if (unique.size / nonNull.length < 0.1 && unique.size < 50) return "category";
  return "text";
}

/* ─────────────── Sheet 整合 ─────────────── */

/**
 * 清洗整个 sheet：
 *  - 表头识别：用 detectHeaderRow 在【表头+数据行合并】里重新打分（不信任 parser.headers，
 *    避免用户表的"说明/标题行"被误当表头），命中后从该行下方取数据。
 *  - 重复列名加序号 + 逐 cell 清洗 + 逐列类型推断
 *
 * 上游若有可信的 sheet.headers（如已人工标注），可显式传 options.headerIdx 跳过重测。
 */
export function cleanSheet(
  sheet: SheetInfo,
  options: { headerIdx?: number } = {},
): {
  cleanedHeaders: string[];
  cleanedRows: unknown[][];
  columnTypes: FieldType[];
} {
  if (!sheet || !Array.isArray(sheet.rows) || sheet.rows.length === 0) {
    return { cleanedHeaders: [], cleanedRows: [], columnTypes: [] };
  }

  // 把 parser 提取的 sheet.headers 放回第一行，让 detectHeaderRow 在完整数据上打分
  const allRows: unknown[][] = [
    ...(Array.isArray(sheet.headers) && sheet.headers.length > 0 ? [sheet.headers as unknown[]] : []),
    ...sheet.rows,
  ];

  // 表头行索引：默认重测；显式传 headerIdx 跳过
  const headerIdx = options.headerIdx ?? detectHeaderRow(allRows);
  const rawHeaders = allRows[headerIdx] || [];

  // 表头清洗：trim，空名兜底为 column_N
  let cleanedHeaders = rawHeaders.map((h, i) => {
    const s = String(h ?? "").trim();
    return s === "" ? `column_${i + 1}` : s;
  });

  // 重复列名加序号
  const seen = new Map<string, number>();
  cleanedHeaders = cleanedHeaders.map((h) => {
    const n = (seen.get(h) || 0) + 1;
    seen.set(h, n);
    return n > 1 ? `${h}_${n}` : h;
  });

  // 数据行（表头之后）
  const dataRows = allRows.slice(headerIdx + 1);

  // 收集每列值（用于类型推断）
  const colCount = cleanedHeaders.length;
  const columns: unknown[][] = Array.from({ length: colCount }, () => []);
  for (const row of dataRows) {
    for (let i = 0; i < colCount; i++) {
      columns[i].push(row[i] ?? null);
    }
  }

  // 逐列推断类型
  const columnTypes: FieldType[] = columns.map(inferColumnType);

  // 逐 cell 清洗（按列类型优先解析）
  const cleanedRows = dataRows.map((row) =>
    Array.from({ length: colCount }, (_, i) => cleanCellValue(row[i], columnTypes[i])),
  );

  return { cleanedHeaders, cleanedRows, columnTypes };
}

/* ─────────────── EffectiveDataset 边界（T1-A） ─────────────── */

/**
 * 在 cleanSheet 之上产出 EffectiveDataset：parser / cleaner / profiler 之间
 * 唯一、可追踪的「有效数据集边界」。
 *
 * 设计铁律（T1-A）：
 *  - 不复制整行：rows 直接复用 cleanSheet 产出的引用，避免双倍内存；
 *  - 仅「捕获并传递边界」：本阶段不新增空行/幽灵列裁剪算法（属 T1-B/T1-C），
 *    因此 excludedRows / excludedColumns 默认空；effectiveRowCount/ColumnCount
 *    与 cleanSheet 当前产出一致；
 *  - 下游 profiler 必须消费本结构（或经 profileEffectiveDataset 适配器），
 *    不得从 raw 重建而丢失边界信息。
 *
 * @param options.headerIdx 显式表头行（跳过 detectHeaderRow 重测）；不传则由 cleanSheet 内部重测。
 */
export function buildEffectiveDataset(
  sheet: SheetInfo,
  options: { headerIdx?: number } = {},
): EffectiveDataset {
  // 复用 cleanSheet 已计算的表头行，避免重复打分导致边界不一致
  const headerIdx =
    options.headerIdx ??
    detectHeaderRow([
      ...(Array.isArray(sheet.headers) && sheet.headers.length > 0 ? [sheet.headers as unknown[]] : []),
      ...sheet.rows,
    ]);
  const cleaned = cleanSheet(sheet, { headerIdx });

  const hasParsedHeader = Array.isArray(sheet.headers) && sheet.headers.length > 0;
  // 原始行数 = 解析表头(若有) + 数据行；原始列数 = 解析表头与各数据行的最大宽度
  const rawRowCount = (hasParsedHeader ? 1 : 0) + sheet.rows.length;
  const rawColumnCount = Math.max(
    sheet.headers?.length ?? 0,
    ...sheet.rows.map((r) => r.length),
    0,
  );

  const excludedRows: ExcludedRow[] = [];
  const excludedColumns: ExcludedColumn[] = [];
  const warnings: string[] = [];

  return {
    sheetId: sheet.name,
    sheetName: sheet.name,
    detectedHeaderRow: headerIdx,
    rawRowCount,
    rawColumnCount,
    effectiveRowCount: cleaned.cleanedRows.length,
    effectiveColumnCount: cleaned.cleanedHeaders.length,
    headers: cleaned.cleanedHeaders,
    rows: cleaned.cleanedRows,
    columns: cleaned.columnTypes,
    excludedRows,
    excludedColumns,
    warnings,
  };
}
