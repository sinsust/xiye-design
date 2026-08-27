/**
 * 表格金标样本 —— 确定性生成器（T0 支线）
 *
 * 运行：npm run generate:table-fixtures
 * 职责：
 *  - 把 8 个脱敏/程序生成的 Fixture 写到 data/table-fixtures/generated/（该目录被 .gitignore）
 *  - 数据完全确定性（无随机数、无真实业务数据）
 *  - 不访问网络、不改生产数据、不调用 LLM
 *  - 输出简短清单：文件名 / 行数 / 列数 / Sheet 名
 *
 * 设计点（对应 8 个 Fixture 的边界覆盖）：
 *  - 5×CSV：orders-basic / sku-inventory / logistics-delivery / ads-performance / customers-mixed
 *  - 3×XLSX：header-offset / multi-sheet-workbook / dirty-data-ghost-columns
 *
 * 透明性：CSV 用 papaparse 的 unparse 自动转义（含 ¥ 逗号的值会被正确加引号）；
 * XLSX 用 SheetJS 真实生成多 Sheet / 说明行 / 幽灵列(!ref 撑大到 200 列) / 重复列名 / 混合格式。
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import * as XLSX from "xlsx";

/* ── 路径解析（从 workspace 根运行；npm script 默认 cwd=根） ── */
function generatedDir(): string {
  // scripts/ 上一级即 workspace 根
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  return join(root, "data", "table-fixtures", "generated");
}

interface GenMeta {
  file: string;
  kind: "csv" | "xlsx";
  sheets: { name: string; rows: number; cols: number }[];
}

/* ─────────────── CSV 写入辅助 ─────────────── */
function writeCsv(dir: string, name: string, aoa: (string | number | null)[][]): GenMeta {
  // 第一行作为表头；papaparse 自动对含逗号/引号/换行的字段加引号
  const csv = Papa.unparse(aoa as unknown[][], { newline: "\n" });
  const file = join(dir, name);
  writeFileSync(file, csv, "utf-8");
  const dataRows = aoa.length - 1;
  const cols = aoa[0]?.length ?? 0;
  return { file, kind: "csv", sheets: [{ name: "Sheet1", rows: dataRows, cols }] };
}

/* ─────────────── XLSX 写入辅助 ─────────────── */
function writeXlsx(
  dir: string,
  name: string,
  sheets: { name: string; aoa: (string | number | null)[][] }[],
): GenMeta {
  const wb = XLSX.utils.book_new();
  const metas: GenMeta["sheets"] = [];
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.aoa as unknown[][]);
    XLSX.utils.book_append_sheet(wb, ws, s.name);
    metas.push({ name: s.name, rows: Math.max(0, s.aoa.length - 1), cols: s.aoa[0]?.length ?? 0 });
  }
  const file = join(dir, name);
  XLSX.writeFile(wb, file);
  return { file, kind: "xlsx", sheets: metas };
}

/* ════════════ Fixture 1: orders-basic (CSV) ════════════ */
function genOrdersBasic(dir: string): GenMeta {
  const aoa = [
    ["订单号", "下单日期", "SKU", "国家", "销售额", "运费", "退款状态"],
    ["ORD-1001", "2024-08-01", "SKU-A01", "US", "¥1,200.50", "¥15.00", "未退款"],
    ["ORD-1002", "2024-08-01", "SKU-A02", "CN", "¥899.00", "¥10.00", "未退款"],
    ["ORD-1003", "2024-08-02", "", "US", "¥2,450.00", "¥25.00", "未退款"], // 空 SKU
    ["ORD-1004", "2024-08-02", "SKU-A01", "CN", "¥1,200.50", "¥15.00", "已退款"],
    ["ORD-1001", "2024-08-03", "SKU-B03", "US", "¥560.00", "¥8.00", "未退款"], // 重复订单号
    ["ORD-1005", "2024-08-03", "SKU-B04", "DE", "¥3,200.00", "¥30.00", "已退款"],
    ["ORD-1006", "2024-08-04", "SKU-B05", "CN", "¥780.00", "¥12.00", "未退款"],
    ["ORD-1007", "2024-08-04", "SKU-C06", "UK", "¥1,050.00", "¥18.00", "未退款"],
    ["ORD-1008", "2024-08-05", "SKU-C07", "JP", "¥990.00", "¥20.00", "未退款"],
    ["ORD-1009", "2024-08-05", "SKU-C08", "US", "¥1,499.00", "¥15.00", "已退款"],
    ["ORD-1010", "2024-08-06", "SKU-D09", "CN", "¥620.00", "¥10.00", "未退款"],
  ];
  return writeCsv(dir, "orders-basic.csv", aoa);
}

