# 第二大脑 · 主功能流程审计

> 审计范围：记一笔 → organize → 确认(apply) → 笔记/策略/任务/提醒/复习原子写入 → 各消费面板（任务看板/策略/项目/代码片段/数据引擎）→ 复习/周报/复盘
> 方法：真实代码走读 + grep 铁证（file:line），非凭印象。基线状态：上一轮 data-engine 修复后 tsc 0 error、eslint 0 error。

## 一、结论先行

**引擎层（写入链路）极其健壮，核心链路可放心使用；但主流程收尾的「周复盘」环节断链**——后端 `/api/brain/weekly-review` 与 `/api/brain/weekly-review/plan` 完整实现，却没有任何前端调用点，导航栏也没有「复盘」Tab。第二大脑的「笔记→策略→任务→复盘」价值闭环止于「任务」，**缺「复盘→下一周计划」的收口**。这是本审计唯一的产品级缺陷（P1）。

其余为 P2/P3：死链端点潜在幽灵写入、`gotoNav` 外部链接映射错位、周报/周复盘语义重叠、复习术语分散。

---

## 二、主流程链路（实测可达性）

```
记一笔(capture) ──POST /api/brain/organize──▶ ProcessingPlan(pending_confirmation, 仅落 plan_json)
        │                                            │
        │  fillFromPlanBody() 填充可编辑表单          │ applyProcessingPlan() 原子写入
        ▼                                            ▼
  确认保存 ──POST /api/brain/plans(pending→applied)──▶ 笔记+策略+任务+提醒+复习 一次性落库
                                                        │（失败整体回滚，标记 failed+recovery）
        ┌───────────────────────────────────────────────┤
        ▼                ▼                ▼             ▼
   任务看板         策略 Tab         项目 Tab      代码片段/数据引擎
   (GET /tasks)   (GET /strategies) (GET /projects)  (各自消费)
        │
        ▼
   间隔复习(reviews) ──GET/POST /api/brain/reviews──▶ 有 UI ✓（dashboard/overview/learning-review-list）
   周报(report)    ──lib/brain-report.ts──▶ overview「本周周报」有 UI ✓
   周复盘(weekly-review) ──GET/POST /api/brain/weekly-review──▶ ❌ 无 UI、无入口
```

---

## 三、已验证健壮的部分（铁证，无需修）

| 能力 | 证据 | 结论 |
|---|---|---|
| 原子写入 + 回滚 | `lib/brain-plan.ts:443-619` applyProcessingPlan：任一步失败走 `fail()` 级联删提醒/笔记，标记 failed+recovery | 数据不丢，安全 |
| 重复确认护栏 | `lib/brain-plan.ts:449-452` 以库内最新 status==="applied" 拦截重复提交 | 连点/刷新恢复不重复产出 |
| 收件箱状态机闭合 | `markInboxProcessing`/`organizeInboxToPlan`/`syncInboxFromPlan`（`lib/brain-plan.ts:280-368`）pending→processing→pending_confirmation→converted/failed | 闭环完整 |
| 恢复/补偿/重试安全网 | `retryProcessingPlan`/`compensateProcessingPlan`/`markPlanHandled`/`cleanupProcessingPlans`（`lib/brain-plan.ts:732-852`） | 运维兜底齐全 |
| 三态降级无死胡同 | organize 失败→回传 body 进「直接保存」(`organize-save.ts`)→仍失败→草稿可手保存（`second-brain.tsx:850-880`） | 用户永不卡死 |
| 策略真实产出 | `lib/brain-organizer.ts:447` heuristicStrategies + AI 路径；落 `brain_strategies`（applyProcessingPlan:531-538）；策略 Tab 读 `GET /strategies` | 策略链路通 |
| 可观测降级 | `aiUsed`/`semantic` flag 贯穿 organizer/plan/report/ask/前端（`brain-organizer.ts:107`、`brain-plan.ts:206`、`ask.ts`、`overview-panel.tsx:266`） | LLM/embedding 静默降级可见 |

---

## 四、问题清单（按优先级）

### 🔴 P1 · 周复盘断链（核心缺陷）

