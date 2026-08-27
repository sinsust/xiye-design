/**
 * 表格金标样本 —— 确定性基线验证（T0 支线）
 *
 * 运行：npm run validate:table-baseline
 * 职责：
 *  - 先确保 Fixture 已生成（调用 generateAll，生成到被 gitignore 的 generated/）
 *  - 只走确定性链：file-magic → parser → cleaner → profiler（+ detectSheetStructure）
 *  - 严禁调用 lib/table/llm.ts、任何 /api、任何网络、生产库、session-cache
 *  - 逐 Fixture 断言：文件类型 / 可解析 / Sheet 数名 / 表头行 / 有效行列数 /
 *    幽灵列裁剪 / 关键字段类型 / 质量问题信号 / 多 Sheet 不合并 / 无状态泄露
 *  - 输出 artifacts/table-baseline/latest.json 与 latest.md
 *  - 任一 HARD 断言失败 → 退出码 1（基线允许失败，但脚本必须如实反映）
 *
 * 设计原则（T0 边界）：
 *  - 不修改 parser/cleaner/profiler/UI/API 行为
 *  - Expected Contract 为金标，不因现状降低断言标准
 *  - 对"系统尚未实现"的能力（推荐选择器）用只读启发式比对，能力缺失记为 SKIP 而非解析 bug
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { detectFileMagic } from "../lib/table/file-magic";
import { parseFile, detectSheetStructure } from "../lib/table/parser";
import { detectHeaderRow, buildEffectiveDataset } from "../lib/table/cleaner";
import { profileEffectiveDataset } from "../lib/table/profiler";
import { type EffectiveDataset, type TableProfileResult } from "../lib/table/types";
import { parseContract, type FixtureContract, type QualityIssue } from "../data/table-fixtures/expected/contract";
import { generateAll } from "./generate-table-fixtures.mts";

/* ─────────────── 路径 ─────────────── */
function rootDir(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}
function expectedDir(): string {
  return join(rootDir(), "data", "table-fixtures", "expected");
}
function artifactsDir(): string {
  return join(rootDir(), "artifacts", "table-baseline");
}

/* ─────────────── 工具 ─────────────── */
function normalizeName(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}
/** 有效列数 = 非空且非 column_N 垃圾列的数量 */
function countEffectiveColumns(headers: string[]): number {
  return headers.filter((h) => {
    const s = String(h ?? "").trim();
    if (s === "") return false;
    if (/^column_\d+$/.test(s)) return false;
    return true;
  }).length;
}
function findColumn<T extends { name: string }>(
  cols: T[],
  displayName: string,
  normalizedName: string,
): T | undefined {
  return (
    cols.find((c) => c.name === displayName) ||
    cols.find((c) => normalizeName(c.name) === normalizedName)
  );
}

/* ─────────────── 断言收集 ─────────────── */
type Severity = "hard" | "warn" | "skip";
interface Assertion {
  layer: string;
  name: string;
  severity: Severity;
  pass: boolean;
  detail: string;
}
class FixtureResult {
  fixtureId = "";
  fileKind = "";
  sheetCount = 0;
  effectiveColumns = 0;
  profileColumns = 0;
  assertions: Assertion[] = [];
  qualitySignals: Record<string, { satisfied: boolean; detail: string }> = {};
  failedHard = 0;
  failedWarn = 0;
  skipped = 0;

  add(layer: string, name: string, severity: Severity, pass: boolean, detail: string) {
    this.assertions.push({ layer, name, severity, pass, detail });
    if (severity === "hard" && !pass) this.failedHard++;
    if (severity === "warn" && !pass) this.failedWarn++;
    if (severity === "skip") this.skipped++;
  }
}

/* ─────────────── 只读"推荐"启发式（不修改产品代码） ─────────────── */
function isRecommendedHeuristic(name: string, headers: string[]): boolean {
  const n = name.toLowerCase();
  if (n.includes("notes") || n.includes("note") || n.includes("overview") || n.includes("说明") || n.includes("汇总") || n.includes("封面"))
    return false;
  return countEffectiveColumns(headers) >= 2 && countEffectiveColumns(headers) <= 80;
}

