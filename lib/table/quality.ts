/**
 * 表格处理 —— 数据质量检测模块（T1-C）
 *
 * 职责（与清洗解耦）：消费「已清洗+已裁剪」的 EffectiveDataset + 原始解析 SheetInfo，
 * 产出结构化 QualityIssue[]（EMPTY_ROWS_SKIPPABLE / GHOST_COLUMNS_PRESENT /
 * MIXED_DATE_FORMAT 等）。
 *
 * 设计铁律（T1-C）：
 *  - 本模块只「检测并报告」质量问题，除空白行/幽灵列这些结构性无效项已在 cleaner 裁剪外，
 *    绝不自动改写任何业务值（混合日期/金额格式不在本阶段规范化，归 T1-D/后续）；
 *  - 纯函数、零副作用、不调用 parser/cleaner/LLM/网络/生产库；
 *  - samples 严格截断（≤5 项）且仅含去敏感样本（行号/列名/序列号），不承载完整业务记录；
 *  - 严重度统一为 warning（质量问题提示，非阻断）；下游可据 affectedRows/Columns 决定处置。
 */

import type { EffectiveDataset, QualityIssue, SheetInfo } from "./types";

/** Excel 序列号形态：4~5 位整数（或带小数），落在合理日期序列号区间 */
const EXCEL_SERIAL_RE = /^(\d{4,5})(\.\d+)?$/;
/** 标准 ISO 日期串（YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS） */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/;
/** Excel 序列号合理区间（1900 日期系统：约 1900-01-01 起，4~5 位有效数字） */
const EXCEL_SERIAL_MIN = 30000;
const EXCEL_SERIAL_MAX = 100000;
/** 样本最大条数（防敏感值外泄 / 报告过长） */
const MAX_SAMPLES = 5;
/** 高缺失率判定阈值（某列空值比例 ≥ 此值触发告警） */
const NULL_RATIO_THRESHOLD = 0.5;
/** 触发高缺失率检测的最小行数（避免小表噪声） */
const MIN_ROWS_FOR_NULL_RATIO = 5;

/** 货币符号 / 代码 → 标准化标识（用于混合货币检测） */
const CURRENCY_PATTERNS: Array<{ re: RegExp; label: string; capture?: boolean }> = [
  { re: /[¥￥]/, label: "¥/￥(CNY)" },
  { re: /\$/, label: "$(USD)" },
  { re: /[€]/, label: "€(EUR)" },
  { re: /[£]/, label: "£(GBP)" },
  { re: /\b(cny|rmb|usd|eur|gbp|jpy|hkd)\b/i, label: "币种代码", capture: true },
];
/** 返回单元格命中的第一个货币标识，未命中返回 null */
function matchCurrency(s: string): string | null {
  for (const p of CURRENCY_PATTERNS) {
    const m = s.match(p.re);
    if (m) return p.capture ? m[0].toUpperCase() : p.label;
  }
  return null;
}

/**
 * 检测表格级数据质量问题。
 * @param sheet 原始解析 SheetInfo（保留 RAW 值，用于混合日期等需在清洗前观测的表达）
 * @param ds    已清洗+已裁剪的 EffectiveDataset（含 excludedRows / excludedColumns 边界）
 * @returns 结构化质量信号数组（可能为空）
 */
