# 表格金标样本（Table Gold Fixtures）— T0 支线

本目录是「表格分析工作台」的 **T0：表格金标样本 + 确定性解析基线** 支线资产。

## 目标

- 建立 8 个**脱敏 / 程序生成**的金标 Fixture，每个附带 expected contract（金标，不迁就现状）。
- 建立**确定性**解析 / 清洗 / 画像验证脚本，仅走 `file-magic → parser → cleaner → profiler`，**不调用 LLM / 网络 / API / 生产库**。
- 输出基线报告，明确 T1 的真实修复优先级。

## 边界（本阶段不做什么）

- ❌ 不修改现有 parser / cleaner / profiler / analysis / LLM / 表格 UI / API 的业务逻辑。
- ❌ 不新增数据库表、前端功能或外部 SaaS 依赖。
- ❌ 不调用 LLM、网络接口、用户真实账号或真实业务数据。
- ❌ 不写入生产库；仅使用内存、临时文件或独立测试目录。

## 目录结构

```
data/table-fixtures/
  README.md                 # 本文件
  expected/                # ✅ 纳入 Git
    contract.ts            # Expected Contract 的 zod 类型 / TS 类型（金标 schema）
    orders-basic.json
    sku-inventory.json
    logistics-delivery.json
    ads-performance.json
    customers-mixed.json
    header-offset.json
    multi-sheet-workbook.json
    dirty-data-ghost-columns.json
  generated/               # ⛔ 被 .gitignore 忽略（二进制 CSV/XLSX，CI 自动重新生成）
scripts/
  generate-table-fixtures.mts   # ✅ 纳入 Git：确定性生成器
  validation-table-baseline.mts # ✅ 纳入 Git：确定性基线验证
artifacts/
  table-baseline/          # ⛔ 被 .gitignore 忽略：latest.json / latest.md 报告
```

## 8 个 Fixture 与覆盖问题

| # | Fixture | 格式 | 业务场景 | 覆盖的关键问题 |
|---|---------|------|----------|----------------|
| 1 | orders-basic | CSV | 订单明细 | 货币符号（¥ 含千分位）/ 空 SKU / 重复订单号 / 退款状态分类 |
| 2 | sku-inventory | CSV | SKU 库存 | 数值与文本混合 / 缺失成本 / 低库存识别 |
| 3 | logistics-delivery | CSV | 物流交付 | 未签收（空签收日期）/ 收发日期差 / 空费用 |
| 4 | ads-performance | CSV | 广告效果 | CTR / CPA / ROAS 派生字段（曝光/点击/转化/消耗/收入） |
| 5 | customers-mixed | CSV | 客户（中英混合） | 空邮箱 / 重复邮箱 / 全部使用 `example.test` 不可投递域名 |
| 6 | header-offset | XLSX | 表头偏移 | 前两行为说明文字，真实表头在第 3 行（index 2），验证表头识别或确认 |
| 7 | multi-sheet-workbook | XLSX | 多 Sheet | Overview/Orders/Products/Notes；Orders 与 Products 不静默合并；Overview/Notes 不推荐 |
| 8 | dirty-data-ghost-columns | XLSX | 脏数据 | ≥15 有效字段 / !ref 模拟 200 逻辑列（幽灵列）/ 空行 / 重复列名 / 混合日期与金额格式 |

## Expected Contract 字段说明

每份 `<fixtureId>.json` 至少包含：

- `fixtureId` / `purpose` / `fileKind`（csv | xlsx）
- `tolerance`：`{ effectiveRows, effectiveColumns }` 允许的实际值与期望值行列容差（默认 0 严格）
- `expectedSheets[]`：`name` / `recommended` / `expectedHeaderRow`（0 起表头行索引）/ `expectedEffectiveRows` / `expectedEffectiveColumns`
  - 可选 `headerConfirmationRequired` / `lowConfidenceAllowed`（无法完全自动识别时显式声明，并在 `note` 说明原因）
- `expectedColumns[]`：`displayName` / `normalizedName` / `expectedType`（见 `FieldType`）/ `required`
- `expectedQualityIssues[]`：`code` / `field`（可 null）/ `minimumAffectedRows`（问题需被数据支撑的最小行数）
- `expectedWarnings?` / `analysisSmokeCases?`（仅声明预期，不执行 LLM）

> **金标纪律**：Expected Contract 是正确性的唯一标准，不得为让测试通过而降低断言要求；也不得为让测试通过而修改 parser/cleaner/profiler 业务逻辑（T1 才修功能）。

## 运行

```bash
# 1) 生成 Fixture（确定性，写到 data/table-fixtures/generated/，二进制被 gitignore）
npm run generate:table-fixtures

# 2) 运行确定性基线验证（自动先生成，再走 file-magic→parser→cleaner→profiler）
npm run validate:table-baseline

# 3) 类型检查 / lint / 构建（验收）
npx tsc --noEmit
npm run lint
npm run build
```

验证产物：`artifacts/table-baseline/latest.json`（结构化）+ `latest.md`（可读报告，按 parser/cleaner/profiler/expected 分层，附 T1 修复建议）。

退出码：任一 HARD 断言失败 → 非 0（基线初次运行允许存在失败，用于暴露 T1 修复点）。

## 数据安全

- 所有 Fixture 均为**程序生成**或**脱敏构造**，**不含任何真实订单、客户、邮箱、手机号、地址、店铺名、API Key**。
- `customers-mixed` 的邮箱统一使用 `example.test` 不可投递域名（RFC 2606 保留测试域），无法真实投递。
- 生成器不读取任何生产数据、不访问网络、不调用 LLM。

## CI 复现

`generated/` 与 `artifacts/` 均被 gitignore；CI 只需执行 `npm run generate:table-fixtures && npm run validate:table-baseline`，由生成器与验证脚本在本地/CI 完全相同的确定性逻辑重建全部产物。