- **现象**：`buildWeeklyReview`（`lib/brain-review.ts:119-364`）已完整实现——聚合本周 tasks/projects/strategies/plans/inbox/outcomes/relations，产出关键结果、里程碑风险、阻塞任务、陈旧收件箱等；配套 `GET/POST /api/brain/weekly-review`（`lib/api-handlers/brain/weekly-review.ts`）也已就绪。但：
  - 前端零调用：grep `weekly-review` 在 `components/**` 与 `app/**` 仅命中 `route.ts:56-57,123-124` 注册，**无任何组件 fetch 它**（已验证）。
  - 导航无入口：顶部 Tab 仅 `首页/记一笔/任务看板/项目/策略/代码片段/数据引擎`（`second-brain.tsx:1495-1502`），**没有「复盘」**。
- **影响**：主流程「笔记→策略→任务→**复盘**」最后一公里不可达；用户投入整周记录却无法在 UI 收口复盘，且 `buildNextWeekPlanBody`/`saveNextWeekPlan`（`lib/brain-review.ts:381+437`）这套「复盘→下一周计划」能力完全闲置。
- **修复方向**：在导航增加「复盘」Tab（或并入 overview），调用 `GET /api/brain/weekly-review` 渲染 `WeeklyReviewData`（关键结果/里程碑风险/阻塞/待处理收件箱），并提供「保存复盘」「生成下一周计划」按钮接 `POST /api/brain/weekly-review` 与 `weekly-review/plan`。

### 🟠 P2 · 死链端点 + 映射错位 + 语义重叠

1. **`weekly-review/plan` 死链 + 潜在幽灵写入**
   - `route.ts:123` 注册 `POST weekly-review/plan`（`m49` = `lib/api-handlers/brain/weekly-review/plan`，内部 `saveNextWeekPlan` 写 processing plan），但 grep 确认**前端零调用**。
   - 风险：该端点会真实写入 processing plan，若无人接 UI 是「幽灵写入」；建议要么接复盘 Tab 的「生成下一周计划」按钮，要么在确认前移除注册。

2. **`gotoNav` 外部链接映射错位**
   - `second-brain.tsx:727`：`tab=reviews` → `gotoTop("workbench","input")`（落到「记一笔」）。但「复习」UI 在 dashboard 的 `TodayReviews`/`learning-review-list`，无独立 tab。外部/提醒链接 `?tab=reviews` 会跳错位置。
   - 建议：补一个 `reviews` 落地（如展开 dashboard 复习区块），或纠正映射说明。

3. **周报 vs 周复盘 语义重叠**
   - overview 称「本周周报」（`overview-panel.tsx:265`，来自 `brain-report.ts` generateWeeklyReport）；而 `/api/brain/weekly-review` 是「周复盘」（`brain-review.ts`）。两者都在做「本周聚合」，用户易混淆。
   - 建议：明确分工——周报=本周成果摘要（轻）；复盘=成果+风险+阻塞+下周计划（重），并在 UI 文案上区分。

### 🟡 P3 · 体验/性能

1. **「复习」术语分散**：间隔复习(复习)入口散在 `dashboard/TodayAssistantPanel`、`overview-panel`、`learning-review-list` 三处，与「复盘」概念相邻易混。建议统一术语与入口。
2. **`weekly-review` GET 无缓存**：每次打开都 `buildWeeklyReview` 实时重算（多表聚合，`brain-review.ts:125-141`）。高频打开有成本（非阻塞，但建议加短 TTL 缓存或按需触发）。

---

## 五、修复建议（按序）

1. **P1**：新增「复盘」Tab/面板，接 `GET/POST /api/brain/weekly-review`，渲染 `WeeklyReviewData` + 提供保存/生成下周计划按钮（联动 `weekly-review/plan`）。
2. **P2-1**：把 `weekly-review/plan` 接入复盘面板的「生成下一周计划」；若暂不做则先移除注册避免幽灵写入。
3. **P2-2**：修正 `gotoNav` 对 `tab=reviews` 的落地。
4. **P2-3**：周报/周复盘 UI 文案与分工对齐。
5. **P3**：统一「复习」术语入口；`weekly-review` 加短缓存。

---

## 六、验证状态

- 代码铁证均来自真实 grep + Read（file:line 见上）。
- 上一轮基线：tsc 0 error、eslint 0 error（72 pre-existing warnings）。
- 本轮仅审计，**未改动、未提交**。待你确认修复范围后我再动手（按惯例「按顺序处理」或「开始修把」）。
