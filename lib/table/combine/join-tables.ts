/**
 * 组合执行 —— keyed join（纯函数，可单测，不依赖网络/key）
 *
 * 输入：左表 SheetInfo + 右表 SheetInfo + 左右连接键 + 选项（默认 left join）。
 * 输出：一张合并 SheetInfo（左表全列 + 右表非键列；列名冲突加右表别名前缀）+ 警告。
 *
 * 语义：
 *  - 默认 left join（保留左表全部行，右表无匹配补 null）；
 *  - 右表连接键须唯一（主键语义），非唯一 → 取首个匹配并告警「一对多」；
 *  - 列名冲突：右表同名列加 `_<别名>` 后缀，避免覆盖左表；
 *  - 产出 SheetInfo 直接喂 buildEffectiveDataset → profileEffectiveDataset → cacheTable，
 *    下游确认/画像/分析/导出零改动。
 */

import type { SheetInfo } from "../types";

export type JoinType = "left" | "inner";

export interface JoinOptions {
  /** 连接类型，默认 left（保留左表全部行） */
  joinType?: JoinType;
  /** 右表列名前缀别名（默认用 right.name），用于消解列名冲突 */
  rightSheetAlias?: string;
}

export interface JoinResult {
  sheet: SheetInfo;
  /** 非阻断警告（如一对多） */
  warnings: string[];
}

function scalarKey(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = typeof v === "string" ? v : String(v);
  const t = s.trim();
  return t === "" ? null : t;
}

/**
 * 按连接键执行 keyed join，产出合并 SheetInfo。
 * @throws 当指定连接键在任意一侧不存在时抛错（调用方应已校验建议合法）
 */
export function joinTables(
  left: SheetInfo,
  right: SheetInfo,
  keyLeft: string,
  keyRight: string,
  options: JoinOptions = {},
): JoinResult {
  const joinType = options.joinType ?? "left";
  const alias = (options.rightSheetAlias ?? right.name ?? "右表").trim() || "右表";

  const li = left.headers.indexOf(keyLeft);
  const ri = right.headers.indexOf(keyRight);
  if (li < 0 || ri < 0) {
    throw new Error(
      `连接键不存在：左表「${keyLeft}」=${li >= 0 ? "存在" : "缺失"}，右表「${keyRight}」=${ri >= 0 ? "存在" : "缺失"}`,
    );
  }

  // 右表非键列，处理列名冲突
  const leftNames = new Set(left.headers);
  const rightOutHeaders: string[] = [];
  const rightOutIdx: number[] = [];
  for (let c = 0; c < right.headers.length; c++) {
    if (c === ri) continue;
    let name = right.headers[c];
    if (leftNames.has(name)) name = `${name}_${alias}`;
    rightOutHeaders.push(name);
    rightOutIdx.push(c);
  }

  const outHeaders = [...left.headers, ...rightOutHeaders];

  // 右表键索引（Map：键值 → 首个匹配行 + 重复计数）
  const index = new Map<string, { row: unknown[]; dup: number }>();
  for (const row of right.rows) {
    const k = scalarKey(row[ri]);
    if (k === null) continue;
    const existing = index.get(k);
    if (!existing) index.set(k, { row, dup: 0 });
    else existing.dup++;
  }

  const warnings: string[] = [];
  let oneToMany = 0;
  const outRows: unknown[][] = [];

  for (const lrow of left.rows) {
    const k = scalarKey(lrow[li]);
    const matched = k === null ? undefined : index.get(k);
    if (matched) {
      if (matched.dup > 0) oneToMany++;
      outRows.push([...lrow, ...rightOutIdx.map((c) => matched.row[c])]);
    } else {
      if (joinType === "inner") continue; // left join 保留左行并补 null
      outRows.push([...lrow, ...rightOutIdx.map(() => null)]);
    }
  }

  if (oneToMany > 0) {
    warnings.push(
      `右表连接键「${keyRight}」存在重复值，约 ${oneToMany} 行发生一对多关联；已取首个匹配，建议改用唯一键组合。`,
    );
  }
  if (joinType === "left" && outRows.length < left.rows.length) {
    // 不应发生（left 不会丢行），兜底提示
    warnings.push("左连接后行数少于左表，请检查连接键空值。");
  }
  if (joinType === "inner" && outRows.length === 0) {
    warnings.push("内连接后无匹配行，请确认连接键值域是否一致。");
  }

  return {
    sheet: {
      name: `${left.name} ⋈ ${right.name}`,
      headers: outHeaders,
      rows: outRows,
      rowCount: outRows.length,
      colCount: outHeaders.length,
    },
    warnings,
  };
}
