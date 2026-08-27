# F2-A 交付报告 · 方案结构化：从产品创意到 ProductBlueprint

日期：2026-08-27
范围：仅 F2-A。不重构 F1-A、不回退为表单驱动、不修改第二大脑/通知/表格/LLM 路由与模型配置、不引入大型依赖。

---

## 一、改动文件

### 新增
| 文件 | 作用 |
|---|---|
| `lib/flow-blueprint.ts` | F2-A 领域模型与全部纯函数：类型、证据三分类、完成度、从 Brief 构建首版、局部编辑、决策暂缓、确认、恢复、重建 reconcile。client/server/离线脚本共用。 |
| `lib/ai-blueprint-server.ts` | 服务端 `buildBlueprint(concept)`：由已确认的 F1-A Brief 确定性生成首版蓝图（无 LLM 依赖、幂等）；只被 API 路由引用，不进客户端 bundle。 |
| `app/api/ai/blueprint/route.ts` | Blueprint 受控操作端点：GET 获取、POST 初始化/局部更新/确认/重建、PUT 恢复。按 userId+projectId 隔离、flow-op 台账幂等、F0-A 错误协议。 |
| `app/workflow/components/blueprint-panel.tsx` | 顶层状态条 + 蓝图抽屉（摘要 + 完整 section + 局部编辑/暂缓/接受/重建/恢复）。 |
| `app/workflow/components/blueprint-sync.ts` | 客户端状态同步层（初始化/局部编辑/暂缓/确认/重建/恢复），失败保留最近有效蓝图。 |
| `scripts/validation-flow-f2a.mts` | F2-A 离线验证脚本（12 组断言，49 断言）。 |

### 修改
| 文件 | 改动 |
|---|---|
| `lib/store/flow-store.ts` | 新增 `blueprint` 状态 + `setBlueprint`，纳入快照与 `partialize` 持久化；沿用 localStorage 节流写盘。 |
| `app/workflow/components/collab-stage.tsx` | F1-A `canProceed` 后接入 Blueprint 生命周期（自动初始化/读取、局部编辑、确认、重建、恢复）并渲染状态条。 |
| `package.json` | 注册 `validate:flow-f2a`。 |

未改动：`lib/flow-concept.ts`（F1-A 语义保持）、第二大脑/通知/表格/LLM 路由与模型配置、无新增大型依赖。

---

## 二、ProductBlueprint 数据契约

每个业务 section 都携带三要素：**内容本体 + `evidence`（证据分类）+ `source`（可追溯出处）**。

```ts
type BlueprintStatus  = "draft" | "reviewing" | "confirmed";
type BlueprintAcceptance = "accepted" | "continue_with_assumptions";
type BlueprintEvidence = "confirmed" | "assumption" | "unresolved"; // 不伪造确认

interface BlueprintSource { decisionIds: string[]; briefField?: string; note?: string; }

interface ProductBlueprint {
  id: string; projectId: string;
  version: number;                       // v1=首版，重建递增
  previousVersion?: FlattenedPreviousBlueprint; // 最近一版快照（审计/恢复）
  status: BlueprintStatus;
  acceptance?: BlueprintAcceptance;      // confirmed 后记录落点
  stale: boolean;                        // F1-A 决策变化后置位
  guardedPaths: string[];                // 用户手动编辑过的路径（重建不静默覆盖）
  generatedFromConceptVersion?: number;  // 来源 F1-A Brief 版本（stale 判断）
  lastConceptSignature?: string;         // 生成时决策签名（id+title）
  lastConflicts?: string[];              // 最近重建的冲突路径
  sourceDecisionIds: string[];           // 顶部关联的 F1-A decision id 集

  productPositioning: { text; evidence; source };                       // 产品定位
  targetUsers:   { persona; context; primaryNeed; evidence; source }[]; // 首批用户
  primaryJob:    { statement; successMoment; evidence; source };        // 核心任务
  mvpScope:      { mustHave[]; shouldHave[]; explicitlyOutOfScope[] };   // MVP 范围
  coreLoop:      { step; userAction; systemResponse; userValue; evidence; source }[];
  assumptions:   { text; impact; validationIdea; status }[];            // 当前假设
  successSignals:{ metric; target?; rationale; evidence; source }[];    // 成功信号
  unresolvedDecisions: { id; question; options?; chosenHint?; impactNote? }[]; // 未决选择

  createdAt: number; updatedAt: number;  // 版本来源与更新时间（可追溯）
}
```

证据分类铁律（不在生成时伪造）：
- `confirmed` = 用户已表态/决策已落定；
- `assumption` = AI 归纳、待用户确认或验证；
- `unresolved` = 仍需用户选择（进入 `unresolvedDecisions`，不阻塞字段补齐）。

完成度 `getBlueprintReadiness`：`consensusCount`（confirmed 条目数）· `unresolvedCount`（未决数）· `canProceed = !stale && hasUsableBlueprint`。兜底 `hasUsableBlueprint`：至少产品定位或首批用户其一 + 有非 unresolved 条目 + `version>0`。

---

## 三、状态机

```
F1-A not canProceed ───── 拒绝 init（f1a_not_ready，保留旧值/暂无蓝图）
     │ canProceed
     ▼
  [draft] ──init/rebuild(reconcile)──► [draft/reviewing]
     ▲                                    │
     │ restorePrevious / 重建             │ 用户局部编辑 / 暂缓
     │                                    ▼
  上一有效版本 ◄─────[reviewing]◄──────────┘
     │                                    │ 接受当前蓝图
     └────────────────────────────────────┤ 带假设继续 (acceptance=continue_with_assumptions)
                                          ▼
                                  [confirmed]
```

