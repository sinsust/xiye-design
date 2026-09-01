/**
 * POST /api/feishu/import
 * body: { appToken: string, tableId: string, tableName?: string }
 *
 * 飞书多维表「读打通」核心：
 *  取用户加密凭证 → 过期则刷新 → 拉字段元数据 + 全量记录 →
 *  构造 SheetInfo → 复用上传链路 buildEffectiveDataset → profileEffectiveDataset →
 *  cacheTable → 产出与 /api/brain/table/upload 完全一致的 results payload，
 *  前端「数据引擎」确认流（confirm-columns 等）零改动。
 *
 * 容量闸门、预览行数、推荐/表头候选逻辑与上传链路保持一致。
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { feishuToSheetInfo } from "@/lib/feishu/to-sheet-info";
import { listFields, listRecords, refreshUserAccessToken, FeishuApiError } from "@/lib/feishu/client";
import { getFeishuConfig, upsertFeishuConfig } from "@/lib/feishu/feishu-config";
import { buildEffectiveDataset } from "@/lib/table/cleaner";
import { profileEffectiveDataset } from "@/lib/table/profiler";
import { cacheTable } from "@/lib/table/session-cache";
import { recommendSheets, buildSheetRecommendationInput, listHeaderCandidates } from "@/lib/table/sheet-recommender";
import type {
  EffectiveDataset,
  HeaderCandidate,
  SheetInfo,
  SheetRecommendation,
  TableProfileResult,
} from "@/lib/table/types";

export const runtime = "nodejs";

/** 单元格总量上限（与上传链路一致） */
const MAX_CELLS = 2_000_000;
/** 响应中预览行数 */
const PREVIEW_ROWS = 20;

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "未登录" }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      appToken?: string;
      tableId?: string;
      tableName?: string;
    };
    const appToken = body.appToken;
    const tableId = body.tableId;
    const tableName = body.tableName || "飞书多维表";
    if (!appToken || !tableId) {
      return NextResponse.json(
        { error: "params_required", message: "请提供 appToken 与 tableId" },
        { status: 400 },
      );
    }

    const cfg = await getFeishuConfig(user.sub);
    if (!cfg) {
      return NextResponse.json(
        { error: "feishu_not_connected", message: "尚未绑定飞书，请先授权" },
        { status: 400 },
      );
    }

    // token 过期则刷新（refresh_token 轮换后回写）
    let accessToken = cfg.accessToken;
    if (cfg.expiresAt > 0 && cfg.expiresAt < Date.now() && cfg.refreshToken) {
      try {
        const refreshed = await refreshUserAccessToken(cfg.refreshToken);
        accessToken = refreshed.accessToken;
        const expiresAt =
          refreshed.expiresIn > 0 ? Date.now() + refreshed.expiresIn * 1000 : cfg.expiresAt;
        await upsertFeishuConfig(
          user.sub,
          refreshed.accessToken,
          refreshed.refreshToken ?? cfg.refreshToken,
          expiresAt,
          refreshed.scope ?? cfg.scope,
        );
      } catch (e) {
        console.error("[feishu] refresh failed:", e);
        return NextResponse.json(
          { error: "feishu_token_refresh_failed", message: "飞书授权已过期，请重新授权" },
          { status: 401 },
        );
      }
    }

    const fields = await listFields(appToken, tableId, accessToken);
    const records = await listRecords(appToken, tableId, accessToken);

    const { sheet } = feishuToSheetInfo({ tableName, fields, records });

    // 飞书 headers 已分离、rows 为纯数据，明确 headerIdx:0（与上传链路 merged-sheet 语义一致，确定不丢行）
    const ds: EffectiveDataset = buildEffectiveDataset(sheet, { headerIdx: 0 });

    // 闸门：单元格总量 → 超出行数截断（仅影响画像/缓存规模）
    const cellLimit = Math.max(1, Math.floor(MAX_CELLS / Math.max(ds.effectiveColumnCount, 1)));
    let finalRows = ds.rows;
    const truncated: string[] = [];
    if (ds.effectiveRowCount > cellLimit) {
      finalRows = ds.rows.slice(0, cellLimit);
      truncated.push(`${tableName}（仅分析前 ${cellLimit.toLocaleString()} 行）`);
    }

    const profile: TableProfileResult = profileEffectiveDataset({
      ...ds,
      rows: finalRows,
      effectiveRowCount: finalRows.length,
    });

    // 服务端缓存有效数据，供后续 confirm-columns / analyze 使用（绑定归属用户防串读）
    const tableIdCache = await cacheTable(user.sub, ds.headers, finalRows, ds.columns, sheet as SheetInfo);

    const recs: SheetRecommendation[] = recommendSheets([
      buildSheetRecommendationInput(sheet as SheetInfo, ds, profile),
    ]);
    const cands: HeaderCandidate[][] = [listHeaderCandidates(sheet as SheetInfo)];

    const result = {
      sheetName: tableName,
      headers: ds.headers,
      rows: finalRows.slice(0, PREVIEW_ROWS),
      columnTypes: ds.columns,
      profile,
      tableId: tableIdCache,
      detectedHeaderRow: ds.detectedHeaderRow,
      effectiveRowCount: finalRows.length,
      effectiveColumnCount: ds.effectiveColumnCount,
      excludedRows: ds.excludedRows ?? [],
      excludedColumns: ds.excludedColumns ?? [],
      qualityIssues: ds.qualityIssues ?? [],
      recommendation: recs[0],
      headerCandidates: cands[0],
    };

    return NextResponse.json({ results: [result], truncated });
  } catch (err) {
    console.error("[feishu] import failed:", err);
    const message =
      err instanceof FeishuApiError ? `飞书接口错误 code=${err.code}` : (err as Error).message;
    return NextResponse.json({ error: "feishu_import_failed", message }, { status: 500 });
  }
}
