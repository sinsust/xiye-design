/**
 * POST /api/brain/table/upload
 * body: multipart/form-data, field "file"
 *
 * 容量三闸门：
 *  - 文件大小 ≤ 100MB（413）
 *  - 单元格总量 ≤ 200 万（422，含截断逻辑：超出按行截断并提示）
 *  - 字段数 ≤ 200 列（422）
 *
 * 链路：parseFile → cleanSheet → detectSheetStructure（同结构合并加来源Sheet列）→ profileTable
 * 结果缓存到服务端（返回 tableId，30min TTL），响应精简（rows 只含预览前 20 行）。
 * 返回：{ tableId, truncated, parsedInfo, structure, results: [{ sheetName, headers, rows(preview), columnTypes, profile }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { parseFile } from "@/lib/table/parser";
import { cleanSheet } from "@/lib/table/cleaner";
import { profileTable } from "@/lib/table/profiler";
import { detectSheetStructure } from "@/lib/table/parser";
import { cacheTable } from "@/lib/table/session-cache";
import type { FieldType, SheetInfo, TableProfileResult } from "@/lib/table/types";

export const runtime = "nodejs";

/** 文件大小上限（100MB） */
const MAX_FILE_SIZE = 100 * 1024 * 1024;
/** 单元格总量上限（性能阀） */
const MAX_CELLS = 2_000_000;
/** 字段数上限 */
const MAX_COLUMNS = 200;
/** 响应中每表预览行数 */
const PREVIEW_ROWS = 20;

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized", message: "未登录" }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file) {
      return NextResponse.json({ error: "file_required", message: "请选择要上传的文件" }, { status: 400 });
    }

    // 闸门 1：文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "file_too_large", maxMB: 100, message: `文件超过 100MB 上限（当前 ${(file.size / 1024 / 1024).toFixed(1)}MB）` },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name || "未命名表格";

    // ① 解析
    const parsed = await parseFile(buffer, fileName);

    // 闸门 2：字段数（取最大 sheet 的列数）
    const maxCols = Math.max(0, ...parsed.sheets.map((s) => s.headers.length));
    if (maxCols > MAX_COLUMNS) {
      return NextResponse.json(
        { error: "too_many_columns", maxColumns: MAX_COLUMNS, actual: maxCols, message: `字段数（${maxCols} 列）超过 ${MAX_COLUMNS} 列上限，请精简后再上传` },
        { status: 422 },
      );
    }

    // ② 清洗
    const cleaned = parsed.sheets.map((sheet) => {
      const result = cleanSheet(sheet);
      return { sheet, ...result };
    });

    // ③ 同结构判定
    const structure = detectSheetStructure(parsed.sheets);

    // ④ 画像 + 缓存：同结构合并组 / 独立 sheet 分别处理
    const results: Array<{
      sheetName: string;
      headers: string[];
      rows: unknown[][];
      columnTypes: FieldType[];
      profile: TableProfileResult;
      tableId: string;
    }> = [];
    const truncated: string[] = [];

    const analyzeGroup = (
      name: string,
      headers: string[],
      rows: unknown[][],
      columnTypes: FieldType[],
    ) => {
      // 闸门 3：单元格总量 → 超出行数截断
      const cellLimit = Math.max(1, Math.floor(MAX_CELLS / Math.max(headers.length, 1)));
      let finalRows = rows;
      if (rows.length > cellLimit) {
        finalRows = rows.slice(0, cellLimit);
        truncated.push(`${name}（仅分析前 ${cellLimit.toLocaleString()} 行）`);
      }
      const profile = profileTable(headers, finalRows, columnTypes, name);
      // 服务端缓存全量（截断后）数据，供 analyze 使用（绑定归属用户防串读）
      const tableId = cacheTable(user.sub, headers, finalRows, columnTypes);
      results.push({
        sheetName: name,
        headers,
        rows: finalRows.slice(0, PREVIEW_ROWS), // 响应只给预览
        columnTypes,
        profile,
        tableId,
      });
    };

    for (const group of structure.sameStructureGroups) {
      const merged = mergeSheets(group);
      const { cleanedHeaders, cleanedRows, columnTypes } = cleanSheet({
        name: merged.name,
        headers: merged.headers,
        rows: merged.rows,
        rowCount: merged.rows.length,
        colCount: merged.headers.length,
      });
      analyzeGroup(merged.name, cleanedHeaders, cleanedRows, columnTypes);
    }
    for (const sheet of structure.differentSheets) {
      const c = cleaned.find((x) => x.sheet.name === sheet.name);
      if (!c) continue;
      analyzeGroup(sheet.name, c.cleanedHeaders, c.cleanedRows, c.columnTypes);
    }
    if (results.length === 0 && parsed.sheets.length > 0) {
      const sheet = parsed.sheets[0];
      const c = cleaned.find((x) => x.sheet.name === sheet.name);
      if (c) analyzeGroup(sheet.name, c.cleanedHeaders, c.cleanedRows, c.columnTypes);
    }

    return NextResponse.json({
      parsedInfo: parsed,
      structure: {
        sameStructureGroups: structure.sameStructureGroups.map((g) => g.map((s) => s.name)),
        differentSheets: structure.differentSheets.map((s) => s.name),
      },
      results,
      truncated,
    });
  } catch (err) {
    console.error("brain table upload failed:", err);
    return NextResponse.json(
      { error: "upload_failed", message: `文件解析失败：${(err as Error).message}` },
      { status: 500 },
    );
  }
}

/** 合并同结构 sheet：headers 取第一个，行拼接；若原表无"来源Sheet"列则追加 */
function mergeSheets(group: SheetInfo[]): { name: string; headers: string[]; rows: unknown[][] } {
  const first = group[0];
  const headers = [...first.headers];
  const hasSource = headers.some((h) => h.includes("来源") || h.toLowerCase().includes("sheet"));
  if (!hasSource) headers.push("来源Sheet");

  const rows: unknown[][] = [];
  for (const sheet of group) {
    for (const row of sheet.rows) {
      const merged = row.slice();
      while (merged.length < headers.length) merged.push(null);
      if (!hasSource) merged[headers.length - 1] = sheet.name;
      rows.push(merged);
    }
  }
  return {
    name: `${group.length} 个结构相同的 Sheet 合并`,
    headers,
    rows,
  };
}
