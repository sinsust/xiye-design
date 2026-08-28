# T1-D3 字段确认与数据质量前台化验证报告

生成时间：2026-08-28T01:19:46.935Z

## 汇总
- 断言总数：36
- 通过：36
- 失败（HARD）：0
- 失败（WARN）：0

## 断言明细

### orders-basic-direct-confirmable — ✅ PASS

| 层 | 断言 | 结果 | 详情 |
| --- | --- | --- | --- |
| profile | 高置信字段存在 | ✅ | 高置信字段数=6 |
| flow | 高置信订单表可直接确认(不阻断) | ✅ | blocked=false reasons=0 |
| flow | 低置信字段不含未确认关键字段 | ✅ | 低置信=1 低置信关键=0 |

### low-confidence-text-fallback — ✅ PASS

| 层 | 断言 | 结果 | 详情 |
| --- | --- | --- | --- |
| profile | 低置信字段被识别(置信<0.6) | ✅ | 低置信数=2 |
| profile | 唯一型低置信字段=关键字段 | ✅ | 备注列唯一 |
| flow | 未确认时唯一低置信关键字段阻断主按钮 | ✅ | blocked=true |
| flow | 提供覆盖后解除阻断 | ✅ | blocked=false |

### override-reprofile — ✅ PASS

| 层 | 断言 | 结果 | 详情 |
| --- | --- | --- | --- |
| reprofile | 覆盖类型被采用 | ✅ | type=category |
| reprofile | 展示名重命名生效 | ✅ | name=水果名 |
| reprofile | originalName 保留溯源 | ✅ | originalName=名称 |
| reprofile | 未覆盖列类型不变 | ✅ | 代码列type=id |
| reprofile | 确认列集合过滤生效 | ✅ | headers=["名称"] |
| reprofile | 过滤后 originalName 仍溯源 | ✅ | originalName=名称 |

### override-validation — ✅ PASS

| 层 | 断言 | 结果 | 详情 |
| --- | --- | --- | --- |
| validation | 越界列下标→invalid_column | ✅ | errorCode=invalid_column |
| validation | 非法类型→invalid_override | ✅ | errorCode=invalid_override |
| validation | 空展示名→invalid_override | ✅ | errorCode=invalid_override |
| validation | 含非法字符展示名→invalid_override | ✅ | errorCode=invalid_override |
| validation | 越界确认列→invalid_column | ✅ | errorCode=invalid_column |
| validation | 合法覆盖项通过 | ✅ | ok=true |

### session-isolation-override — ✅ PASS

| 层 | 断言 | 结果 | 详情 |
| --- | --- | --- | --- |
| isolation | 本人可读缓存 | ✅ | u1 命中 |
| isolation | 他人不可读缓存 | ✅ | u2 返回 null |
| isolation | 覆盖后缓存更新成功 | ✅ | update=true |
| isolation | 下游读取采用覆盖类型 | ✅ | 下游columnTypes=["id","category"] |
| isolation | 下游表头随覆盖更新 | ✅ | 下游headers=["代码","名称"] |

### override-clears-downstream — ✅ PASS

| 层 | 断言 | 结果 | 详情 |
| --- | --- | --- | --- |
| downstream | 覆盖刷新画像类型 | ✅ | before=["integer","text","text"] after=["category","text"] |
| downstream | 列过滤生效(C被排除) | ✅ | headers=["A","B"] |

### quality-frontendization — ✅ PASS

| 层 | 断言 | 结果 | 详情 |
| --- | --- | --- | --- |
| quality | 高置信画像无低置信关键字段 | ✅ | 低置信关键=0 |
| quality | 空行/幽灵列不阻断 | ✅ | blocked=false |
| quality | EMPTY_ROWS→auto_handled 分组 | ✅ | group=auto_handled |
| quality | GHOST_COLUMNS→auto_handled 分组 | ✅ | group=auto_handled |
| quality | MIXED_DATE_FORMAT→attention 分组 | ✅ | group=attention |
| quality | 混合日期不阻断 | ✅ | blocked=false |
| quality | 分组归类正确 | ✅ | auto=2 att=1 adv=0 |
| quality | 覆盖不改写原始行值 | ✅ | orig=["2024-01-01","2024-02-01","2024-03-01","2024-01-29","2024-04-01"] new=["2024-01-01","2024-02-01","2024-03-01","2024-01-29","2024-04-01"] |

### session-expiry-recovery — ✅ PASS

| 层 | 断言 | 结果 | 详情 |
| --- | --- | --- | --- |
| recovery | 未知 tableId→缓存null(重传) | ✅ | 未知 id 返回 null |
| recovery | 未知 tableId→rawSheet null(重传) | ✅ | 未知 id 返回 null |
