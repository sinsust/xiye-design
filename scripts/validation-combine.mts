/**
 * 组合引擎纯函数验证（P1 检测 / P2 执行）
 * 运行：esbuild scripts/validation-combine.mts --bundle --platform=node --format=esm \
 *       --resolve-extensions=.mts,.ts,.tsx,.js,.jsx,.json --outfile=scripts/.tmp-combine.mjs \
 *       && node scripts/.tmp-combine.mjs
 */
import { detectJoinKeys, buildJoinInputFromSheet } from "../lib/table/combine/detect-join-keys";
import { joinTables } from "../lib/table/combine/join-tables";
import type { FieldType, SheetInfo } from "../lib/table/types";

let passed = 0;
let failed = 0;
function ok(cond: boolean, msg: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error("  ✗ FAIL:", msg);
  }
}
function mockSheet(name: string, headers: string[], rows: unknown[][], types?: FieldType[]): SheetInfo {
  return {
    name,
    headers,
    rows,
    rowCount: rows.length,
    colCount: headers.length,
    ...(types ? { __types: types } : {}),
  } as SheetInfo;
}

console.log("— P1 detectJoinKeys —");

// 场景A：同名单列 + 完全重叠 → high
{
  const orders = mockSheet("orders", ["订单ID", "金额", "客户"], [["O1", 10, "C1"], ["O2", 20, "C2"], ["O3", 30, "C3"]]);
  const customers = mockSheet("customers", ["订单ID", "客户名", "地区"], [["O1", "张三", "华东"], ["O2", "李四", "华北"], ["O3", "王五", "华南"]]);
  const inputs = [
    buildJoinInputFromSheet(orders, "t1", ["id", "integer", "text"]),
    buildJoinInputFromSheet(customers, "t2", ["id", "text", "text"]),
  ];
  const sug = detectJoinKeys(inputs);
  ok(sug.length === 1, `场景A 应得1条建议，实际 ${sug.length}`);
  ok(sug[0]?.confidence === "high", "场景A 应为 high");
  ok(sug[0]?.matchRate === 1, `场景A matchRate 应为1，实际 ${sug[0]?.matchRate}`);
  ok(sug[0]?.keyColumnLeft === "订单ID" && sug[0]?.keyColumnRight === "订单ID", "场景A 连接键应为 订单ID");
  ok(sug[0]?.sameName === true, "场景A 应为同名");
}

// 场景B：不同名低重叠 → 无建议
{
  const a = mockSheet("a", ["客户"], [["C1"], ["C2"]], ["text"]);
  const b = mockSheet("b", ["产品"], [["P1"], ["P2"]], ["text"]);
  const sug = detectJoinKeys([buildJoinInputFromSheet(a, "t1", ["text"]), buildJoinInputFromSheet(b, "t2", ["text"])]);
  ok(sug.length === 0, `场景B 应无建议（Jaccard=0），实际 ${sug.length}`);
}

// 场景C：跨名同类型高重叠 → 仍 high（Jaccard 阈值优先）
{
  const a = mockSheet("a", ["user_id"], [["U1"], ["U2"], ["U3"]], ["id"]);
  const b = mockSheet("b", ["uid"], [["U1"], ["U2"], ["U3"]], ["id"]);
  const sug = detectJoinKeys([buildJoinInputFromSheet(a, "t1", ["id"]), buildJoinInputFromSheet(b, "t2", ["id"])]);
  ok(sug.length === 1, `场景C 应得1条，实际 ${sug.length}`);
  ok(sug[0]?.confidence === "high", "场景C 应为 high");
  ok(sug[0]?.sameName === false, "场景C 应跨名");
}

// 场景D：类型族不一致（numeric vs text）不组合
{
  const a = mockSheet("a", ["key"], [[1], [2], [3]], ["integer"]);
  const b = mockSheet("b", ["key"], [["1"], ["2"], ["3"]], ["text"]);
  const sug = detectJoinKeys([buildJoinInputFromSheet(a, "t1", ["integer"]), buildJoinInputFromSheet(b, "t2", ["text"])]);
  ok(sug.length === 0, `场景D 类型族不一致应无建议，实际 ${sug.length}`);
}