/* ════════════ Fixture 2: sku-inventory (CSV) ════════════ */
function genSkuInventory(dir: string): GenMeta {
  const aoa = [
    ["SKU", "商品名称", "库存", "成本", "售价", "商品状态"],
    ["SKU-A01", "无线鼠标", "120", "¥35.50", "¥99.00", "在售"],
    ["SKU-A02", "机械键盘", "8", "¥120.00", "¥299.00", "在售"], // 低库存
    ["SKU-A03", "USB-C 线", "0", "¥5.00", "¥19.00", "缺货"], // 低库存 0
    ["SKU-A04", "显示器支架", "45", "¥60.00", "¥159.00", "在售"],
    ["SKU-A05", "蓝牙耳机", "60", "", "¥199.00", "在售"], // 缺失成本
    ["SKU-A06", "充电宝", "3", "¥45.00", "¥129.00", "在售"], // 低库存
    ["SKU-A07", "硬盘盒", "200", "¥25.00", "¥69.00", "下架"],
    ["SKU-A08", "理线器", "60", "¥8.00", "¥29.00", "在售"],
    ["SKU-A09", "网线", "150", "¥12.00", "¥39.00", "在售"],
    ["SKU-A10", "转接头", "5", "¥9.00", "¥25.00", "在售"], // 低库存
  ];
  return writeCsv(dir, "sku-inventory.csv", aoa);
}

/* ════════════ Fixture 3: logistics-delivery (CSV) ════════════ */
function genLogistics(dir: string): GenMeta {
  const aoa = [
    ["物流渠道", "国家", "发货日期", "签收日期", "费用", "物流状态"],
    ["FedEx", "US", "2024-08-01", "2024-08-05", "¥120.00", "已签收"],
    ["UPS", "CN", "2024-08-01", "2024-08-04", "¥45.00", "已签收"],
    ["DHL", "DE", "2024-08-02", "", "¥88.00", "运输中"], // 未签收
    ["SF", "CN", "2024-08-03", "2024-08-03", "¥20.00", "已签收"],
    ["EMS", "JP", "2024-08-02", "", "¥65.00", "运输中"], // 未签收
    ["FedEx", "UK", "2024-08-04", "2024-08-09", "¥150.00", "已签收"],
    ["UPS", "US", "2024-08-05", "", "¥50.00", "运输中"], // 未签收
    ["DHL", "CN", "2024-08-06", "2024-08-10", "", "已签收"], // 空费用
  ];
  return writeCsv(dir, "logistics-delivery.csv", aoa);
}

/* ════════════ Fixture 4: ads-performance (CSV) ════════════ */
function genAdsPerformance(dir: string): GenMeta {
  const aoa = [
    ["日期", "广告组", "消耗", "曝光", "点击", "转化", "收入"],
    ["2024-08-01", "品牌词", "¥320.00", "12000", "480", "32", "¥960.00"],
    ["2024-08-01", "竞品词", "¥450.00", "8900", "210", "12", "¥540.00"],
    ["2024-08-02", "品牌词", "¥310.00", "11500", "500", "35", "¥1020.00"],
    ["2024-08-02", "竞品词", "¥480.00", "9200", "190", "9", "¥430.00"],
    ["2024-08-03", "通用词", "¥600.00", "20000", "650", "40", "¥1500.00"],
    ["2024-08-03", "品牌词", "¥330.00", "12100", "520", "38", "¥1100.00"],
    ["2024-08-04", "通用词", "¥580.00", "19500", "610", "36", "¥1380.00"],
    ["2024-08-04", "竞品词", "¥470.00", "9000", "205", "11", "¥520.00"],
  ];
  return writeCsv(dir, "ads-performance.csv", aoa);
}