/* ─────────────── 质量问题信号派生（从确定性链输出观测） ─────────────── */
function detectQualitySignals(
  sheet: { headers: string[]; rows: unknown[][] },
  cleanedHeaders: string[],
  cleanedRows: unknown[][],
  profile: TableProfileResult,
  issues: QualityIssue[],
): Record<string, { satisfied: boolean; detail: string }> {
  const out: Record<string, { satisfied: boolean; detail: string }> = {};
  // 预计算各列
  const colIndex = (norm: string) =>
    cleanedHeaders.findIndex((h) => normalizeName(h) === norm);
  const valuesOf = (norm: string): unknown[] => {
    const i = colIndex(norm);
    if (i < 0) return [];
    return cleanedRows.map((r) => r[i] ?? null);
  };
  const nullCountOf = (norm: string): number =>
    valuesOf(norm).filter((v) => v === null || v === undefined || String(v).trim() === "").length;

  for (const iss of issues) {
    const code = iss.code;
    let satisfied = false;
    let detail = "";
    switch (code) {
      case "EMPTY_SKU":
      case "MISSING_COST":
      case "MISSING_FEE":
      case "EMPTY_EMAIL":
      case "UNSIGNED_DELIVERY": {
        const nc = nullCountOf(iss.field ? normalizeName(iss.field) : "");
        satisfied = nc >= iss.minimumAffectedRows;
        detail = `空值数=${nc}（要求≥${iss.minimumAffectedRows}）`;
        break;
      }
      case "DUPLICATE_ORDER_ID":
      case "DUPLICATE_EMAIL": {
        const i = colIndex(iss.field ? normalizeName(iss.field) : "");
        let dup = 0;
        if (i >= 0) {
          const seen = new Map<string, number>();
          for (const r of cleanedRows) {
            const v = r[i];
            if (v === null || v === undefined || String(v).trim() === "") continue;
            const k = String(v).trim();
            seen.set(k, (seen.get(k) || 0) + 1);
          }
          for (const c of seen.values()) if (c > 1) dup += c - 1;
        }
        satisfied = dup >= iss.minimumAffectedRows;
        detail = `重复值出现次数=${dup}（要求≥${iss.minimumAffectedRows}）`;
        break;
      }
      case "LOW_STOCK": {
        const vals = valuesOf(norm(iss.field)).filter(
          (v) => v !== null && v !== undefined && String(v).trim() !== "",
        ) as number[];
        const low = vals.filter((v) => typeof v === "number" && v < 10).length;
        satisfied = low >= iss.minimumAffectedRows;
        detail = `库存<10 行数=${low}（要求≥${iss.minimumAffectedRows}）`;
        break;
      }
      case "REFUND_PRESENT": {
        const i = colIndex(norm(iss.field));
        let cnt = 0;
        if (i >= 0)
          for (const r of cleanedRows) {
            if (String(r[i] ?? "").includes("已退款")) cnt++;
          }
        satisfied = cnt >= iss.minimumAffectedRows;
        detail = `已退款行数=${cnt}（要求≥${iss.minimumAffectedRows}）`;
        break;
      }
      case "DATE_GAP_ANALYZABLE": {
        const iS = colIndex("发货日期");
        const iR = colIndex("签收日期");
        let cnt = 0;
        if (iS >= 0 && iR >= 0)
          for (const r of cleanedRows) {
            if (r[iS] != null && r[iR] != null && String(r[iS]).trim() !== "" && String(r[iR]).trim() !== "")
              cnt++;
          }
        satisfied = cnt >= iss.minimumAffectedRows;
        detail = `收发日期完整行=${cnt}（要求≥${iss.minimumAffectedRows}）`;
        break;
      }
      case "CAN_COMPUTE_CTR_CPA_ROAS": {
        const norms = ["曝光", "点击", "转化", "消耗", "收入"].map(norm);
        let cnt = 0;
        for (const r of cleanedRows) {
          const all = norms.every((nn) => {
            const i = colIndex(nn);
            return i >= 0 && r[i] != null && String(r[i]).trim() !== "";
          });
          if (all) cnt++;
        }
        satisfied = cnt >= iss.minimumAffectedRows;
        detail = `全字段非空行=${cnt}（要求≥${iss.minimumAffectedRows}）`;
        break;
      }
      case "EMPTY_ROWS_SKIPPABLE": {
        const rawRows = sheet.rows.length;
        const cleaned = cleanedRows.length;
        satisfied = cleaned < rawRows; // 空行被跳
        detail = `原始数据行=${rawRows}，清洗后=${cleaned}`;
        break;
      }
      case "DUPLICATE_COLUMN_NAME": {
        const hasSuffix = cleanedHeaders.some((h) => /^.*_\d+$/.test(h) && !/^column_\d+$/.test(h));
        satisfied = hasSuffix;
        detail = hasSuffix ? "检测到重复列名加序号（如 备注_2）" : "未检测到重复列名后缀";
        break;
      }
      case "MIXED_DATE_FORMAT": {
        const i = colIndex(norm(iss.field));
        let cnt = 0;
        if (i >= 0)
          for (const r of sheet.rows) {
            const v = r[i];
            if (typeof v === "number" && v > 30000 && v < 100000) cnt++; // Excel 序列号区间
          }
        satisfied = cnt >= iss.minimumAffectedRows;
        detail = `疑似序列号单元格=${cnt}（要求≥${iss.minimumAffectedRows}）`;
        break;
      }
      case "MIXED_CURRENCY_FORMAT": {
        const i = colIndex(norm(iss.field));
        let cnt = 0;
        if (i >= 0)
          for (const r of cleanedRows) {
            const s = String(r[i] ?? "").trim();
            if (/^\d+(\.\d+)?$/.test(s)) cnt++; // 纯数字（无 ¥ 符号）
          }
        satisfied = cnt >= iss.minimumAffectedRows;
        detail = `纯数字金额单元格=${cnt}（要求≥${iss.minimumAffectedRows}）`;
        break;
      }
      case "GHOST_COLUMNS_PRESENT": {
        const rawCols = sheet.headers.length;
        satisfied = rawCols > 50; // 证明存在虚高列
        detail = `原始表头宽度=${rawCols}`;
        break;
      }
      case "HEADER_NOT_FIRST_ROW": {
        const idx = detectHeaderRow([...(sheet.headers ? [sheet.headers] : []), ...sheet.rows]);
        satisfied = idx > 0;
        detail = `detectHeaderRow 返回 index=${idx}`;
        break;
      }
      case "SHEETS_NOT_SILENTLY_MERGED": {
        satisfied = true; // 在 multi-sheet 专项中单独断言
        detail = "见多 Sheet 专项断言";
        break;
      }
      default:
        satisfied = false;
        detail = `未实现信号检测: ${code}`;
    }
    out[code] = { satisfied, detail };
  }
  return out;
}
function norm(s?: string | null): string {
  return normalizeName(s ?? "");
}

