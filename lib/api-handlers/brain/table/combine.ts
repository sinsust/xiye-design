/**
 * POST /api/brain/table/combine
 * body JSON:
 * {
 *   tables: string[],                                   // 有序的已缓存 tableId 列表（≥2）
 *   joins: {                                             // 有序连接步骤，joins[i] 把累加表与 rightTableId 组合
 *     leftTableId: string,
 *     rightTableId: string,
 *     keyColumnLeft: string,                            // 累加表中（含此前已组合列）的连接键列名
 *     keyColumnRight: string                            // 右表中连接键列名
 *   }[],
 *   joinType?: "left" | "inner"                         // 默认 left（保留左表全部行）
 * }
 *
 * 流程：
 *  - 取回各 tableId 的 rawSheet（非本人 / 过期 → 422）；
 *  - 以 tables[0] 为起点，按 joins 顺序 keyed join 累加；
 *  - 组合结果喂进与 upload 完全一致的管线（buildEffectiveDataset → profileEffectiveDataset → cacheTable），
 *    返回与 upload-multi 同款 result payload，前端零改动接入确认/画像/分析/导出。
 *
 * 组合算力在 xiye（joinTables 纯函数），飞书只是可选物化层，此处不依赖飞书。
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getRawSheet, cacheTable } from "@/lib/table/session-cache";
import { buildEffectiveDataset } from "@/lib/table/cleaner";
import { profileEffectiveDataset } from "@/lib/table/profiler";
import { joinTables, type JoinType } from "@/lib/table/combine/join-tables";
import type { EffectiveDataset, SheetInfo, TableProfileResult } from "@/lib/table/types";

export const runtime = "nodejs";

/** 单元格总量上限（性能阀） */
const MAX_CELLS = 2_000_000;
/** 字段数上限 */
const MAX_COLUMNS = 200;
/** 响应中预览行数 */
const PREVIEW_ROWS = 20;

interface CombineJoinStep {
  leftTableId: string;
  rightTableId: string;
  keyColumnLeft: string;
  keyColumnRight: string;
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized", message: "未登录" }, { status: 401 });

  let body: { tables?: unknown; joins?: unknown; joinType?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "请求体不是合法 JSON" }, { status: 400 });
  }

  const tables = body.tables;
  const joins = body.joins;
  if (!Array.isArray(tables) || tables.length < 2 || !tables.every((t) => typeof t === "string")) {
    return NextResponse.json({ error: "invalid_tables", message: "tables 需为至少 2 个 tableId 的数组" }, { status: 400 });
  }
  if (!Array.isArray(joins) || joins.length < 1) {
    return NextResponse.json({ error: "invalid_joins", message: "joins 需至少包含 1 个连接步骤" }, { status: 400 });
  }
  const jt: JoinType = body.joinType === "inner" ? "inner" : "left";

  // 取回 rawSheet
  const rawMap = new Map<string, SheetInfo>();
  for (const id of tables as string[]) {
    const raw = await getRawSheet(id, user.sub);
    if (!raw) {
      return NextResponse.json(
        { error: "table_expired", message: `表 ${id} 不存在或已过期（30 分钟 TTL），请重新上传` },
        { status: 422 },
      );
    }
    rawMap.set(id, raw);
  }

  // 按 joins 顺序累加 keyed join
  let acc: SheetInfo = rawMap.get(tables[0] as string)!;
  const warnings: string[] = [];
  let stepIndex = 0;
  for (const rawStep of joins as CombineJoinStep[]) {
    stepIndex++;
    const right = rawMap.get(rawStep.rightTableId);
    if (!right) {
      return NextResponse.json(
        { error: "unknown_join_table", message: `第 ${stepIndex} 步引用了未知表 ${rawStep.rightTableId}` },
        { status: 422 },
      );
    }
    let res;
    try {
      res = joinTables(acc, right, rawStep.keyColumnLeft, rawStep.keyColumnRight, { joinType: jt });
    } catch (e) {
      return NextResponse.json(
        { error: "join_failed", message: `第 ${stepIndex} 步组合失败：${(e as Error).message}` },
        { status: 422 },
      );
    }
    warnings.push(...res.warnings);
    acc = res.sheet;
  }

  // 闸门：组合后字段数
  if (acc.headers.length > MAX_COLUMNS) {
    return NextResponse.json(
      { error: "too_many_columns", maxColumns: MAX_COLUMNS, actual: acc.headers.length, message: `组合后字段数（${acc.headers.length} 列）超过 ${MAX_COLUMNS} 列上限` },
      { status: 422 },
    );
  }

  // 走与 upload 一致的管线（headers 已分离、rows 纯数据，headerIdx:0 不丢行）
  const ds: EffectiveDataset = buildEffectiveDataset(acc, { headerIdx: 0 });
  const cellLimit = Math.max(1, Math.floor(MAX_CELLS / Math.max(ds.effectiveColumnCount, 1)));
  let finalRows = ds.rows;
  if (ds.effectiveRowCount > cellLimit) {
    finalRows = ds.rows.slice(0, cellLimit);
    warnings.push(`组合结果较大，仅分析前 ${cellLimit.toLocaleString()} 行`);
  }
  const profile: TableProfileResult = profileEffectiveDataset({
    ...ds,
    rows: finalRows,
    effectiveRowCount: finalRows.length,
  });
  const tableId = await cacheTable(user.sub, ds.headers, finalRows, ds.columns, acc);

  const result = {
    sheetName: acc.name,
    headers: ds.headers,
    rows: finalRows.slice(0, PREVIEW_ROWS),
    columnTypes: ds.columns,
    profile,
    tableId,
    detectedHeaderRow: ds.detectedHeaderRow,
    effectiveRowCount: finalRows.length,
    effectiveColumnCount: ds.effectiveColumnCount,
    excludedRows: ds.excludedRows ?? [],
    excludedColumns: ds.excludedColumns ?? [],
    qualityIssues: ds.qualityIssues ?? [],
    recommendation: undefined,
    headerCandidates: [],
    combined: true,
    joinWarnings: warnings,
  };

  return NextResponse.json({ result, warnings });
}