console.log("— P2 joinTables —");

// 场景E：left join 合并 + 列数正确
{
  const orders = mockSheet("orders", ["订单ID", "金额", "客户"], [["O1", 10, "C1"], ["O2", 20, "C2"], ["O3", 30, "C3"]]);
  const customers = mockSheet("customers", ["订单ID", "客户名", "地区"], [["O1", "张三", "华东"], ["O2", "李四", "华北"], ["O3", "王五", "华南"]]);
  const { sheet, warnings } = joinTables(orders, customers, "订单ID", "订单ID", { joinType: "left" });
  ok(sheet.rowCount === 3, `场景E left 行数应为3，实际 ${sheet.rowCount}`);
  ok(sheet.colCount === 5, `场景E 列数应为5，实际 ${sheet.colCount}`);
  ok(sheet.headers.join(",") === "订单ID,金额,客户,客户名,地区", `场景E headers=${sheet.headers.join(",")}`);
  ok(sheet.rows[0].join(",") === "O1,10,C1,张三,华东", `场景E 首行=${sheet.rows[0].join(",")}`);
  ok(warnings.length === 0, "场景E 应无警告");
}

// 场景F：列名冲突加前缀
{
  const left = mockSheet("L", ["ID", "名称"], [["K1", "a"]], ["id", "text"]);
  const right = mockSheet("R", ["ID", "名称"], [["K1", "x"]], ["id", "text"]);
  const { sheet } = joinTables(left, right, "ID", "ID", { joinType: "left", rightSheetAlias: "右表" });
  ok(sheet.headers.join(",") === "ID,名称,名称_右表", `场景F 冲突列应加前缀=${sheet.headers.join(",")}`);
}

// 场景G：一对多（右表键重复）→ 警告
{
  const left = mockSheet("L", ["K", "lv"], [["K1", "a"], ["K1", "b"]], ["id", "text"]);
  const right = mockSheet("R", ["K", "rv"], [["K1", "x"], ["K1", "y"]], ["id", "text"]);
  const { sheet, warnings } = joinTables(left, right, "K", "K", { joinType: "left" });
  ok(sheet.rowCount === 2, `场景G left 行数应为2，实际 ${sheet.rowCount}`);
  ok(warnings.some((w) => w.includes("一对多")), `场景G 应有一对多警告，实际 ${JSON.stringify(warnings)}`);
}

// 场景H：左表键无匹配（left join 补 null；inner 丢弃）
{
  const left = mockSheet("L", ["K", "lv"], [["K1", "a"], ["K9", "z"]], ["id", "text"]);
  const right = mockSheet("R", ["K", "rv"], [["K1", "x"]], ["id", "text"]);
  const leftJoin = joinTables(left, right, "K", "K", { joinType: "left" });
  ok(leftJoin.sheet.rowCount === 2, `场景H left 行数应为2（保留无匹配），实际 ${leftJoin.sheet.rowCount}`);
  ok(leftJoin.sheet.rows[1][2] === null, `场景H K9 右列应补 null，实际 ${leftJoin.sheet.rows[1][2]}`);
  const inner = joinTables(left, right, "K", "K", { joinType: "inner" });
  ok(inner.sheet.rowCount === 1, `场景H inner 行数应为1（丢弃无匹配），实际 ${inner.sheet.rowCount}`);
}

// 场景I：连接键不存在 → 抛错
{
  let threw = false;
  try {
    joinTables(mockSheet("L", ["K"], [["1"]], ["id"]), mockSheet("R", ["X"], [["1"]], ["id"]), "K", "Y");
  } catch {
    threw = true;
  }
  ok(threw, "场景I 连接键缺失应抛错");
}

console.log(`\n组合引擎验证：${passed} 通过, ${failed} 失败`);
if (failed > 0) process.exit(1);