/* ─────────────── 主验证 ─────────────── */
async function validateFixture(
  contract: FixtureContract,
  fileBuffer: Buffer,
  fileName: string,
): Promise<FixtureResult> {
  const res = new FixtureResult();
  res.fixtureId = contract.fixtureId;
  res.fileKind = contract.fileKind;

  /* 1) file-magic */
  const magic = detectFileMagic(fileBuffer);
  const magicMapped = magic === "csv-text" ? "csv" : magic === "xlsx" ? "xlsx" : magic;
  res.add(
    "file-magic",
    "文件类型识别",
    "hard",
    magicMapped === contract.fileKind,
    `detectFileMagic=${magic} → 映射 ${magicMapped}（期望 ${contract.fileKind}）`,
  );

  /* 2) parse（不可抛未捕获异常） */
  let parsed: Awaited<ReturnType<typeof parseFile>> | null = null;
  try {
    parsed = await parseFile(fileBuffer, fileName);
    res.add("parser", "文件可解析且不抛异常", "hard", true, `sheets=${parsed.sheets.length}`);
  } catch (e) {
    res.add("parser", "文件可解析且不抛异常", "hard", false, `抛出异常: ${(e as Error).message}`);
    return res;
  }
  res.sheetCount = parsed.sheets.length;

  /* 3) Sheet 数量与名称 */
  res.add(
    "parser",
    "Sheet 数量符合",
    "hard",
    parsed.sheets.length === contract.expectedSheets.length,
    `实际 ${parsed.sheets.length} / 期望 ${contract.expectedSheets.length}`,
  );
  const expNames = new Set(contract.expectedSheets.map((s) => s.name));
  const gotNames = new Set(parsed.sheets.map((s) => s.name));
  const nameMatch = [...expNames].every((n) => gotNames.has(n)) && expNames.size === gotNames.size;
  res.add(
    "parser",
    "Sheet 名称符合",
    "hard",
    nameMatch,
    `期望 [${[...expNames].join(", ")}] / 实际 [${[...gotNames].join(", ")}]`,
  );

  /* 4) 多 Sheet 专项：不静默合并 + 推荐状态 */
  const struct = detectSheetStructure(parsed.sheets);
  const merged = struct.sameStructureGroups.some((g) => g.length > 1);
  res.add(
    "parser",
    "多 Sheet 不静默合并",
    "hard",
    !merged,
    merged ? `存在被合并的同结构组（长度>1）` : "无同结构组被合并",
  );
  for (const sc of contract.expectedSheets) {
    const sheet = parsed.sheets.find((s) => s.name === sc.name);
    if (!sheet) continue;
    const rec = isRecommendedHeuristic(sheet.name, sheet.headers);
    res.add(
      "expected",
      `推荐状态[${sc.name}]`,
      "warn",
      rec === sc.recommended,
      `启发式推荐=${rec} / 金标 recommended=${sc.recommended}（只读启发式，能力缺失属 T1）`,
    );
  }

  /* 5) 逐 Sheet：cleaner → EffectiveDataset → profiler（T1-A：Sheet 作用域断言） */
  // 5.0) 实际存在但契约未声明的 sheet → 告警（不阻断 HARD）
  const contractSheetNames = new Set(contract.expectedSheets.map((s) => s.name));
  for (const ps of parsed.sheets) {
    if (!contractSheetNames.has(ps.name)) {
      res.add(
        "expected",
        `多余Sheet[${ps.name}]`,
        "warn",
        false,
        "解析出该 sheet 但契约未声明（仅告警，不视为 HARD 失败）",
      );
    }
  }

  for (const sc of contract.expectedSheets) {
    const sheet = parsed.sheets.find((s) => s.name === sc.name);
    if (!sheet) {
      res.add("parser", `Sheet[${sc.name}] 存在`, "hard", false, "未找到该 sheet");
      continue;
    }

    // 表头行识别（来自 EffectiveDataset 边界，与 cleanSheet 口径一致）
    const ds: EffectiveDataset = buildEffectiveDataset(sheet);
    const headerIdx = ds.detectedHeaderRow;
    const headerOk = headerIdx === sc.expectedHeaderRow;
    if (sc.headerConfirmationRequired && !headerOk) {
      res.add(
        "cleaner",
        `表头行[${sc.name}]`,
        "hard",
        false,
        `detectHeaderRow=${headerIdx} ≠ 期望 ${sc.expectedHeaderRow}（需确认/低置信度标记）`,
      );
    } else if (sc.lowConfidenceAllowed && !headerOk) {
      res.add(
        "cleaner",
        `表头行[${sc.name}]`,
        "warn",
        true,
        `detectHeaderRow=${headerIdx} ≠ 期望 ${sc.expectedHeaderRow}（允许低置信度）`,
      );
    } else {
      res.add(
        "cleaner",
        `表头行[${sc.name}]`,
        "hard",
        headerOk,
        `detectHeaderRow=${headerIdx} / 期望 ${sc.expectedHeaderRow}`,
      );
    }

    // 有效行/列（来自 EffectiveDataset 边界）
    const effCols = countEffectiveColumns(ds.headers);
    res.effectiveColumns = effCols;
    const tol = contract.tolerance;
    const rowsOk =
      Math.abs(ds.effectiveRowCount - sc.expectedEffectiveRows) <= tol.effectiveRows;
    res.add(
      "cleaner",
      `有效行数[${sc.name}]`,
      "hard",
      rowsOk,
      `清洗后 ${ds.effectiveRowCount} / 期望 ${sc.expectedEffectiveRows}（容差 ${tol.effectiveRows}）`,
    );
    const colsOk = Math.abs(effCols - sc.expectedEffectiveColumns) <= tol.effectiveColumns;
    res.add(
      "cleaner",
      `有效列数[${sc.name}]`,
      "hard",
      colsOk,
      `有效列 ${effCols} / 期望 ${sc.expectedEffectiveColumns}（容差 ${tol.effectiveColumns}）`,
    );

    // profiler（消费 EffectiveDataset，边界一致）
    const profile = profileEffectiveDataset(ds);
    res.profileColumns = profile.columns.length;
    const profColsOk =
      Math.abs(profile.columns.length - sc.expectedEffectiveColumns) <= tol.effectiveColumns;
    // dirty fixture 当前会因 column_N 垃圾列导致 profile 列数虚高 → 暴露 T1 FIX-GHOST-COLUMNS
    res.add(
      "profiler",
      `画像列数[${sc.name}]`,
      "hard",
      profColsOk,
      `profile.columns.length=${profile.columns.length} / 期望 ${sc.expectedEffectiveColumns}`,
    );

    // 边界一致性：profiler 的有效行/列数必须与 EffectiveDataset 边界一致
    // （防止下游从 raw 重建而丢失 excludedRows/excludedColumns 信息；本阶段 excluded 为空，
    // 但此断言保证 T1-B/T1-C 引入裁剪后链路仍守恒）
    const boundaryOk =
      profile.rowCount === ds.effectiveRowCount && profile.colCount === ds.effectiveColumnCount;
    res.add(
      "profiler",
      `有效边界一致[${sc.name}]`,
      "hard",
      boundaryOk,
      `profiler(row=${profile.rowCount},col=${profile.colCount}) vs EffectiveDataset(row=${ds.effectiveRowCount},col=${ds.effectiveColumnCount})`,
    );

    // 关键字段类型（Sheet 作用域：只断言本 sheet 声明的字段，不再跨 sheet 误断言）
    for (const col of sc.expectedColumns) {
      if (!col.required) continue;
      const found = findColumn(profile.columns, col.displayName, col.normalizedName);
      if (!found) {
        res.add(
          "profiler",
          `字段存在[${col.displayName}]`,
          "hard",
          false,
          `未在 profile 中找到（归一化 ${col.normalizedName}）`,
        );
        continue;
      }
      const actualType = found.type;
      const typeOk = actualType === col.expectedType;
      res.add(
        "profiler",
        `字段类型[${col.displayName}]`,
        typeOk ? "hard" : sc.lowConfidenceAllowed ? "warn" : "hard",
        typeOk,
        `实际 ${actualType} / 期望 ${col.expectedType}`,
      );
    }

    // 质量问题信号（Sheet 作用域）
    const signals = detectQualitySignals(
      sheet,
      ds.headers,
      ds.rows,
      profile,
      sc.expectedQualityIssues,
    );
    Object.assign(res.qualitySignals, signals);
    for (const iss of sc.expectedQualityIssues) {
      const sig = signals[iss.code];
      if (!sig) {
        res.add("expected", `质量问题[${iss.code}]`, "warn", false, "无对应信号检测");
        continue;
      }
      res.add(
        "expected",
        `质量问题[${iss.code}]`,
        "hard",
        sig.satisfied,
        sig.detail,
      );
    }
  }

  return res;
}

