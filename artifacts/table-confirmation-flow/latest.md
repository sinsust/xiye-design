# T1-D2 Sheet 推荐与表头确认「前端确认流」验证报告

生成时间：2026-08-27T04:30:25.242Z

## 汇总
- 断言总数：67
- 通过：67
- 失败（HARD）：0
- 失败（WARN）：0

## 断言明细

### ads-performance — ✅ PASS

| 层 | 断言 | 结果 | 详情 |
| --- | --- | --- | --- |
| recommender | 推荐标记[Sheet1] | ✅ | recommended=true |
| recommender | 角色[Sheet1] | ✅ | role=primary_data |
| flow | 默认可进入画像[Sheet1] | ✅ | phase=profile |

### customers-mixed — ✅ PASS

| 层 | 断言 | 结果 | 详情 |
| --- | --- | --- | --- |
| recommender | 推荐标记[Sheet1] | ✅ | recommended=true |
| recommender | 角色[Sheet1] | ✅ | role=primary_data |
| flow | 默认可进入画像[Sheet1] | ✅ | phase=profile |

### dirty-data-ghost-columns — ✅ PASS

| 层 | 断言 | 结果 | 详情 |
| --- | --- | --- | --- |
| recommender | 推荐标记[DirtyData] | ✅ | recommended=true |
| recommender | 角色[DirtyData] | ✅ | role=primary_data |
| flow | 默认可进入画像[DirtyData] | ✅ | phase=profile |

### header-offset — ✅ PASS

| 层 | 断言 | 结果 | 详情 |
| --- | --- | --- | --- |
| recommender | 推荐标记[Sheet1] | ✅ | recommended=true |
| recommender | 角色[Sheet1] | ✅ | role=primary_data |
| recommender | 需确认表头[Sheet1] | ✅ | requires=true |
| recommender | 理由可解释[Sheet1] | ✅ | 含关键词 |
| flow | 需经表头确认[Sheet1] | ✅ | phase=confirm_header |

### logistics-delivery — ✅ PASS

| 层 | 断言 | 结果 | 详情 |
| --- | --- | --- | --- |
| recommender | 推荐标记[Sheet1] | ✅ | recommended=true |
| recommender | 角色[Sheet1] | ✅ | role=primary_data |
| flow | 默认可进入画像[Sheet1] | ✅ | phase=profile |

### multi-sheet-workbook — ✅ PASS

| 层 | 断言 | 结果 | 详情 |
| --- | --- | --- | --- |
| recommender | 推荐标记[Overview] | ✅ | recommended=false |
| recommender | 角色[Overview] | ✅ | role=summary |
| flow | 需经表头确认[Overview] | ✅ | phase=confirm_header |
| flow | 风险提示标签[Overview] | ✅ | tag=不建议作为主分析表（汇总表） |
| flow | 仍可手动选择[Overview] | ✅ | analyzable=true |
| recommender | 推荐标记[Orders] | ✅ | recommended=true |
| recommender | 角色[Orders] | ✅ | role=primary_data |
| flow | 默认可进入画像[Orders] | ✅ | phase=profile |
| recommender | 推荐标记[Products] | ✅ | recommended=true |
| recommender | 角色[Products] | ✅ | role=primary_data |
| flow | 默认可进入画像[Products] | ✅ | phase=profile |
| recommender | 推荐标记[Notes] | ✅ | recommended=false |
| recommender | 角色[Notes] | ✅ | role=notes |
| flow | 需经表头确认[Notes] | ✅ | phase=confirm_header |
| flow | 风险提示标签[Notes] | ✅ | tag=不建议作为主分析表（备注表） |
| flow | 仍可手动选择[Notes] | ✅ | analyzable=true |

### orders-basic — ✅ PASS

| 层 | 断言 | 结果 | 详情 |
| --- | --- | --- | --- |
| recommender | 推荐标记[Sheet1] | ✅ | recommended=true |
| recommender | 角色[Sheet1] | ✅ | role=primary_data |
| flow | 默认可进入画像[Sheet1] | ✅ | phase=profile |

### sku-inventory — ✅ PASS

| 层 | 断言 | 结果 | 详情 |
| --- | --- | --- | --- |
| recommender | 推荐标记[Sheet1] | ✅ | recommended=true |
| recommender | 角色[Sheet1] | ✅ | role=primary_data |
| flow | 默认可进入画像[Sheet1] | ✅ | phase=profile |

### header-offset-confirm-row3 — ✅ PASS

| 层 | 断言 | 结果 | 详情 |
| --- | --- | --- | --- |
| flow | 未确认→必须确认表头 | ✅ | phase=confirm_header |
| flow | 默认需确认表头=true | ✅ | requires=true |
| flow | 确认后检测表头行=2 | ✅ | detectedHeaderRow=2 |
| flow | 确认后表头正确 | ✅ | headers=["订单号","日期","金额","地区"] |
| flow | 确认后有效行数=6 | ✅ | effectiveRowCount=6 |
| flow | 确认后有效列数=4 | ✅ | effectiveColumnCount=4 |
| flow | 确认后画像列数=4 | ✅ | cols=4 |
| flow | 确认后首列名为订单号 | ✅ | col0=订单号 |
| flow | 确认后角色=primary_data | ✅ | role=primary_data |
| flow | 确认后仍被推荐 | ✅ | recommended=true |
| flow | 改表头后画像重生成(不同于错误表头) | ✅ | wrongCols=["销售月度报表（2024年8月）"] vs confirmedCols=["订单号","日期","金额","地区"] |
| flow | 表头候选含第3行 | ✅ | candidates=2,3,4,5,6,7,8 |
| flow | 第3行候选列名正确 | ✅ | names=["订单号","日期","金额","地区"] |

### multi-sheet-no-merge — ✅ PASS

| 层 | 断言 | 结果 | 详情 |
| --- | --- | --- | --- |
| flow | 不自动合并(N→N) | ✅ | 输入 4 → 产出 4 |
| flow | sheetId 一一对应 | ✅ | every rec maps to a sheet |

### session-isolation — ✅ PASS

| 层 | 断言 | 结果 | 详情 |
| --- | --- | --- | --- |
| isolation | 本人可读缓存 | ✅ | u1 命中 |
| isolation | 他人不可读缓存 | ✅ | u2 返回 null |
| isolation | 本人写入确认态 | ✅ | save=true |
| isolation | 本人可读确认态 | ✅ | confirmation 非空 |
| isolation | 他人不可读确认态 | ✅ | u2 返回 null |
| isolation | 未知 tableId→null(恢复重传) | ✅ | 未知 id 返回 null |
| isolation | 未知 tableId 原始Sheet→null | ✅ | 未知 id 返回 null |
| isolation | 无 rawSheet 时 getRawSheet→null | ✅ | 未存 rawSheet 返回 null |

### switch-invalidation-rule — ✅ PASS

| 层 | 断言 | 结果 | 详情 |
| --- | --- | --- | --- |
| flow | 选 Orders→profile | ✅ | phase=profile |
| flow | 切到 Notes→confirm_header(旧分析结果应清除) | ✅ | phase=confirm_header |
| flow | 角色文案映射-主数据 | ✅ | label=主数据 |
| flow | 角色文案映射-备注 | ✅ | label=备注 |
| flow | 字段类型摘要非空 | ✅ | summary=日期 ×1 · 数值/金额 ×1 · 编号 ×1 |