/* ════════════ Fixture 5: customers-mixed (CSV) ════════════ */
function genCustomers(dir: string): GenMeta {
  const aoa = [
    ["姓名", "邮箱", "标签", "注册日期"],
    ["张伟", "zhang.wei@example.test", "高价值", "2024-03-12"],
    ["John Smith", "john.smith@example.test", "普通", "2024-04-01"],
    ["李娜", "li.na@example.test", "新客", "2024-05-20"],
    ["Wang Fang", "wang.fang@example.test", "高价值", "2024-06-10"],
    ["陈强", "", "流失", "2024-02-15"], // 空邮箱
    ["张伟", "zhang.wei@example.test", "高价值", "2024-03-12"], // 重复邮箱
    ["刘洋", "liu.yang@example.test", "普通", "2024-07-08"],
    ["Emma Brown", "emma.brown@example.test", "新客", "2024-08-01"],
  ];
  return writeCsv(dir, "customers-mixed.csv", aoa);
}

/* ════════════ Fixture 6: header-offset (XLSX) ════════════ */
function genHeaderOffset(dir: string): GenMeta {
  const aoa = [
    ["销售月度报表（2024年8月）"], // 说明行 1
    ["数据来源：内部 ERP 系统"], // 说明行 2
    ["订单号", "日期", "金额", "地区"], // 真实表头在第 3 行（index 2）
    ["ORD-001", "2024-08-01", "¥1,200.00", "华东"],
    ["ORD-002", "2024-08-02", "¥890.00", "华北"],
    ["ORD-003", "2024-08-02", "¥2,050.00", "华南"],
    ["ORD-004", "2024-08-03", "¥760.00", "华东"],
    ["ORD-005", "2024-08-04", "¥1,500.00", "西南"],
    ["ORD-006", "2024-08-05", "¥980.00", "华北"],
  ];
  return writeXlsx(dir, "header-offset.xlsx", [{ name: "Sheet1", aoa }]);
}

/* ════════════ Fixture 7: multi-sheet-workbook (XLSX) ════════════ */
function genMultiSheet(dir: string): GenMeta {
  const overview = [
    ["指标", "数值"],
    ["总销售额", "100000"],
    ["订单数", "500"],
    ["客单价", "200"],
  ];
  const orders = [
    ["订单号", "日期", "SKU", "金额"],
    ["O-1", "2024-08-01", "SKU-A", "¥100.00"],
    ["O-2", "2024-08-02", "SKU-B", "¥250.00"],
    ["O-3", "2024-08-03", "SKU-C", "¥80.00"],
    ["O-4", "2024-08-04", "SKU-A", "¥120.00"],
    ["O-5", "2024-08-05", "SKU-D", "¥300.00"],
  ];
  const products = [
    ["SKU", "名称", "库存", "价格"],
    ["SKU-A", "鼠标", "120", "¥99.00"],
    ["SKU-B", "键盘", "8", "¥299.00"],
    ["SKU-C", "耳机", "60", "¥199.00"],
    ["SKU-D", "显示器", "15", "¥1299.00"],
  ];
  const notes = [
    ["说明", "内容"],
    ["备注", "本表为示例数据，不含任何真实客户信息"],
    ["版本", "v1.0-demo"],
  ];
  return writeXlsx(dir, "multi-sheet-workbook.xlsx", [
    { name: "Overview", aoa: overview },
    { name: "Orders", aoa: orders },
    { name: "Products", aoa: products },
    { name: "Notes", aoa: notes },
  ]);
}

/* ════════════ Fixture 8: dirty-data-ghost-columns (XLSX) ════════════
 * 覆盖：≥15 有效字段 / !ref 模拟 200 逻辑列（幽灵列）/ 空行 / 重复列名 / 混合日期与金额格式
 */