export function detectTableQualityIssues(sheet: SheetInfo, ds: EffectiveDataset): QualityIssue[] {
  const issues: QualityIssue[] = [];

  /* 1) 空行跳过：cleaner 已把空行/格式残留行排除到 excludedRows */
  if (ds.excludedRows.length > 0) {
    const samples = ds.excludedRows.slice(0, MAX_SAMPLES).map((e) => `row#${e.rowIndex}`);
    issues.push({
      code: "EMPTY_ROWS_SKIPPABLE",
      severity: "warning",
      message: `检测到 ${ds.excludedRows.length} 个空行/格式残留行，已在有效数据集中排除`,
      affectedRows: ds.excludedRows.length,
      samples,
      suggestedAction: "确认这些行确为空白或说明行，无需纳入分析；如需保留请补充业务值",
    });
  }

  /* 2) 幽灵列：cleaner 已把无真实表头的占位列排除到 excludedColumns */
  if (ds.excludedColumns.length > 0) {
    const examples = ds.excludedColumns.slice(0, MAX_SAMPLES).map((c) => c.name);
    issues.push({
      code: "GHOST_COLUMNS_PRESENT",
      severity: "warning",
      message: `检测到 ${ds.excludedColumns.length} 个幽灵/占位列（无真实表头），已在有效列集中排除`,
      affectedColumns: ds.excludedColumns.length,
      samples: examples,
      suggestedAction: "确认这些列非业务字段；若需保留请补充表头，否则不会被分析消费",
    });
  }

  /* 3) 混合日期格式：仅在 RAW 值中可观测（cleaner 会把序列号规范为 ISO，清洗后即不可见）。
   *    遍历 effective 中推断为 date 的列，比对 RAW sheet 值：ISO 串与 Excel 序列号并存 → 混合。
   *    注意：列裁剪只移除尾部占位列（column_N 在末位），故 ds 列下标 i 与 sheet 列下标 i 对齐。 */
  ds.columns.forEach((type, i) => {
    if (type !== "date") return;
    const colName = ds.headers[i];
    let serialCount = 0;
    const serialSamples: string[] = [];
    let isoCount = 0;
    let otherNonIsoCount = 0;

    for (const r of sheet.rows) {
      const v = r[i];
      if (v === null || v === undefined) continue;
      const s = String(v).trim();
      if (s === "") continue;
      if (ISO_DATE_RE.test(s)) {
        isoCount++;
        continue;
      }
      const m = s.match(EXCEL_SERIAL_RE);
      if (m) {
        const n = Number(m[1]);
        if (n >= EXCEL_SERIAL_MIN && n < EXCEL_SERIAL_MAX) {
          serialCount++;
          if (serialSamples.length < MAX_SAMPLES) serialSamples.push(s);
          continue;
        }
      }
      // 其它非 ISO 的日期表达（如中文「2024年8月1日」、美式 MM/DD/YYYY 等）亦计入非标准表达
      otherNonIsoCount++;
    }

    if (serialCount >= 2 || otherNonIsoCount >= 2) {
      const mixedKinds = [
        isoCount > 0 ? "标准ISO日期" : null,
        serialCount > 0 ? `Excel序列号(≈${serialCount})` : null,
        otherNonIsoCount > 0 ? `其它非标准表达(≈${otherNonIsoCount})` : null,
      ].filter(Boolean) as string[];
      issues.push({
        code: "MIXED_DATE_FORMAT",
        severity: "warning",
        fieldId: colName,
        columnName: colName,
        message: `日期列「${colName}」混合多种表达：${mixedKinds.join(" + ")}`,
        affectedRows: Math.max(serialCount, otherNonIsoCount),
        samples: serialSamples.length > 0 ? serialSamples : undefined,
        suggestedAction: "T1-D 或后续将序列号/非标准表达规范为 ISO；本阶段仅检测报告，不自动改写",
      });
    }
  });

  /* 4) 完全重复行：整行（全部列）内容一致的重复数据行，通常属数据录入/导出重复。
   *    纯函数、零副作用；仅检测报告，不自动去重（去重会改写业务行数，归后续阶段）。 */
  {
    const seen = new Map<string, number>();
    let dupCount = 0;
    const dupSamples: string[] = [];
    ds.rows.forEach((r, ri) => {
      let key: string;
      try {
        key = JSON.stringify(r.map((c) => (c === null || c === undefined ? null : c)));
      } catch {
        key = String(r);
      }
      const prev = seen.get(key) ?? 0;
      if (prev > 0) {
        dupCount++;
        if (dupSamples.length < MAX_SAMPLES) dupSamples.push(`数据行#${ri + 1}`);
      }
      seen.set(key, prev + 1);
    });
    if (dupCount >= 1) {
      issues.push({
        code: "DUPLICATE_ROWS",
        severity: "warning",
        message: `检测到 ${dupCount} 个完全重复的数据行（整行内容一致，可能为重复录入/导出）`,
        affectedRows: dupCount,
        samples: dupSamples,
        suggestedAction: "确认重复行是否为误录；分析前建议剔除，避免指标被重复计数放大",
      });
    }
  }

  /* 5) 高缺失率列：某列空值比例过高（≥阈值），意味着该字段采集不完整或不该被分析消费。 */
  if (ds.effectiveRowCount >= MIN_ROWS_FOR_NULL_RATIO) {
    ds.headers.forEach((h, i) => {
      const header = String(h ?? "").trim();
      if (header === "" || /^column_\d+$/.test(header)) return;
      let empty = 0;
      for (const r of ds.rows) {
        const v = r[i];
        if (v === null || v === undefined || String(v).trim() === "") empty++;
      }
      const ratio = empty / ds.effectiveRowCount;
      if (ratio >= NULL_RATIO_THRESHOLD) {
        issues.push({
          code: "HIGH_NULL_RATIO",
          severity: "warning",
          fieldId: header,
          columnName: header,
          message: `列「${header}」空值比例过高（${Math.round(ratio * 100)}%，约 ${empty}/${ds.effectiveRowCount} 行缺失）`,
          affectedRows: empty,
          suggestedAction: "确认该字段是否必要；若大部分行为空，建议排除该列或补全采集",
        });
      }
    });
  }

  /* 6) 混合货币符号：同一列出现 ≥2 种货币符号/代码（如 ¥ 与 $ 并存），金额口径不一致。
   *    属于业务级数据质量问题（直接求和会严重失真），且不依赖领域语义即可检测。
   *    注：必须扫 RAW 值（sheet.rows）——cleaner 会把 "¥100" 归一为数字 100、剥掉符号，
   *        ds.rows 已无符号，故此处对齐列下标扫描原始行（跳过 detectedHeaderRow 表头行）。 */
  {
    const rawStart = (ds.detectedHeaderRow ?? 0) + 1;
    ds.headers.forEach((h, i) => {
      const header = String(h ?? "").trim();
      if (header === "") return;
      const found = new Set<string>();
      let currencyCells = 0;
      for (let ri = rawStart; ri < sheet.rows.length; ri++) {
        const row = sheet.rows[ri];
        const v = row ? row[i] : undefined;
        if (v === null || v === undefined) continue;
        const s = String(v).trim();
        if (s === "") continue;
        const m = matchCurrency(s);
        if (m) {
          found.add(m);
          currencyCells++;
        }
      }
      if (found.size >= 2 && currencyCells >= 2) {
        issues.push({
          code: "MIXED_CURRENCY",
          severity: "warning",
          fieldId: header,
          columnName: header,
          message: `金额列「${header}」混合多种货币符号（${[...found].join(" / ")}），口径不一致`,
          affectedRows: currencyCells,
          samples: [...found],
          suggestedAction: "统一货币口径或拆分币种列；混合币种直接求和会严重失真",
        });
      }
    });
  }

  return issues;
}