/* ─────────────── 报告 ─────────────── */
function buildReport(results: FixtureResult[]) {
  let total = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const byLayer: Record<string, { pass: number; fail: number }> = {};
  for (const r of results) {
    for (const a of r.assertions) {
      total++;
      if (a.severity === "skip") {
        skipped++;
        continue;
      }
      byLayer[a.layer] = byLayer[a.layer] || { pass: 0, fail: 0 };
      if (a.pass) {
        passed++;
        byLayer[a.layer].pass++;
      } else {
        failed++;
        byLayer[a.layer].fail++;
      }
    }
  }
  return { total, passed, failed, skipped, byLayer };
}

function failureBreakdown(results: FixtureResult[]) {
  const list: { fixture: string; layer: string; name: string; detail: string }[] = [];
  for (const r of results) {
    for (const a of r.assertions) {
      if (a.severity === "hard" && !a.pass)
        list.push({ fixture: r.fixtureId, layer: a.layer, name: a.name, detail: a.detail });
    }
  }
  return list;
}

/* ─────────────── 入口 ─────────────── */
async function main() {
  // 1) 确保生成
  await generateAll();

  // 2) 读取所有 contract
  const expDir = expectedDir();
  const fsMod = await import("node:fs");
  const files = fsMod.readdirSync(expDir).filter((f) => f.endsWith(".json"));
  const contracts = new Map<string, FixtureContract>();
  for (const f of files) {
    const raw = JSON.parse(readFileSync(join(expDir, f), "utf-8"));
    const c = parseContract(raw);
    contracts.set(c.fixtureId, c);
  }

  // 3) 读取 generated 文件
  const genDir = join(rootDir(), "data", "table-fixtures", "generated");
  const genFiles = fsMod.readdirSync(genDir).filter((f) => f.endsWith(".csv") || f.endsWith(".xlsx"));

  // 4) 验证
  const results: FixtureResult[] = [];
  for (const gf of genFiles) {
    const fixtureId = gf.replace(/\.(csv|xlsx)$/, "");
    const contract = contracts.get(fixtureId);
    if (!contract) {
      console.error(`[WARN] 找不到 ${fixtureId} 的 expected contract，跳过`);
      continue;
    }
    const buf = readFileSync(join(genDir, gf));
    const r = await validateFixture(contract, buf, gf);
    results.push(r);
  }

  // 5) 报告
  const summary = buildReport(results);
  const failures = failureBreakdown(results);

  const md: string[] = [];
  md.push("# 表格金标基线验证报告");
  md.push("");
  md.push(`生成时间：${new Date().toISOString()}`);
  md.push("");
  md.push("## 汇总");
  md.push("");
  md.push(`- 断言总数：${summary.total}`);
  md.push(`- 通过：${summary.passed}`);
  md.push(`- 失败（HARD）：${summary.failed}`);
  md.push(`- 跳过（能力缺失）：${summary.skipped}`);
  md.push("");
  md.push("### 按层分类（parser / cleaner / profiler / expected / file-magic）");
  md.push("");
  md.push("| 层 | 通过 | 失败 |");
  md.push("| --- | --- | --- |");
  for (const [layer, v] of Object.entries(summary.byLayer)) {
    md.push(`| ${layer} | ${v.pass} | ${v.fail} |`);
  }
  md.push("");
  md.push("## 各 Fixture 结果");
  md.push("");
  for (const r of results) {
    const status = r.failedHard === 0 ? "✅ PASS" : `❌ FAIL(${r.failedHard})`;
    md.push(`### ${r.fixtureId} — ${status}`);
    md.push("");
    md.push(
      `- 文件类型：${r.fileKind} | Sheet 数：${r.sheetCount} | 有效列：${r.effectiveColumns} | 画像列数：${r.profileColumns}`,
    );
    md.push("");
    md.push("| 层 | 断言 | 结果 | 详情 |");
    md.push("| --- | --- | --- | --- |");
    for (const a of r.assertions) {
      const icon = a.severity === "skip" ? "⏭" : a.pass ? "✅" : a.severity === "warn" ? "⚠️" : "❌";
      md.push(`| ${a.layer} | ${a.name} | ${icon} | ${a.detail} |`);
    }
    md.push("");
  }

  md.push("## 失败项明细（HARD）");
  md.push("");
  if (failures.length === 0) {
    md.push("_无 HARD 失败项_");
  } else {
    md.push("| Fixture | 层 | 断言 | 详情 |");
    md.push("| --- | --- | --- | --- |");
    for (const f of failures) {
      md.push(`| ${f.fixture} | ${f.layer} | ${f.name} | ${f.detail} |`);
    }
  }
  md.push("");
  md.push("## T1 修复建议（按失败项归类）");
  md.push("");
  const suggestions = deriveSuggestions(failures);
  if (suggestions.length === 0) md.push("_无_");
  else for (const s of suggestions) md.push(`- ${s}`);
  md.push("");

  // 写文件
  mkdirSync(artifactsDir(), { recursive: true });
  writeFileSync(join(artifactsDir(), "latest.json"), JSON.stringify({ summary, results }, null, 2), "utf-8");
  writeFileSync(join(artifactsDir(), "latest.md"), md.join("\n"), "utf-8");

  // 控制台
  console.log("\n=== 表格金标基线验证 ===");
  console.log(`断言: ${summary.total} | 通过: ${summary.passed} | 失败(HARD): ${summary.failed} | 跳过: ${summary.skipped}`);
  for (const r of results) {
    const status = r.failedHard === 0 ? "PASS" : `FAIL(${r.failedHard})`;
    console.log(`  [${status}] ${r.fixtureId}  (有效列 ${r.effectiveColumns} / 画像列 ${r.profileColumns})`);
  }
  console.log(`\n报告: ${join(artifactsDir(), "latest.md")}`);

  if (summary.failed > 0) process.exit(1);
}

