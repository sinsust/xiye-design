/**
 * 组合建议引擎 —— 连接键检测（纯函数，可单测，不依赖网络/key）
 *
 * 输入：多张表的「连接候选概要」JoinInput[]（由 buildJoinInputFromSheet 从 SheetInfo 构造）。
 * 输出：JoinSuggestion[] —— 跨表可组合的连接键对，按匹配率降序。
 *
 * 匹配规则：
 *  - 列类型可连接：id/text/category/email/url/phone 或 numeric(integer/float) 同族；
 *  - 键重叠率用 Jaccard（样本去重键值集合交集 / 并集）；
 *  - Jaccard ≥ 0.6 强提示（high）；0.3~0.6 且同名 → 弱提示（medium）；其余不提示；
 *  - 每对表最多保留 3 条（避免组合爆炸）。
 *
 * 与「产品推荐不自动合并」铁律一致：本模块只产出建议，绝不自动执行组合。
 */

import type { FieldType, SheetInfo } from "../types";

/** 单表连接候选列概要 */
export interface JoinColumnProfile {
  /** 列名（清洗后） */
  name: string;
  /** 推断类型（来自画像，缺省兜底 text） */
  type: FieldType;
  /** 去重后的非空样本键值（从前若干行取样，用于 Jaccard 重叠判定） */
  sampleValues: string[];
  /** 全量非空值数（用于唯一率） */
  nonNullCount: number;
  /** 全量去重值数（用于唯一率） */
  uniqueCount: number;
}

/** 单表连接概要 */
export interface JoinInput {
  sheetName: string;
  /** 服务端缓存 id（前端组合时直接回传，无需重新上传） */
  tableId: string;
  columns: JoinColumnProfile[];
}

/** 组合可信度 */
export type JoinConfidence = "high" | "medium";

/** 一条组合建议（左表某列 ↔ 右表某列） */
export interface JoinSuggestion {
  leftSheet: string;
  rightSheet: string;
  leftTableId: string;
  rightTableId: string;
  keyColumnLeft: string;
  keyColumnRight: string;
  /** Jaccard 键重叠率 0~1 */
  matchRate: number;
  /** 左键唯一率（uniqueCount / max(nonNullCount,1)） */
  keyUniquenessLeft: number;
  /** 右键唯一率 */
  keyUniquenessRight: number;
  confidence: JoinConfidence;
  /** 是否同名（跨名匹配为弱提示） */
  sameName: boolean;
  /** 人类可读说明 */
  note: string;
}

const JOINABLE_TEXT_TYPES = new Set<FieldType>([
  "id",
  "text",
  "category",
  "email",
  "url",
  "phone",
]);
const JOINABLE_NUMERIC_TYPES = new Set<FieldType>(["integer", "float"]);

function isJoinableType(t: FieldType): boolean {
  return JOINABLE_TEXT_TYPES.has(t) || JOINABLE_NUMERIC_TYPES.has(t);
}

function isNumericType(t: FieldType): boolean {
  return JOINABLE_NUMERIC_TYPES.has(t);
}

function normalizeName(n: string): string {
  return (n ?? "").trim().toLowerCase().replace(/[\s_\-]/g, "");
}

