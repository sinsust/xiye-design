/**
 * POST /api/brain/table/confirm-columns
 * body: { tableId, columnOverrides?, confirmedColumns? }
 *
 * T1-D3 字段确认：用户在进入分析前，对系统识别的字段做最小化确认——
 * 仅允许修改「展示名 / 数据类型 / 是否纳入分析候选列」。服务端据此基于现有
 * 有效数据集重画像，并就地更新该 tableId 的会话缓存（不换新 tableId），
 * 同时写入用户会话级确认状态（含 columnOverrides / confirmedColumns）。
 *
 * 设计铁律：
 *  - 不编辑单元格、不删除真实记录、不去重、不修改原值、不创建计算列；
 *    rawSheet 始终保持非破坏性；
 *  - 覆盖后重画像调用既有 profileTable（不改动 profiler 算法）；
 *  - 仅 session 生命周期：确认状态不落库、不持久化为用户长期数据；
 *  - userId 隔离 + TTL：非本人 / 过期 / 不存在 → session_expired，由前端引导重新上传；
 *  - 覆盖项校验：列下标越界 → invalid_column；类型枚举 / 展示名约束不符 → invalid_override；
 *  - 不改动 analyze / LLM / 图表逻辑——updateTableCache 直接更新缓存的有效集，
 *    下游 analyze 路由读取缓存 columnTypes/headers 即自动采用覆盖结果。
 *
 * 错误码：session_expired(410) / unauthorized(401) / invalid_column(400) /
 *        invalid_override(400) / reprofile_failed(500)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  getTableCache,
  updateTableCache,
  saveTableConfirmation,
  getTableConfirmation,
  clearTablePlan,
} from "@/lib/table/session-cache";
import {
  applyColumnOverrides,
  validateColumnOverrides,
} from "@/lib/table/column-confirmation";
import type { ColumnOverride, FieldType, TableConfirmation, TableProfileResult } from "@/lib/table/types";

export const runtime = "nodejs";

/** 响应中预览行数（与 upload / confirm 一致） */
const PREVIEW_ROWS = 20;

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized", message: "未登录" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const tableId: string = typeof body?.tableId === "string" ? body.tableId : "";
    const columnOverrides: Record<number, ColumnOverride> | undefined = body?.columnOverrides;
    const confirmedColumns: number[] | undefined = body?.confirmedColumns;

    if (!tableId) {
      return NextResponse.json({ error: "table_id_required", message: "缺少表格标识" }, { status: 400 });
    }

    // 取当前缓存的有效数据集（确认表头后已就位）；过期 / 非本人 / 不存在 → session_expired
    const cached = await getTableCache(tableId, user.sub);
    if (!cached) {
      return NextResponse.json(
        { error: "session_expired", message: "表格数据已失效（页面停留过久或服务重启导致），请重新上传后再分析" },
        { status: 410 },
      );
    }

    const { headers, rows, columnTypes } = cached;

    // 校验覆盖项（列下标越界 / 类型枚举 / 展示名约束）
    const validation = validateColumnOverrides({
      columnCount: headers.length,
      columnOverrides,
      confirmedColumns,
    });
    if (!validation.ok) {
      return NextResponse.json(
        {
          error: validation.errorCode,
          message: validation.messages[0] ?? "字段覆盖项不合法",
          invalidColumnIds: validation.invalidColumnIds,
        },
        { status: 400 },
      );
    }

    // 基于现有有效数据集应用覆盖并重画像（不改动 profiler 算法）
    let applied;
    try {
      applied = applyColumnOverrides({
        headers,
        rows,
        columnTypes: columnTypes as FieldType[],
        sheetName: undefined,
        columnOverrides,
        confirmedColumns,
      });
    } catch (err) {
      console.error("brain table confirm-columns reprofile failed:", err);
      return NextResponse.json(
        { error: "reprofile_failed", message: `字段重画像失败：${(err as Error).message}` },
        { status: 500 },
      );
    }

    // 就地更新该 tableId 的缓存（复用同一 id，rawSheet 保留、前端引用不失效）
    const updated = await updateTableCache(tableId, user.sub, {
      headers: applied.headers,
      rows: applied.rows,
      columnTypes: applied.columnTypes,
    });
    if (!updated) {
      return NextResponse.json(
        { error: "session_expired", message: "表格数据已失效，请重新上传后再分析" },
        { status: 410 },
      );
    }

    // 合并写入会话级确认状态（保留既有 selectedSheetIds / headerRowBySheet，仅增补字段覆盖）
    const prev: TableConfirmation | null = await getTableConfirmation(tableId, user.sub);
    const now = Date.now();
    const confirmation: TableConfirmation = {
      selectedSheetIds: prev?.selectedSheetIds ?? [],
      headerRowBySheet: prev?.headerRowBySheet ?? {},
      confirmedAt: now,
      version: (prev?.version ?? 0) + 1,
      columnOverrides,
      confirmedColumns,
    };
    await saveTableConfirmation(tableId, user.sub, confirmation);
    // 字段 / 类型确认版本已更新 → 旧分析计划失效（T2-A）
    await clearTablePlan(tableId, user.sub);

    const profile: TableProfileResult = applied.profile;

    return NextResponse.json({
      tableId,
      sheetName: profile.sheetName,
      headers: applied.headers,
      rows: applied.rows.slice(0, PREVIEW_ROWS),
      columnTypes: applied.columnTypes,
      profile,
      confirmation,
    });
  } catch (err) {
    console.error("brain table confirm-columns failed:", err);
    return NextResponse.json(
      { error: "reprofile_failed", message: `字段确认失败：${(err as Error).message}` },
      { status: 500 },
    );
  }
}
