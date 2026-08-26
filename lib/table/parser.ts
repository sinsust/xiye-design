/**
 * 表格处理 —— 文件解析层（Step 2）
 *
 * 链路：detectFileType → detectEncoding → 格式分发解析 → SheetInfo[]。
 * 所有函数 JSDoc；纯计算，错误信息明确抛出。
 */

import * as XLSX from "xlsx";
import * as chardet from "chardet";
import * as Papa from "papaparse";
import * as iconv from "iconv-lite";

import { detectFileMagic, type TableFileKind } from "./file-magic";
import type { ParsedTable, SheetInfo } from "./types";

/* ─────────────── 类型识别 ─────────────── */

/** 解析器层认得的"文件类型"（含 csv/tsv 二者，TSV 由分隔符层区分） */
export type DetectedFileType =
  | "xlsx"
  | "xls"
  | "csv"
  | "tsv"
  | "json"
  | "html"
  | "unknown";

/**
 * 通过文件魔数识别真实文件类型
 * @param buffer 原始字节
 * @returns 真实类型（不信任扩展名）
 */
export function detectFileType(buffer: Buffer): DetectedFileType {
  const kind: TableFileKind = detectFileMagic(buffer);
  return kind === "csv-text" ? "csv" : (kind as DetectedFileType);
}

/* ─────────────── 编码检测 ─────────────── */

const FALLBACK_ENCODINGS = ["utf-8", "gbk", "big5", "shift-jis", "latin1"] as const;

/**
 * 检测文件编码。置信度 < 0.7 时遍历兜底列表，取"替换字符数最少"的编码。
 * @param buffer 原始字节
 * @returns 编码名
 */
export function detectEncoding(buffer: Buffer): string {
  if (!buffer || buffer.length === 0) return "utf-8";

  // 优先 chardet
  let bestName = "";
  let bestConf = 0;
  try {
    const res = chardet.analyse(buffer);
    if (Array.isArray(res) && res.length > 0) {
      bestName = (res[0].name || "").toLowerCase();
      bestConf = res[0].confidence ?? 0;
    }
  } catch {
    /* chardet 失败时走兜底 */
  }

  // 高置信度 → 直接采用（规范化常见名）
  if (bestConf >= 0.7 && bestName) {
    return normalizeEncoding(bestName);
  }

  // 兜底：尝试多种编码，取替换字符(U+FFFD) 最少的
  const sample = buffer.length > 4096 ? buffer.slice(0, 4096) : buffer;
  let chosen = "utf-8";
  let chosenLoss = Infinity;
  for (const enc of FALLBACK_ENCODINGS) {
    try {
      const text = iconv.decode(sample, enc);
      const loss = countReplacementChars(text);
      if (loss < chosenLoss) {
        chosenLoss = loss;
        chosen = enc;
        if (loss === 0) break;
      }
    } catch {
      /* 跳过不支持的编码 */
    }
  }
  return chosen;
}

/** 把 chardet 返回的常见名归一为 iconv 接受的字串 */
function normalizeEncoding(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("utf-8") || n.includes("utf8")) return "utf-8";
  if (n.includes("gb2312") || n.includes("gbk") || n.includes("gb18030")) return "gbk";
  if (n.includes("big5")) return "big5";
  if (n.includes("shift_jis") || n.includes("shift-jis")) return "shift-jis";
  if (n.includes("latin1") || n.includes("iso-8859")) return "latin1";
  return n || "utf-8";
}

/** 计算字符串中的 U+FFFD 数量（解码乱码的近似度量） */
function countReplacementChars(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 0xfffd) n++;
  }
  return n;
}

/* ─────────────── 主入口 ─────────────── */

/**
 * 解析上传的表格文件，返回所有 sheet 的原始数据（未清洗）
 * @param buffer 原始字节
 * @param fileName 原始文件名（用于扩展名兜底）
 */
export async function parseFile(buffer: Buffer, fileName: string): Promise<ParsedTable> {
  if (!buffer || buffer.length === 0) {
    throw new Error("parseFile: 文件为空");
  }

  const encoding = detectEncoding(buffer);
  const kind = detectFileType(buffer);

  let sheets: SheetInfo[];
  switch (kind) {
    case "xlsx":
    case "xls":
      sheets = parseXlsx(buffer);
      break;
    case "csv":
    case "tsv": {
      const text = decodeBuffer(buffer, encoding);
      const delim = kind === "tsv" ? "\t" : detectDelimiter(text);
      sheets = parseCsvLike(text, delim);
      break;
    }
    case "json": {
      const text = decodeBuffer(buffer, encoding);
      sheets = parseJsonText(text, fileName);
      break;
    }
    case "html": {
      const text = decodeBuffer(buffer, encoding);
      sheets = parseHtmlTable(text, fileName);
      break;
    }
    case "unknown":
    default:
      throw new Error(
        `parseFile: 不支持的文件类型（kind=${kind}, name=${fileName}）。已支持：xlsx/xls/csv/tsv/json/html`,
      );
  }

  return { fileName, encoding, sheets };
}

