/**
 * POST /api/brain/table/export
 * body: { tableId }
 *
 * 用 exceljs 生成带样式的 xlsx：表头加粗 + 品牌色填充、冻结首行、列宽自适应、
 * 数字列右对齐。数据来自服务端会话缓存（同 analyze 的 tableId 机制），
 * 避免浏览器回传大 rows。
 */

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSessionUser } from "@/lib/auth";
import { getTableCache } from "@/lib/table/session-cache";
import type { FieldType } from "@/lib/table/types";

export const runtime = "nodejs";

const MAX_ROWS_EXPORT = 20000;
const NUMERIC_TYPES: FieldType[] = ["integer", "float", "percentage", "currency"];

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized", message: "未登录" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const tableId: string = typeof body?.tableId === "string" ? body.tableId : "";
    if (!tableId) {
      return NextResponse.json({ error: "bad_request", message: "缺少 tableId" }, { status: 400 });
    }

    const cache = await getTableCache(tableId, user.sub);
    if (!cache) {
      return NextResponse.json(
        { error: "table_expired", message: "表格数据已失效，请重新上传后再导出" },
        { status: 410 },
      );
    }

    const { headers, rows, columnTypes } = cache;
    const exportRows = rows.slice(0, MAX_ROWS_EXPORT);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");

    // 表头行：加粗白字 + 品牌色填充
    ws.addRow(headers.map((h) => h || ""));
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F6FEB" } };
    headerRow.alignment = { vertical: "middle" };
    headerRow.height = 22;

    // 数据行（null → 空串，保持原始类型）
    for (const r of exportRows) {
      ws.addRow(r.map((v) => (v == null ? "" : v)));
    }

    // 冻结首行
    ws.views = [{ state: "frozen", ySplit: 1 }];

    // 列宽自适应（表头/内容最大长度，clamp 8-40）+ 数字列右对齐
    headers.forEach((_, i) => {
      let maxLen = String(headers[i] || "").length;
      for (const r of exportRows.slice(0, 200)) {
        const v = r[i];
        const s = v == null ? "" : typeof v === "number" ? v.toFixed(0) : String(v);
        maxLen = Math.max(maxLen, s.length);
      }
      ws.getColumn(i + 1).width = Math.min(40, Math.max(8, maxLen + 2));
      if (NUMERIC_TYPES.includes(columnTypes?.[i] as FieldType)) {
        ws.getColumn(i + 1).alignment = { horizontal: "right" };
      }
    });

    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    const fileName = `${sanitize(headers[0] || "表格")}.xlsx`;

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "export_failed", message: `导出失败：${(e as Error).message}` },
      { status: 500 },
    );
  }
}

/** 文件名净化：去掉非法字符、限长 */
function sanitize(s: string): string {
  return (s || "表格").replace(/[\\/:*?"<>|]/g, "_").slice(0, 30);
}