function toScalar(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = typeof v === "string" ? v : String(v);
  const t = s.trim();
  if (t === "") return null;
  return t;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const v of a) if (b.has(v)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * 从原始 SheetInfo 构造 JoinInput（纯函数）。
 * @param sheet      原始解析 SheetInfo（来自 cacheTable 的 rawSheet）
 * @param tableId    服务端缓存 id
 * @param columnTypes 可选：各列推断类型（来自画像 ds.columns）；缺失兜底 text
 * @param sampleLimit 样本键值取样行数上限（默认 500）
 */
export function buildJoinInputFromSheet(
  sheet: SheetInfo,
  tableId: string,
  columnTypes?: FieldType[],
  sampleLimit = 500,
): JoinInput {
  const columns: JoinColumnProfile[] = sheet.headers.map((h, ci) => {
    const set = new Set<string>();
    let nonNull = 0;
    const seen = new Set<string>();
    let unique = 0;
    for (let r = 0; r < sheet.rows.length; r++) {
      const s = toScalar(sheet.rows[r]?.[ci]);
      if (s === null) continue;
      nonNull++;
      if (!seen.has(s)) {
        seen.add(s);
        unique++;
      }
      if (set.size < sampleLimit) set.add(s);
    }
    return {
      name: h,
      type: columnTypes?.[ci] ?? "text",
      sampleValues: [...set],
      nonNullCount: nonNull,
      uniqueCount: unique,
    };
  });
  return { sheetName: sheet.name, tableId, columns };
}

function buildNote(
  leftKey: string,
  rightKey: string,
  jac: number,
  sameName: boolean,
  ul: number,
  ur: number,
): string {
  const pct = Math.round(jac * 100);
  const rel = sameName
    ? `同名字段「${leftKey}」`
    : `字段「${leftKey}」↔「${rightKey}」`;
  const relTxt = sameName ? "（左右字段同名）" : "";
  const weakMulti = ul < 0.9 || ur < 0.9;
  const warn = weakMulti ? "；注意存在重复键值，组合可能产生一对多" : "";
  return `检测到 ${rel} 可作为连接键，键重叠率 ${pct}%${relTxt}${warn}`;
}

/**
 * 跨表检测可组合连接键。纯函数，无副作用。
 * @returns 按 matchRate 降序；每对表最多 3 条建议。
 */
export function detectJoinKeys(inputs: JoinInput[]): JoinSuggestion[] {
  const out: JoinSuggestion[] = [];
  for (let i = 0; i < inputs.length; i++) {
    for (let j = i + 1; j < inputs.length; j++) {
      const A = inputs[i];
      const B = inputs[j];
      for (const ca of A.columns) {
        if (!isJoinableType(ca.type)) continue;
        for (const cb of B.columns) {
          if (!isJoinableType(cb.type)) continue;
          // 类型族必须一致：numeric 只与 numeric；其余可跨文本族
          if (isNumericType(ca.type) !== isNumericType(cb.type)) continue;
          const aSet = new Set(ca.sampleValues);
          const bSet = new Set(cb.sampleValues);
          const jac = jaccard(aSet, bSet);
          const sameName = normalizeName(ca.name) === normalizeName(cb.name);
          let confidence: JoinConfidence | null = null;
          if (jac >= 0.6) confidence = "high";
          else if (jac >= 0.3 && sameName) confidence = "medium";
          if (!confidence) continue;
          const ul = ca.uniqueCount / Math.max(ca.nonNullCount, 1);
          const ur = cb.uniqueCount / Math.max(cb.nonNullCount, 1);
          out.push({
            leftSheet: A.sheetName,
            rightSheet: B.sheetName,
            leftTableId: A.tableId,
            rightTableId: B.tableId,
            keyColumnLeft: ca.name,
            keyColumnRight: cb.name,
            matchRate: jac,
            keyUniquenessLeft: ul,
            keyUniquenessRight: ur,
            confidence,
            sameName,
            note: buildNote(ca.name, cb.name, jac, sameName, ul, ur),
          });
        }
      }
    }
  }

  out.sort((x, y) => y.matchRate - x.matchRate);

  // 每对表最多保留 top 3
  const grouped = new Map<string, JoinSuggestion[]>();
  for (const s of out) {
    const k = `${s.leftTableId}|${s.rightTableId}`;
    const arr = grouped.get(k) ?? [];
    arr.push(s);
    grouped.set(k, arr);
  }
  const result: JoinSuggestion[] = [];
  for (const arr of grouped.values()) result.push(...arr.slice(0, 3));
  return result;
}