- `draft`：自动生成或更新中；
- `reviewing`：用户正在局部确认/修改；
- `confirmed`：`accepted` 或 `continue_with_assumptions` 两种落点；`previousVersion` 保留可审计快照。

stale 触发：F1-A 新增/修改关键决策（`generatedFromConceptVersion` 变化 或 `lastConceptSignature` 决策签名变化）。
重建：`reconcileBlueprint(prev, fresh)` 保留 `prev.guardedPaths` 上的手动编辑，凡 next 与其冲突 → 保留 prev 值并把冲突写进 `unresolvedDecisions` 与 `lastConflicts`，绝不静默覆盖。

---

## 四、前后端交互示例

```
POST /api/ai/blueprint
{ operationId:"...", operation:"init_blueprint", projectId:"P1" }
  · 守卫：getConceptReadiness(concept).canProceed === false → 400 f1a_not_ready
  · 已存在 v>0 → 幂等跳过；否则 buildBlueprint(concept) → v1 draft
  → { data:{ blueprint, readiness, conflicts, message }, flowMeta:{status:"completed"} }
```

```
POST /api/ai/blueprint — 局部编辑 / 暂缓
{ operation:"update_blueprint", projectId, blueprint,
  patch:{ path:"productPositioning.text", value:"…" } }        // 记入 guardedPaths，status→reviewing
{ operation:"update_blueprint", projectId, blueprint,
  decisionId:"bp…", chosenHint:"聚焦单一人群" }                 // 该项标为按假设选择
```

```
POST /api/ai/blueprint — 接受 / 带假设继续
{ operation:"confirm_blueprint", projectId, blueprint, acceptance:"accepted" | "continue_with_assumptions" }
  → status:confirmed，previousVersion 落盘
```

```
POST /api/ai/blueprint — F1-A 决策变化后重建
{ operation:"rebuild_blueprint", projectId, blueprint }
  → reconcile 保留 guardedPaths、冲突进 unresolvedDecisions，version 递增
```

```
GET  /api/ai/blueprint?projectId=P1   → 当前版本（幂等只读，返回 staleness）
PUT  /api/ai/blueprint                → 恢复最近有效（前一）版本
```

可靠性契约（与 F0-A 对齐）：
- 读写严格按 `projects.id = projectId AND projects.userId = user.sub` 隔离；
- 写操作经 `applyFlowOpOnce`（唯一索引）幂等：同 `(userId, projectId, operationId, operationType)` 重试返回既有结果，不重复生成版本；
- 失败时回读最近持久化蓝图作为 `data.blueprint`，`error` 归一为统一错误码，**不清空当前方案**；
- 前端失败态保留本地最新蓝图并展示可重试入口。

前端体验（F2-A）：
- 主工作区保持「老鸭子对话 + 本轮产出 + 一个关键问题」，不铺平字段表单；
- 顶部状态条：`蓝图已形成 N 项共识 · 仍有 M 项关键选择` + `查看产品蓝图` 按钮；stale 时提示 `需按最新讨论重建蓝图`并给重建按钮；
- 完整蓝图进侧边抽屉，摘要至少含：产品定位 / 首批用户与关键任务 / 核心闭环 / MVP 必须有·暂不做 / 当前假设 / 成功信号；
- 对局部内容可选：接受 / 修改（记 guardedPaths）/ 暂缓·标为假设；
- 页脚三动作：接受当前蓝图 / 带假设进入下一步 / 返回继续讨论。

---

## 五、验证结果

```
npm run validate:flow-f0a        → 63 通过 / 0 失败
npm run validate:flow-f1a        → 70 通过 / 0 失败
npm run validate:flow-f2a        → 49 通过 / 0 失败
npx tsc --noEmit                 → 通过（无输出）
npm run lint                     → 退出 0（存量 warning 均非本次改动文件引入）
npm run build                    → ✓ Compiled successfully · 77 routes · 无 error
```

F2-A 验证覆盖的要求断言（对应需求五）：
1. F1-A 未形成可用方案 / 未表态 → 不可初始化（守卫拒绝）；
2. F1-A 已形成方案且表态 → 生成 Blueprint v1（draft）；
3. 每项结论可追溯（briefField/decisionIds，confirmed 必带出处；assumption 明示）；
4. 未确认信息不被误标 confirmed（成功信号/假设不伪造）；
5. F1-A 决策变化 → stale=true，重建后 stale=false 且 version 递增；
6. 局部编辑在重建时被保留（guardedPaths），冲突进 unresolvedDecisions；
7. 接受当前蓝图与带假设继续均可确认（status→confirmed）；
8. 未决选择反映在完成度，但不强迫补齐（稀疏 brief 不编造、可带假设确认）；
9. 用户 A/B 的 Blueprint 严格隔离（读写隔离、防篡改）；
10. 刷新/幂等重试不产生重复版本；
11. AI/网络失败时恢复最近有效版本，不清空当前方案；
12. F1-A 概念层语义无回归。

---

## 六、尚未做的 F2-B / F3 边界

本阶段刻意不实现，留待后续阶段：
- **F2-B**：进入真实方案落地（技术选型、架构、页面/交互骨架、任务拆解与看板联动，以及把 Blueprint 的回调/验证喂给「按假设继续」的后续环节）；
- **F3**：外部检索、竞品研究、代码生成、第二大脑沉淀与知识入库 —— 均不接入；
- 不接入 LLM 路由 / 现有模型配置：`buildBlueprint` 为确定性启发式，保证离线可用、不伪造证据；
- 未改动 `flow-concept.ts` 或任何通知/表格/知识库语义；`Blueprint` 目前落在项目的 `projects.data` 快照（与 Brief 同机制），未做独立大表迁移 —— 当其需要独立查询/权限/历史版本树时再评估。