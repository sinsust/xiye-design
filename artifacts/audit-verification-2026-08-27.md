# xiye 产品审计报告 — 独立复验结论（2026-08-27）

> 复验人：AI 协同（按 xiye 铁律「不接二手结论，先查实际代码再下结论」）。
> 方法：对用户贴出的四域审计发现，亲自读码复验，标注 file:line 证据。未本趟逐条读码的项标注「待复核」，不假装确认。

## 一、复验结论总表

| 编号 | 发现（摘要） | 复验 | 证据 |
|---|---|---|---|
| **C1** | 幽灵列/空行裁剪未接进产品链路，baseline「全绿」是测错路径 | ✅ 确认 | `app/api/brain/table/upload/route.ts:70-73` 仅 `cleanSheet`；`:102` 用 `profileTable`（旧入口）；全仓 `buildEffectiveDataset` 仅被 `scripts/validation-table-baseline.mts:360` + `validation-table-sheet-recommendation.mts:175/319` 调用（grep 确认无其他调用方）；裁剪逻辑只在 `lib/table/cleaner.ts:609-699`（`buildEffectiveDataset`）。 |
| **C2** | 本地 SQLite 自举漏建 `users`/`projects`/`agent_settings`，全新环境直接崩 | ✅ 确认（且比报告更严重） | `lib/db/index.ts:108` `foreign_keys=ON` 先于全部建表；`:196/209/228/249/252` 带 `references users(id)`；bootstrap 28 张表无 `users`/`projects`/`agent_settings`（grep 仅 `brain_projects`）；`schema.ts:7/15` 声明 `users`/`projects`。→ 全新 DB 在首个 FK 表（`brain_ima_sync_log:185`）CREATE 即 abort，非仅注册插入失败。 |
| **H1** | 任务评论 GET 越权读他人评论（IDOR） | ✅ 确认（P0） | `app/api/brain/tasks/[id]/comments/route.ts:12` GET 调 `listBrainTaskComments(user.sub, id)`；`lib/brain-db.ts:809-815` WHERE 仅 `eq(taskId)`，参数 `userId` 未使用；POST `:24` 正确 `getBrainTaskById(user.sub, id)` 校验归属。 |
| **H7** | 前导零数字码静默转数字（"001"→1） | ✅ 确认 | `lib/table/cleaner.ts:56-65` `cleanCellValue`→`parseNumericString(:115)` `Number(t)`；列推断为 integer 后 "001"→1，SKU/门店编码/固话被改坏。 |
| **H8** | 大整数静默丢精度（"123456789012345678"→…680） | ✅ 确认 | `cleaner.ts:115` `Number(t)`，超 `2^53` 安全整数即舍入。 |
| **H9** | 纯 Excel 序列号日期列永远推断为 integer，不归一化 | ✅ 确认 | `cleaner.ts:379` 序列号不匹配 `DATE_SURFACE_RE`→`dateRatio=0`；`:442` `numericRatio=1`→integer 分支；`45320` 不转 `2024-01-29`。 |
| **H10/H11** | 质量信号仅 3 种结构性，业务级（MIXED_CURRENCY/LOW_STOCK/DUPLICATE/50%空等）检测不到 | ✅ 确认 | `lib/table/quality.ts:41/54/103` 仅 `EMPTY_ROWS_SKIPPABLE`/`GHOST_COLUMNS_PRESENT`/`MIXED_DATE_FORMAT`；无业务级信号。 |
| **H12** | Supabase migrations 落后 schema.pg.ts | ✅ 确认 | migrations 7 文件共 ~14 条 `create table`；`schema.pg.ts` 31 个 `pgTable`；`brain_notifications`/`brain_learning_reviews`/`brain_proactive_actions` 在 schema.pg 声明但 migrations grep 零命中。 |
| **根 middleware** | `updateSession` 定义了但未注册 | ✅ 确认 | Glob 仅 `lib/supabase/middleware.ts`，**无根 `middleware.ts`** → Next 不加载，会话自动刷新/重定向从未生效。 |
| H2–H6 | 通知去重非原子/snooze 只写不读/提醒循环/轮询全表扫描 | ⚠️ 待复核（用户标 ✅） | 本趟未读 `lib/brain-notification.ts` / `brain-db.ts` 相关段。 |
| H13/H14 | git 垃圾文件 / validate 脚本未入库 | ⚠️ 待复核 | 本趟未查 `.gitignore` 与文件清单。 |
| Medium/Low 余项 | 账户枚举/限流信任 x-forwarded-for/笔记访问无 userId/弱随机 ID/AUTH_SECRET 未引/MIXED_DATE_FORMAT 误报/xlsx CVE/包管理器混用/app/flow 死代码 | ⚠️ 待复核 | 本趟未逐条读码。 |

