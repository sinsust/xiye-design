/**
 * POST /api/brain/table/upload-multi
 * body: multipart/form-data, field "files" (可多个)
 *
 * 与 table/upload 复用同一套解析/清洗/画像/缓存链路，差异仅在于：
 *  - 一次性收多个文件（每张表独立缓存，返回各自的 tableId）；
 *  - 全部解析完成后，跨表构造 JoinInput，调用 detectJoinKeys 产出组合建议
 *    joinSuggestions（仅建议、不自动组合，与「产品推荐不自动合并」铁律一致）。
 *
 * 返回：{ results: [{ 单表结果 }], joinSuggestions: JoinSuggestion[], truncated }
 * 单表结果 payload 与 table/upload 完全一致，前端可统一渲染。
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { parseFile, detectSheetStructure } from "@/lib/table/parser";
import { buildEffectiveDataset } from "@/lib/table/cleaner";
import { profileEffectiveDataset } from "@/lib/table/profiler";
import { cacheTable } from "@/lib/table/session-cache";
import { buildJoinInputFromSheet, detectJoinKeys } from "@/lib/table/combine/detect-join-keys";
import type {
  EffectiveDataset,
  HeaderCandidate,
  QualityIssue,
  SheetInfo,
  SheetRecommendation,
  TableProfileResult,
} from "@/lib/table/types";
import {
  recommendSheets,
  buildSheetRecommendationInput,
  listHeaderCandidates,
} from "@/lib/table/sheet-recommender";
import { safeDetail } from "@/lib/api-error";

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
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: "file_required", message: "请选择至少一个要上传的文件" }, { status: 400 });
    }

    // 闸门 0：空文件。0 字节文件此前会走到 parseFile 抛错、被 catch 兜成 500，属客户端可预检问题。
    // 文件名源自上传，回显前脱敏（防控制字符污染响应体）。
    for (const file of files) {
      if (file.size === 0) {
        return NextResponse.json(
          { error: "empty_file", message: `文件「${safeDetail(file.name, "未命名文件")}」内容为空，请重新选择` },
          { status: 400 },
        );
      }
    }

    // 闸门 1：逐个文件大小
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "file_too_large", maxMB: 100, message: `文件「${safeDetail(file.name, "未命名文件")}」超过 100MB 上限（${(file.size / 1024 / 1024).toFixed(1)}MB）` },
          { status: 413 },
        );
      }
    }

    const perResult: Array<{
      name: string;
      ds: EffectiveDataset;
      rawSheet: SheetInfo;
      profile: TableProfileResult;
      tableId: string;
      finalRows: unknown[][];
    }> = [];
    const truncated: string[] = [];

    const analyzeSheet = async (name: string, ds: EffectiveDataset, rawSheet: SheetInfo) => {
      const cellLimit = Math.max(1, Math.floor(MAX_CELLS / Math.max(ds.effectiveColumnCount, 1)));
      let finalRows = ds.rows;
      if (ds.effectiveRowCount > cellLimit) {
        finalRows = ds.rows.slice(0, cellLimit);
        truncated.push(`${name}（仅分析前 ${cellLimit.toLocaleString()} 行）`);
      }
      const profile = profileEffectiveDataset({
        ...ds,
        rows: finalRows,
        effectiveRowCount: finalRows.length,
      });
      const tableId = await cacheTable(user.sub, ds.headers, finalRows, ds.columns, rawSheet);
      perResult.push({ name, ds, rawSheet, profile, tableId, finalRows });
    };

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = file.name || "未命名表格";
      const parsed = await parseFile(buffer, fileName);

      // 闸门 2：字段数（取最大 sheet 的列数）
      const maxCols = Math.max(0, ...parsed.sheets.map((s) => s.headers.length));
      if (maxCols > MAX_COLUMNS) {
        return NextResponse.json(
          { error: "too_many_columns", maxColumns: MAX_COLUMNS, actual: maxCols, message: `文件「${fileName}」字段数（${maxCols} 列）超过 ${MAX_COLUMNS} 列上限，请精简后再上传` },
          { status: 422 },
        );
      }

      const structure = detectSheetStructure(parsed.sheets);

      // 同结构 sheet 组：合并后作为一张表
      for (const group of structure.sameStructureGroups) {
        const merged = mergeSheets(group);
        await analyzeSheet(merged.name, buildEffectiveDataset(merged, { headerIdx: 0 }), merged);
      }
      // 其余独立 sheet：各作为一张表
      for (const sheet of structure.differentSheets) {
        const raw = parsed.sheets.find((s) => s.name === sheet.name);
        if (!raw) continue;
        await analyzeSheet(sheet.name, buildEffectiveDataset(raw), raw);
      }
      // 兜底：解析出表但结构判定为空
      if (perResult.length === 0 && parsed.sheets.length > 0) {
        await analyzeSheet(parsed.sheets[0].name, buildEffectiveDataset(parsed.sheets[0]), parsed.sheets[0]);
      }
    }

    if (perResult.length === 0) {
      return NextResponse.json({ error: "no_sheet", message: "未能从文件中解析出任何表格" }, { status: 422 });
    }

    // 跨表组合建议检测
    const joinInputs = perResult.map((p) =>
      buildJoinInputFromSheet(p.rawSheet, p.tableId, p.ds.columns as never),
    );
    const joinSuggestions = joinInputs.length >= 2 ? detectJoinKeys(joinInputs) : [];

    // Sheet 推荐 + 表头候选（与 upload 一致）
    const recs: SheetRecommendation[] = recommendSheets(
      perResult.map((p) => buildSheetRecommendationInput(p.rawSheet, p.ds, p.profile)),
    );
    const cands: HeaderCandidate[][] = perResult.map((p) => listHeaderCandidates(p.rawSheet));

    const toResultPayload = (
      p: (typeof perResult)[number],
      rec: SheetRecommendation | undefined,
      cand: HeaderCandidate[],
    ) => ({
      sheetName: p.name,
      headers: p.ds.headers,
      rows: p.finalRows.slice(0, PREVIEW_ROWS),
      columnTypes: p.ds.columns,
      profile: p.profile,
      tableId: p.tableId,
      detectedHeaderRow: p.ds.detectedHeaderRow,
      effectiveRowCount: p.finalRows.length,
      effectiveColumnCount: p.ds.effectiveColumnCount,
      excludedRows: p.ds.excludedRows ?? [],
      excludedColumns: p.ds.excludedColumns ?? [],
      qualityIssues: (p.ds.qualityIssues ?? []) as QualityIssue[],
      recommendation: rec,
      headerCandidates: cand,
    });

    const results = perResult.map((p, i) => toResultPayload(p, recs[i], cands[i]));

    return NextResponse.json({ results, joinSuggestions, truncated });
  } catch (err) {
    console.error("brain table upload-multi failed:", err);
    return NextResponse.json(
      { error: "upload_failed", message: `文件解析失败：${safeDetail(err)}` },
      { status: 500 },
    );
  }
}

/** 合并同结构 sheet：headers 取第一个，行拼接；若原表无"来源Sheet"列则追加 */
function mergeSheets(group: SheetInfo[]): SheetInfo {
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
    rowCount: rows.length,
    colCount: headers.length,
  };
}
