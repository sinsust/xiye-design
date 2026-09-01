/**
 * 飞书多维表格 —— 记录集转换为 xiye SheetInfo
 *
 * 输入飞书 fields 元数据 + records 记录集，输出与上传链路完全一致的 SheetInfo
 * （lib/table/types.ts），下游可复用 buildEffectiveDataset → profileEffectiveDataset → cacheTable
 * 全链路，前端 confirm-columns 流程零改动。
 *
 * 纯函数、零 env 依赖，可独立 mock 单测。
 */

import type { FieldType, SheetInfo } from "@/lib/table/types";
import { mapFeishuFieldType, normalizeFeishuCell } from "./field-mapping";
import type { FeishuFieldMeta, FeishuRecord } from "./types";

export interface FeishuToSheetInfoInput {
  /** 数据表名称（用作 SheetInfo.name 兜底） */
  tableName: string;
  /** 字段元数据（list_fields 返回） */
  fields: FeishuFieldMeta[];
  /** 记录集（list_records 返回，已分页拉全） */
  records: FeishuRecord[];
}

export interface FeishuToSheetInfoResult {
  /** 与上传链路一致的 SheetInfo（name/headers/rows/rowCount/colCount） */
  sheet: SheetInfo;
  /** 与 headers 对齐的列类型（供 cacheTable 的 columnTypes 入参） */
  columns: FieldType[];
}

/**
 * 飞书 fields + records → SheetInfo + columns。
 *
 * headers 取 field_name（缺失时兜底 field_id）；rows 按字段顺序归一化；
 * 列数取字段数（记录若缺字段按 null 补齐，多余字段忽略）。
 */
export function feishuToSheetInfo(input: FeishuToSheetInfoInput): FeishuToSheetInfoResult {
  const { tableName, fields, records } = input;

  const headers: string[] = fields.map((f) => f.field_name || f.field_id);
  const columns: FieldType[] = fields.map((f) => mapFeishuFieldType(f.type));

  const rows: unknown[][] = records.map((rec) => {
    const row: unknown[] = new Array(fields.length).fill(null);
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      // 优先按 field_name 取，缺失时按 field_id 兜底（部分接口字段名与键不一致）
      const raw = rec.fields[f.field_name] ?? rec.fields[f.field_id];
      row[i] = normalizeFeishuCell(f.type, raw);
    }
    return row;
  });

  const sheet: SheetInfo = {
    name: tableName || "飞书多维表",
    headers,
    rows,
    rowCount: rows.length,
    colCount: headers.length,
  };

  return { sheet, columns };
}