/* ─────────────── 格式分发解析 ─────────────── */

/** 解析 xlsx/xls（xlsx 库统一处理） */
function parseXlsx(buffer: Buffer): SheetInfo[] {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: true });
  } catch (e) {
    throw new Error(`xlsx 解析失败: ${(e as Error).message}`);
  }
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    if (!ws) return { name, headers: [], rows: [], rowCount: 0, colCount: 0 };
    // header: 1 → 二维数组；raw: true 保留原始类型；defval:null 给空单元格
    const arr = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: true,
      defval: null,
    });

    // 幽灵列裁剪：!ref 常被 Excel 格式/模板残留撑大（如 A1:ZZ100 全是空列），
    // 按"所有行最后一个非空单元格列 + 1"计算有效列数，避免虚高列数触发列数上限。
    let effectiveCols = 1;
    for (const row of arr) {
      for (let i = row.length - 1; i >= 0; i--) {
        const v = row[i];
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          effectiveCols = Math.max(effectiveCols, i + 1);
          break;
        }
      }
    }
    const trimmed = arr.map((row) => row.slice(0, effectiveCols));

    const headerRow = (trimmed[0] || []) as unknown[];
    const headers = headerRow.map((h) => (h == null ? "" : String(h)));
    const rows = trimmed.slice(1).map((row) => {
      const r = row as unknown[];
      // 补齐到与 headers 等长，避免后续处理越界
      if (r.length < headers.length) {
        const filled = r.slice();
        while (filled.length < headers.length) filled.push(null);
        return filled;
      }
      return r;
    });
    return {
      name,
      headers,
      rows,
      rowCount: rows.length,
      colCount: headers.length,
    };
  });
}

/** 自动检测分隔符：取前 N 行，统计每行四种分隔符出现次数，最多的胜出 */
function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 10).join("\n");
  const candidates: Array<[string, number]> = [
    [",", 0],
    ["\t", 0],
    [";", 0],
    ["|", 0],
  ];
  for (const [d, _] of candidates) {
    const matches = sample.split(d).length - 1;
    candidates[candidates.findIndex(([k]) => k === d)][1] = matches;
  }
  // 选最多的；并列时偏好逗号
  candidates.sort((a, b) => b[1] - a[1] || (a[0] === "," ? -1 : 1));
  return candidates[0][1] > 0 ? candidates[0][0] : ",";
}

/** papaparse 解析 csv/tsv-like 文本 */
function parseCsvLike(text: string, delimiter: string): SheetInfo[] {
  const result = Papa.parse<string[]>(text, {
    delimiter,
    header: false,
    skipEmptyLines: "greedy",
    transform: (v) => (v === "" ? null : v),
  });
  if (!result.data || result.data.length === 0) {
    return [{ name: "Sheet1", headers: [], rows: [], rowCount: 0, colCount: 0 }];
  }
  const first = result.data[0] as string[];
  const headers = first.map((h) => (h == null ? "" : String(h)));
  const rows = result.data.slice(1) as unknown[][];
  // 补齐到等长
  const normalized = rows.map((r) => {
    if (r.length < headers.length) {
      const filled = r.slice();
      while (filled.length < headers.length) filled.push(null);
      return filled;
    }
    return r.slice(0, headers.length);
  });
  return [
    {
      name: "Sheet1",
      headers,
      rows: normalized,
      rowCount: normalized.length,
      colCount: headers.length,
    },
  ];
}

/** JSON 解析：行式 [{...},{...}] 展平为二维；嵌套按 top-level keys 展平 */
function parseJsonText(text: string, fileName: string): SheetInfo[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`JSON 解析失败: ${(e as Error).message}`);
  }
  if (Array.isArray(parsed)) {
    return [arrayOfObjectsToSheet(parsed, "Sheet1")];
  }
  if (parsed && typeof parsed === "object") {
    // 嵌套：每个顶层 key 是一个 sheet
    const sheets: SheetInfo[] = [];
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        sheets.push(arrayOfObjectsToSheet(value, key));
      } else {
        // 非数组的当 KV 表
        const obj = (value && typeof value === "object" ? value : { value }) as Record<
          string,
          unknown
        >;
        const headers = ["key", "value"];
        const rows = Object.entries(obj).map(([k, v]) => [k, stringifyForTable(v)]);
        sheets.push({
          name: key,
          headers,
          rows,
          rowCount: rows.length,
          colCount: headers.length,
        });
      }
    }
    return sheets.length > 0 ? sheets : [arrayOfObjectsToSheet([parsed], fileName)];
  }
  // 单值 → 一行一列
  return [
    {
      name: fileName,
      headers: ["value"],
      rows: [[stringifyForTable(parsed)]],
      rowCount: 1,
      colCount: 1,
    },
  ];
}