## 二、与 T1-D1 的关系（重要）

- **C1 直接稀释了我刚交付的 T1-D1「验收全绿」的价值**：baseline 验证脚本走 `buildEffectiveDataset`（含裁剪），但**产品上传链路不走它**。所以 T1-A/T1-C 的裁剪能力虽通过验证却从未上线，baseline 的 PASS 是「测错路径」。
- 这**不改变 T1-D1 自身正确性**（sheet-recommender 逻辑独立正确，新增类型/脚本均通过 tsc/lint/build），但暴露了**验证脚本与产品链路脱节**的架构债。
- C1 的修法（upload 改用 `buildEffectiveDataset`+`profileEffectiveDataset`）会**顺带让 T1-D1 的 Sheet 推荐能力也真正接入产品**——目前 `recommendSheet` 同样只在验证脚本里跑，前端 `SheetSelector` 也未消费。

## 三、两个 Critical 的修复提案（plan-first，未实施）

### C1 — 让「被验证的链路」=「产品跑的链路」
`app/api/brain/table/upload/route.ts`：
1. `analyzeGroup` 入参由 `(headers, rows, columnTypes)` 改为接收 `EffectiveDataset ds`，内部用 `ds.headers / ds.rows / ds.columns`（`columns` 即 `FieldType[]`）。
2. 三处数据来源（同结构合并组 / 独立 sheet / 兜底分支）统一先 `buildEffectiveDataset(sheet)`，再 `profileEffectiveDataset(ds)`。
3. 响应 `results[].rows` 预览取 `ds.rows.slice(0, PREVIEW_ROWS)`；`cacheTable` 存裁剪后的 `ds.rows`（正确，避免脏列进分析）。
4. 不改动 `cleaner.ts` / `profiler.ts` 内部逻辑（符合约束）。
- 风险：裁剪后列数变化，前端若按旧 `headers` 下标索引需同步；建议回归 `SheetSelector` 与 analyze 链路。
- 收益：改后产品链路 = 验证脚本链路，baseline 绿才真实；T1-D1 推荐一并上线。

### C2 — 补自举建表，且父表先于 FK 子表
`lib/db/index.ts` bootstrap（在 `knowledge_entries:110` 之后、首个带 `references users(id)` 的 `brain_ima_sync_log:185` 之前）补：
1. `users`（字段对齐 `schema.ts:7`，含 `id` 主键）。
2. `projects`（对齐 `schema.ts:15`）。
3. `agent_settings`：仅在 sqlite 端确实用到时才建；若仅 Postgres 用，则可省略（需确认 `lib/db` 是否有 sqlite 路径引用它）。
- 最简稳方案：确保 `users` 在任意 `references users(id)` 表之前创建（FK pragma 开启时父表必须存在，否则 CREATE 失败）。
- 收益：删库重来 / 新克隆环境 DB 层不再启动即崩。

## 四、下一步（需你拍板，按「不代 commit」铁律，先方案后动手）

1. **是否现在修 C1 + C2**（两个 Critical，建议最高优先级）？我出 surgical 方案后实施。
2. **H1（P0 安全）是否一并修**？`listBrainTaskComments` 加 `userId` 过滤（WHERE 加 `eq(userId, userId)`）。
3. **H7–H9（清洗数据损坏）是否纳入本轮**？涉及 `cleaner.ts` 数值/日期策略，需小心不破坏正常数字（建议：超 15 位有效数字保留字符串 + 质量告警；前导零码识别为 text；序列号区间计入日期候选）。
4. **H2–H6 / H13 / H14 / Medium 余项**要不要我接着逐条复验并给修法？

所有改动均先出方案、你确认后再动；不擅自提交、不扩大范围。
