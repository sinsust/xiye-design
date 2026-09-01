/**
 * POST /api/brain/table/upload
 * body: multipart/form-data, field "file"
 *
 * 容量三闸门：
 *  - 文件大小 ≤ 100MB（413）
 *  - 单元格总量 ≤ 200 万（422，含截断逻辑：超出按行截断并提示）
 *  - 字段数 ≤ 200 列（422）
 *
 * 链路：parseFile → detectSheetStructure（同结构合并加来源Sheet列）→ buildEffectiveDataset（清洗 + 幽灵列/空行裁剪 + 质量信号）→ profileEffectiveDataset
 * 注意：产品链路与确定性验证链（scripts/validation-table-baseline.mts）共用 buildEffectiveDataset，
 *       确保「被验证的链路 = 产品跑的链路」（C1 修复：此前裁剪只存在于验证脚本，产品上传链路不生效）。
 * 结果缓存到服务端（返回 tableId，30min TTL），响应精简（rows 只含预览前 20 行）。
 * 返回：{ tableId, truncated, parsedInfo, structure, results: [{ sheetName, headers, rows(preview), columnTypes, profile }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { parseFile, detectSheetStructure } from "@/lib/table/parser";
import { buildEffectiveDataset } from "@/lib/table/cleaner";
import { profileEffectiveDataset } from "@/lib/table/profiler";
import { cacheTable } from "@/lib/table/session-cache";
import {
  recommendSheets,
  buildSheetRecommendationInput,
  listHeaderCandidates,
} from "@/lib/table/sheet-recommender";
import type {
  EffectiveDataset,
  ExcludedColumn,
  ExcludedRow,
  FieldType,
  HeaderCandidate,
  QualityIssue,
  SheetInfo,
  SheetRecommendation,
  TableProfileResult,
} from "@/lib/table/types";

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

    // ② 同结构判定（基于原始 sheet 列结构，仅用于分组；不在此裁剪）
    const structure = detectSheetStructure(parsed.sheets);

    // ③ 有效数据集边界（T1-A/T1-C）：清洗 + 幽灵列/空行裁剪 + 质量信号
    //    产品链路与确定性验证链共用 buildEffectiveDataset，确保「被验证的链路 = 产品跑的链路」（C1 修复）。
    const buildEffective = (sheet: SheetInfo): EffectiveDataset => buildEffectiveDataset(sheet);

    // ④ 画像 + 缓存：同结构合并组 / 独立 sheet 分别处理
    type PerResult = {
      name: string;
      ds: EffectiveDataset;
      rawSheet: SheetInfo;
      profile: TableProfileResult;
      tableId: string;
      finalRows: unknown[][];
    };
    const perResult: PerResult[] = [];
    const truncated: string[] = [];

    const analyzeDataset = async (name: string, ds: EffectiveDataset, rawSheet: SheetInfo) => {
      // 闸门 3：单元格总量 → 超出行数截断（仅影响画像/缓存规模，不丢业务行语义）
      const cellLimit = Math.max(1, Math.floor(MAX_CELLS / Math.max(ds.effectiveColumnCount, 1)));
      let finalRows = ds.rows;
      if (ds.effectiveRowCount > cellLimit) {
        finalRows = ds.rows.slice(0, cellLimit);
        truncated.push(`${name}（仅分析前 ${cellLimit.toLocaleString()} 行）`);
      }
      // 画像走 EffectiveDataset 边界（与验证链一致）
      const profile = profileEffectiveDataset({
        ...ds,
        rows: finalRows,
        effectiveRowCount: finalRows.length,
      });
      // 服务端缓存有效（裁剪后）数据，供 analyze 使用（绑定归属用户防串读）；
      // 同时缓存 rawSheet，供用户确认表头后重新构建 EffectiveDataset（T1-D2）。
      const tableId = await cacheTable(user.sub, ds.headers, finalRows, ds.columns, rawSheet);
      perResult.push({ name, ds, rawSheet, profile, tableId, finalRows });
    };

    for (const group of structure.sameStructureGroups) {
      const merged = mergeSheets(group);
      await analyzeDataset(merged.name, buildEffectiveDataset(merged, { headerIdx: 0 }), merged);
    }
    for (const sheet of structure.differentSheets) {
      const raw = parsed.sheets.find((s) => s.name === sheet.name);
      if (!raw) continue;
      await analyzeDataset(sheet.name, buildEffective(raw), raw);
    }
    if (perResult.length === 0 && parsed.sheets.length > 0) {
      await analyzeDataset(parsed.sheets[0].name, buildEffective(parsed.sheets[0]), parsed.sheets[0]);
    }

    // ⑤ T1-D1： Sheet 推荐（稳定排序、绝不合并）+ 表头候选预览（供 T1-D2 确认面板切换）
    const recs: SheetRecommendation[] =
      perResult.length > 0
        ? recommendSheets(
            perResult.map((p) => buildSheetRecommendationInput(p.rawSheet, p.ds, p.profile)),
          )
        : [];
    const cands: HeaderCandidate[][] = perResult.map((p) => listHeaderCandidates(p.rawSheet));

    const toResultPayload = (
      p: PerResult,
      rec: SheetRecommendation | undefined,
      cand: HeaderCandidate[],
    ) => ({
      sheetName: p.name,
      headers: p.ds.headers,
      rows: p.finalRows.slice(0, PREVIEW_ROWS), // 响应只给预览
      columnTypes: p.ds.columns,
      profile: p.profile,
      tableId: p.tableId,
      detectedHeaderRow: p.ds.detectedHeaderRow,
      effectiveRowCount: p.finalRows.length,
      effectiveColumnCount: p.ds.effectiveColumnCount,
      excludedRows: p.ds.excludedRows ?? [],
      excludedColumns: p.ds.excludedColumns ?? [],
      qualityIssues: p.ds.qualityIssues ?? [],
      recommendation: rec,
      headerCandidates: cand,
    });

    const results = perResult.map((p, i) => toResultPayload(p, recs[i], cands[i]));

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
