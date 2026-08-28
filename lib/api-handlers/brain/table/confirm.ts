/**
 * POST /api/brain/table/confirm
 * body: { tableId, headerRow }
 *
 * T1-D2 表头确认：用户在前端确认某一行为表头后，服务端据此重新构建
 * EffectiveDataset + 重新画像 + 重新推荐，并就地更新该 tableId 的会话缓存
 * （不换新 tableId，避免前端已持有的引用失效），同时写入用户会话级确认状态。
 *
 * 设计铁律：
 *  - 必须重新生成该 Sheet 的 EffectiveDataset / 字段画像，不得沿用错误表头的缓存；
 *  - 仅 session 生命周期：确认状态不落库、不持久化为用户长期数据；
 *  - userId 隔离：非本人 / 过期 / 不存在 → 410，由前端引导重新上传或返回 Sheet 选择；
 *  - 不改动 cleaner / profiler / recommender 的规则与阈值。
 *
 * 返回与 upload 同形的单 Sheet payload（含 recommendation / headerCandidates / confirmedHeaderRow）。
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { buildEffectiveDataset } from "@/lib/table/cleaner";
import { profileEffectiveDataset } from "@/lib/table/profiler";
import {
  getRawSheet,
  updateTableCache,
  saveTableConfirmation,
  getTableConfirmation,
} from "@/lib/table/session-cache";
import {
  recommendSheet,
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
  TableProfileResult,
} from "@/lib/table/types";

export const runtime = "nodejs";

/** 响应中每表预览行数（与 upload 一致） */
const PREVIEW_ROWS = 20;
/** 单元格总量上限（与 upload 一致，用于截断判定） */
const MAX_CELLS = 2_000_000;

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized", message: "未登录" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const tableId: string = typeof body?.tableId === "string" ? body.tableId : "";
    const headerRow: number = typeof body?.headerRow === "number" ? body.headerRow : -1;

    if (!tableId) {
      return NextResponse.json({ error: "table_id_required", message: "缺少表格标识" }, { status: 400 });
    }
    if (!(headerRow >= 0)) {
      return NextResponse.json({ error: "header_row_required", message: "请指定表头所在行" }, { status: 400 });
    }

    // 取原始 Sheet（含全部行，未裁剪）；过期 / 非本人 / 不存在 → 410
    const raw = getRawSheet(tableId, user.sub);
    if (!raw) {
      return NextResponse.json(
        { error: "table_expired", message: "表格数据已失效（页面停留过久或服务重启导致），请重新上传后再分析" },
        { status: 410 },
      );
    }

    // 按用户确认的表头行重新构建有效数据集（绝不沿用错误表头缓存）
    const ds: EffectiveDataset = buildEffectiveDataset(raw, { headerIdx: headerRow });

    // 闸门：单元格总量 → 超出行数截断（与 upload 一致）
    const cellLimit = Math.max(1, Math.floor(MAX_CELLS / Math.max(ds.effectiveColumnCount, 1)));
    const finalRows = ds.effectiveRowCount > cellLimit ? ds.rows.slice(0, cellLimit) : ds.rows;

    const profile: TableProfileResult = profileEffectiveDataset({
      ...ds,
      rows: finalRows,
      effectiveRowCount: finalRows.length,
    });

    // 就地更新该 tableId 的缓存（复用同一 id，前端引用不失效）
    const updated = updateTableCache(tableId, user.sub, {
      headers: ds.headers,
      rows: finalRows,
      columnTypes: ds.columns,
    });
    if (!updated) {
      return NextResponse.json(
        { error: "table_expired", message: "表格数据已失效，请重新上传后再分析" },
        { status: 410 },
      );
    }

    // 写入会话级确认状态（仅 session 生命周期，不落库）
    saveTableConfirmation(tableId, user.sub, {
      selectedSheetIds: [ds.sheetId],
      headerRowBySheet: { [ds.sheetId]: headerRow },
      confirmedAt: Date.now(),
      version: 1,
    });

    // 重新推荐 + 重新预计算表头候选
    const rec = recommendSheet(buildSheetRecommendationInput(raw, ds, profile));
    const cand: HeaderCandidate[] = listHeaderCandidates(raw);
    // 用户已显式确认表头 → 视为已确认（即便表头非首行，不再强制二次确认）
    const recommendation = { ...rec, requiresHeaderConfirmation: false };
    const confirmation = getTableConfirmation(tableId, user.sub);

    return NextResponse.json({
      tableId,
      sheetName: ds.sheetName,
      headers: ds.headers,
      rows: finalRows.slice(0, PREVIEW_ROWS),
      columnTypes: ds.columns,
      profile,
      detectedHeaderRow: ds.detectedHeaderRow,
      effectiveRowCount: finalRows.length,
      effectiveColumnCount: ds.effectiveColumnCount,
      excludedRows: (ds.excludedRows ?? []) as ExcludedRow[],
      excludedColumns: (ds.excludedColumns ?? []) as ExcludedColumn[],
      qualityIssues: (ds.qualityIssues ?? []) as QualityIssue[],
      recommendation,
      headerCandidates: cand,
      confirmedHeaderRow: headerRow,
      confirmation,
    });
  } catch (err) {
    console.error("brain table confirm failed:", err);
    return NextResponse.json(
      { error: "confirm_failed", message: `表头确认失败：${(err as Error).message}` },
      { status: 500 },
    );
  }
}