/** 由失败项推导 T1 修复建议（按代码/层归类） */
function deriveSuggestions(failures: { fixture: string; layer: string; name: string; detail: string }[]): string[] {
  const out: string[] = [];
  const has = (pred: (f: typeof failures[number]) => boolean) => failures.some(pred);

  if (has((f) => f.name.startsWith("画像列数") || f.name.startsWith("有效列数"))) {
    out.push(
      "FIX-GHOST-COLUMNS（P0）：cleaner/profileTable 未裁剪空列（column_N 垃圾列），脏表 profile 列数虚高到 ~200。需在 cleanSheet 表头识别后按有效非空列裁剪列集合。",
    );
  }
  if (has((f) => f.name.startsWith("表头行") && f.detail.includes("≠ 期望") && f.detail.includes("需确认"))) {
    out.push(
      "FIX-HEADER-OFFSET（P0）：表头不在首行时 detectHeaderRow 未正确识别偏移，需强化打分（说明行非空率低/含标点短语）或支持人工确认偏移量。",
    );
  }
  if (has((f) => f.name.startsWith("字段类型") && !f.detail.includes("date") === false)) {
    // 占位，下面按具体类型细化
  }
  if (has((f) => f.name.startsWith("字段类型") && f.detail.includes("actual date"))) {
    out.push(
      "FIX-DATE-TYPE（P1）：日期列被错误推断为其它类型（如 Excel 序列号未还原为 date），需确保 parser 的日期还原在 profiler 前完成且类型推断识别 ISO 日期串。",
    );
  }
  if (has((f) => f.name.startsWith("字段类型") && /actual (currency|integer|float)/.test(f.detail))) {
    out.push(
      "FIX-NUMERIC-TYPE（P1）：数值/货币列类型推断偏差（如含 ¥ 符号未识别为 currency），需强化 inferColumnType 对货币符号与千分位的处理。",
    );
  }
  if (has((f) => f.name.startsWith("字段类型") && f.detail.includes("actual text") && f.detail.includes("期望"))) {
    out.push(
      "FIX-CATEGORY-TYPE（P2）：分类/文本列类型偏差，需审视 uniqueRate 阈值与文本/分类边界。",
    );
  }
  if (has((f) => f.name.startsWith("推荐状态"))) {
    out.push(
      "FIX-SHEET-RECOMMENDER（P2）：系统缺少显式『核心分析 Sheet 推荐选择器』，当前用只读启发式近似；需实现基于命名/行数/列数的推荐器，并排除 Overview/Notes。",
    );
  }
  if (has((f) => f.name.startsWith("质量问题") && !f.detail.includes("✓"))) {
    out.push(
      "FIX-QUALITY-DETECTOR（P1）：质量问题（空值/重复/低库存/混合格式）需有显式检测器并输出质量报告，当前仅能从画像间接观测。",
    );
  }
  return Array.from(new Set(out));
}

main().catch((e) => {
  console.error("[validate-table-baseline] 失败:", e);
  process.exit(1);
});