/** 把对象数组展平成 sheet（值统一转字符串避免类型噪声） */
function arrayOfObjectsToSheet(arr: unknown[], sheetName: string): SheetInfo {
  const flat = arr.filter((r) => r && typeof r === "object") as Record<string, unknown>[];
  if (flat.length === 0) {
    return { name: sheetName, headers: [], rows: [], rowCount: 0, colCount: 0 };
  }
  // 收集所有 key（按出现顺序），全表去重
  const seen = new Set<string>();
  const headers: string[] = [];
  for (const r of flat) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) {
        seen.add(k);
        headers.push(k);
      }
    }
  }
  const rows = flat.map((r) => headers.map((h) => stringifyForTable(r[h])));
  return {
    name: sheetName,
    headers,
    rows,
    rowCount: rows.length,
    colCount: headers.length,
  };
}

function stringifyForTable(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (Array.isArray(v)) return JSON.stringify(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** HTML 表格解析：从 <table> 提取 <tr>/<td>，仅支持最常见的扁平表格 */
function parseHtmlTable(text: string, fileName: string): SheetInfo[] {
  const tableMatch = text.match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch) {
    throw new Error("HTML 解析失败：未找到 <table> 标签");
  }
  const table = tableMatch[0];
  const rowMatches = table.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const rows: unknown[][] = rowMatches.map((rowHtml) => {
    const cells = rowHtml.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
    return cells.map((c) => {
      const text = c.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
      return text === "" ? null : text;
    });
  });
  if (rows.length === 0) {
    return [{ name: fileName, headers: [], rows: [], rowCount: 0, colCount: 0 }];
  }
  const headers = (rows[0] as unknown[]).map((h) => (h == null ? "" : String(h)));
  return [
    {
      name: fileName,
      headers,
      rows: rows.slice(1),
      rowCount: rows.length - 1,
      colCount: headers.length,
    },
  ];
}

/** buffer → 字符串（按编码解码） */
function decodeBuffer(buffer: Buffer, encoding: string): string {
  try {
    return iconv.decode(buffer, encoding);
  } catch {
    // 兜底：尝试 utf-8
    return buffer.toString("utf8");
  }
}

/* ─────────────── 多 Sheet 同结构判定 ─────────────── */

/**
 * 判定各 sheet 是否同结构（可合并）
 * 规则：列数相同 + 列名一致率 > 80% + 列顺序一致率 > 70%
 */
export function detectSheetStructure(sheets: SheetInfo[]): {
  sameStructureGroups: SheetInfo[][];
  differentSheets: SheetInfo[];
} {
  if (sheets.length === 0) {
    return { sameStructureGroups: [], differentSheets: [] };
  }

  // 单 sheet 直接走独立，避免"1 个 Sheet 合并"的啰嗦提示
  if (sheets.length === 1) {
    return { sameStructureGroups: [], differentSheets: [sheets[0]] };
  }

  const groups: SheetInfo[][] = [];
  const used = new Set<string>();

  for (let i = 0; i < sheets.length; i++) {
    if (used.has(sheets[i].name)) continue;
    const current = sheets[i];
    const group: SheetInfo[] = [current];
    used.add(current.name);

    for (let j = i + 1; j < sheets.length; j++) {
      if (used.has(sheets[j].name)) continue;
      if (isSameStructure(current, sheets[j])) {
        group.push(sheets[j]);
        used.add(sheets[j].name);
      }
    }
    groups.push(group);
  }

  // 拆分：单元素组 = differentSheets
  const sameStructureGroups: SheetInfo[][] = groups.filter((g) => g.length > 1);
  const differentSheets: SheetInfo[] = groups.filter((g) => g.length === 1).map((g) => g[0]);

  return { sameStructureGroups, differentSheets };
}

/** 两个 sheet 是否同结构 */
function isSameStructure(a: SheetInfo, b: SheetInfo): boolean {
  if (a.headers.length === 0 || b.headers.length === 0) return false;
  if (a.headers.length !== b.headers.length) return false;

  const len = a.headers.length;
  // 列名一致率（用规范化名比较）
  let sameName = 0;
  const bSet = new Set(b.headers.map(normalizeHeader));
  for (const h of a.headers) {
    if (bSet.has(normalizeHeader(h))) sameName++;
  }
  const nameRate = sameName / len;
  if (nameRate < 0.8) return false;

  // 列顺序一致率（按出现次序逐位匹配）
  let sameOrder = 0;
  for (let i = 0; i < len; i++) {
    if (normalizeHeader(a.headers[i]) === normalizeHeader(b.headers[i])) sameOrder++;
  }
  const orderRate = sameOrder / len;
  return orderRate > 0.7;
}

function normalizeHeader(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
