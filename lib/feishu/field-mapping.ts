/**
 * 飞书多维表格 —— 字段类型映射与单元格值归一化
 *
 * 把飞书的 field_type（数字枚举）映射为 xiye 的 FieldType（lib/table/types.ts），
 * 并把飞书各字段类型的原始值归一化为 xiye 表格可消费的 字符串/数字/布尔/空。
 *
 * 纯函数、零 env 依赖，可独立 mock 单测。
 */

import type { FieldType } from "@/lib/table/types";

/**
 * 飞书 field_type（数字）→ xiye FieldType 映射表。
 * 未列出的类型统一回落为 "text"，不丢值（原样字符串化）。
 */
const FIELD_TYPE_MAP: Record<number, FieldType> = {
  1: "text", // 多行文本
  2: "float", // 数字
  3: "category", // 单选
  4: "category", // 多选
  5: "date", // 日期
  7: "boolean", // 复选框
  8: "currency", // 货币
  9: "text", // 人员(人数)
  10: "percentage", // 进度
  11: "text", // 人员
  13: "phone", // 电话号码
  14: "email", // 邮箱
  15: "url", // 超链接
  16: "text", // 附件
  17: "text", // 单向关联
  18: "text", // 双向关联
  19: "text", // 地理位置
  21: "text", // 公式
  22: "date", // 创建时间
  23: "date", // 最后更新时间
  24: "id", // 自动编号
  25: "text", // 二维码
  27: "text", // 条码
  30: "integer", // 评分
  31: "text", // 备注
};

/** 把飞书字段类型映射为 xiye FieldType（未知回落 text）。 */
export function mapFeishuFieldType(type: number): FieldType {
  return FIELD_TYPE_MAP[type] ?? "text";
}

/** 从数组中提取 name/text 字段并拼接（用于人员/多选/关联等对象数组）。 */
function joinNames(arr: unknown, sep = "; "): string {
  if (!Array.isArray(arr)) return "";
  return arr
    .map((it) => {
      if (it && typeof it === "object") {
        const o = it as Record<string, unknown>;
        return String(o.text ?? o.name ?? o.title ?? "");
      }
      return String(it);
    })
    .filter(Boolean)
    .join(sep);
}

/** 数字时间戳 → ISO 字符串；非数字原样转字符串。 */
function toDateString(raw: unknown): string {
  if (typeof raw === "number") {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (typeof raw === "string") return raw;
  return raw == null ? "" : String(raw);
}

/**
 * 把飞书单元格原始值归一化为 xiye 表格单元（字符串/数字/布尔/空）。
 *
 * @param type 飞书字段类型（数字枚举）
 * @param raw  接口返回的原始值（形态依赖字段类型）
 */
export function normalizeFeishuCell(type: number, raw: unknown): string | number | boolean | null {
  if (raw === null || raw === undefined || raw === "") return null;

  switch (type) {
    case 2: // 数字
    case 8: // 货币
    case 10: // 进度
    case 30: // 评分
      return typeof raw === "number" ? raw : Number(raw);

    case 7: // 复选框
      return typeof raw === "boolean" ? raw : Boolean(raw);

    case 5: // 日期
    case 22: // 创建时间
    case 23: // 最后更新时间
      return typeof raw === "number" || typeof raw === "string" ? toDateString(raw) : String(raw);

    case 3: // 单选
      if (raw && typeof raw === "object") return String((raw as Record<string, unknown>).text ?? "");
      return String(raw);

    case 4: // 多选
    case 11: // 人员
    case 16: // 附件
    case 17: // 单向关联
    case 18: // 双向关联
      return joinNames(raw);

    case 19: // 地理位置
      if (raw && typeof raw === "object") return String((raw as Record<string, unknown>).location ?? raw);
      return String(raw);

    case 13: // 电话
    case 14: // 邮箱
    case 15: // 超链接
    case 24: // 自动编号
    case 1: // 多行文本
    case 9: // 人员(人数)
    case 21: // 公式
    case 25: // 二维码
    case 27: // 条码
    case 31: // 备注
    default:
      if (Array.isArray(raw)) return joinNames(raw);
      if (raw && typeof raw === "object") {
        // 公式/未识别对象：尽量取可读字段，否则 JSON 字符串化
        const o = raw as Record<string, unknown>;
        if (o.text != null) return String(o.text);
        if (o.name != null) return String(o.name);
        try {
          return JSON.stringify(raw);
        } catch {
          return String(raw);
        }
      }
      return String(raw);
  }
}