function genDirty(dir: string): GenMeta {
  // 16 个有效字段（第 15、16 列均为「备注」，故意重复列名）
  const headers = [
    "序号",
    "订单号",
    "客户",
    "国家",
    "省",
    "市",
    "产品",
    "类别",
    "数量",
    "单价",
    "金额",
    "下单日期",
    "发货日期",
    "物流商",
    "状态",
    "备注",
    "备注",
  ];
  const rows: (string | number | null)[][] = [
    [1, "D-001", "客户甲", "CN", "广东", "深圳", "鼠标", "电子", 2, "¥50.00", "¥100.00", "2024-08-01", "2024-08-03", "SF", "已发货", "急单", "加急"],
    [2, "D-002", "客户乙", "US", "CA", "LA", "键盘", "电子", 1, "¥200.00", "¥200.00", "2024-08-02", "2024-08-04", "FedEx", "已发货", "正常", "无"],
    // 空行（中间插入）
    [],
    [3, "D-003", "客户丙", "CN", "浙江", "杭州", "耳机", "电子", 5, "¥80.00", "¥400.00", "45320", "2024-08-05", "SF", "已发货", "正常", "批量"], // 下单日期为 Excel 序列号 45320（混合格式）
    [4, "D-004", "客户丁", "JP", "东京", "东京", "显示器", "电子", 1, 1200, 1200, "2024-08-03", "2024-08-06", "EMS", "已签收", "正常", "日本", "无"], // 金额/单价为纯数字（混合格式）
    [5, "D-005", "客户戊", "CN", "北京", "北京", "网线", "配件", 10, "¥12.00", "¥120.00", "2024-08-04", "2024-08-07", "SF", "已发货", "正常", "无", "无"],
    [6, "D-006", "客户己", "DE", "柏林", "柏林", "转接头", "配件", 3, "¥9.00", "¥27.00", "45324", "2024-08-08", "DHL", "运输中", "正常", "欧洲", "无"], // 序列号 45324
    [7, "D-007", "客户庚", "CN", "上海", "上海", "硬盘盒", "配件", 4, "¥25.00", "¥100.00", "2024-08-05", "2024-08-09", "SF", "已签收", "正常", "无", "无"],
  ];
  const aoa = [headers, ...rows];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa as unknown[][]);
  // 模拟 Excel 模板残留：把 !ref 撑大到 200 逻辑列（GR 列），但 17 列之后无真实单元格
  const range = XLSX.utils.decode_range(ws["!ref"] as string);
  range.e.c = 199; // 第 200 列
  ws["!ref"] = XLSX.utils.encode_range(range);
  XLSX.utils.book_append_sheet(wb, ws, "DirtyData");

  const file = join(dir, "dirty-data-ghost-columns.xlsx");
  XLSX.writeFile(wb, file);
  return {
    file,
    kind: "xlsx",
    sheets: [{ name: "DirtyData", rows: aoa.length - 1, cols: headers.length }],
  };
}

/* ─────────────── 主流程 ─────────────── */
export async function generateAll(): Promise<GenMeta[]> {
  const dir = generatedDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const metas: GenMeta[] = [
    genOrdersBasic(dir),
    genSkuInventory(dir),
    genLogistics(dir),
    genAdsPerformance(dir),
    genCustomers(dir),
    genHeaderOffset(dir),
    genMultiSheet(dir),
    genDirty(dir),
  ];
  return metas;
}

/** 打印生成清单 */
export function printSummary(metas: GenMeta[]): void {
  console.log("\n=== 表格金标 Fixture 生成清单 ===");
  for (const m of metas) {
    const sheetInfo = m.sheets
      .map((s) => `${s.name}(${s.rows}行×${s.cols}列)`)
      .join(" | ");
    console.log(`  [${m.kind.toUpperCase()}] ${m.file.split(/[\\/]/).pop()} → ${sheetInfo}`);
  }
  console.log(`\n输出目录: ${generatedDir()}`);
  console.log("（generated/ 已被 .gitignore 忽略；expected/ 与生成器脚本已纳入版本控制）\n");
}

/* 仅作为 generate 入口直接运行时执行（被 validate import 时不触发，避免双重生成副作用） */
const ARG = process.argv[1] || "";
const isGenerateEntry = ARG.includes("generate-table-fixtures") || ARG.endsWith(".tmp-gentf.mjs");
if (isGenerateEntry) {
  generateAll()
    .then(printSummary)
    .catch((err) => {
      console.error("[generate-table-fixtures] 失败:", err);
      process.exit(1);
    });
}
