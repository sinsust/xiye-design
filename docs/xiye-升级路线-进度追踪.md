# xiye 升级路线 · 进度追踪台账

> 用途：把「更好用 × 更智能」升级路线沉淀为**可长期追踪的进度记录**，防止远期项随开发周期被遗忘。
> 使用方式：每完成一项，把该项状态改为「✅ 已完成」，更新进度总览与更新时间，并在更新日志追加一行；被问到进度时，先读本台账，再用 git log 与代码验证点核对真实状态。
> 创建：2026-09-22 ｜ 最近更新：2026-10-12

---

## 一、进度总览

| 主线 | 总项 | ✅ 已完成 | 🟡 进行中 | ⬜ 待办 | ❌ 已下线 | 完成率 |
|---|---|---|---|---|---|---|
| A · 更好用（体验） | 9 | 5 | 0 | 3 | 1 | 56% |
| B · 更智能（AI） | 8 | 5 | 0 | 3 | 0 | 63% |
| C · 底座（可靠） | 7 | 5 | 0 | 2 | 0 | 71% |
| **合计** | **24** | **15** | **0** | **8** | **1** | **63%** |

状态图例：✅ 已完成（代码验证通过）｜ 🟡 进行中（有实际改动未闭环）｜ ⬜ 待办｜ ❌ 已下线（载体消失，不再排期；完成率按 24 项总盘计）

---

## 二、主线 A · 更好用（体验层）

| ID | 升级项 | 时间窗 | 优先级 | 状态 | 验证点（做没做，怎么查） | 依据 |
|---|---|---|---|---|---|---|
| A1 | 双产品线入口收敛：Studio/Brain 心智分离 | 近期 | P0 | ✅ 已完成 | 核对确认：`components/site-nav.tsx` 已按 Studio/Brain 分组导航；`components/brain/brain-home.tsx` 已收敛为单一「今日空间」，看板降为二级高级工具（9-11 批次落地） | PRD §3；审计 F-2 |
| A2 | 移动端主导航补齐 | 近期 | P1 | ✅ 已完成 | 主体已落地（site-nav 汉堡抽屉全量导航）；本次补抽屉顶部「首页」入口，手机端可显式回首页 | PRD §6.1 |
| A3 | 注册后 onboarding 引导 | 近期 | P2 | ❌ 已下线 | 载体消失：注册流程已随 C7（Supabase Auth 下线 → 本地档案）移除，`app/register/page.tsx` 已删，故「注册后引导」不再成立。原 `app/welcome/page.tsx` 因此成为孤儿页（页面可访问但**全站 0 处引用**），**2026-10-12 已删除整个 `app/welcome/`**，删除后 grep 全站残留 0 处。若日后恢复注册/新增档案引导，需重建 | 审计 Fu-7 |
| A4 | live preview 自动刷新 + 桌面/平板/手机三档宽度 | 中期 | P1 | ✅ 已完成 | 核对确认：`live-preview.tsx` 自动刷新 effect（deps=[generate, blueprint]，120ms+rAF 抑制重排）；`lib/live-preview.ts` `PREVIEW_WIDTHS` 三档（desktop 1280 / tablet 768 / phone 390） | 审计 F-5；PRD §6.3 |
| A5 | checkpoint 真实 diff（逐字段/逐页对比） | 中期 | P2 | ✅ 已完成 | 新增 `lib/checkpoint-diff.ts` 纯函数 diff 引擎（新增/删除/修改三态 + 字段级 + 全局配置聚合页 + 中文标签）；`components/builder-checkpoints.tsx` 对比面板：每项「与当前工作区对比」+「对比版本」双选历史。行为单测：页面新增/字段修改/全局配置全断言通过 | 审计 F-6；PRD §9.2 |
| A6 | 今日复习卡片回归首页（≤5 条/天） | 中期 | P1 | ✅ 已完成 | 核对确认（10a8b09 移除后已按 PRD §7.4 恢复）：`lib/api-handlers/brain/today.ts` 合并 SM-2+学习到期、`REVIEW_CARD_LIMIT=5`、内容预览回填；`components/brain/today-space.tsx` 渲染「今日复习」卡（complete/skip/mastered/not_sure/snooze 动作） | PRD §7.4；审计 F-3 |
| A7 | 全局 ⌘K 命令面板 | 远期 | P2 | ⬜ 待办 | 全站命令入口（搜索面板扩展） | 新建议 |
| A8 | 示例项目/模板库（进入即用） | 远期 | P2 | ⬜ 待办 | 首页/首屏提供示例项目与模板 | PRD §6.1 |
| A9 | 空状态族启用（Empty 组件） | 远期 | P3 | ⬜ 待办 | `components/ui/empty*` 存在被引用点（当前 0 引用） | 审计遗留（批次 A） |

## 三、主线 B · 更智能（AI 层）

| ID | 升级项 | 时间窗 | 优先级 | 状态 | 验证点（做没做，怎么查） | 依据 |
|---|---|---|---|---|---|---|
| B1 | 历史偏好注入：新项目继承历史技术栈/风格/组件偏好 | 近期 | P0 | ✅ 已完成 | `lib/project-preferences.ts`（统计+格式化）+ `ai-discover-server.discover()` 注入 system + `api-handlers/ai/discover.ts` 回传 `prefsUsed` + `intent-explorer` 提示条 | PRD §6.5 |
| B2 | 访谈 gap 主动追问：缺目标用户/商业模式/指标时 AI 主动问 | 近期 | P1 | ✅ 已完成 | `ai-discover-server.detectBriefGaps()` 确定性检测并注入 system 追问指引；行为测试：空 brief→6 缺口、填满→0、部分→仅剩余 | PRD §6.4；新建议 |
| B3 | Decision Ledger 落地并注入 AGENTS.md | 中期 | P0 | ✅ 已完成 | 核对确认：`seed-project.ts` `buildAgentMdFiles` 将 `conceptBrief.decisions` 按「已采纳/待验证假设/已驳回」三态注入 AGENTS.md + CLAUDE.md（M2-D 批次）；`decision-suggestion-card.tsx` 采纳/驳回写回 status+reason 并 POST 台账；zip 根与 workspace 均覆盖 | PRD §6.4/§12-18；审计 Fu-2 |
| B4 | 跨库统一问答覆盖 Obsidian 索引 | 中期 | P1 | ✅ 已完成 | 核对确认（实现路径与台账原描述不同）：Obsidian 笔记经 `obsidian-sync` 同步入库（source="obsidian"），`ask.ts` 本地检索 `listBrainNotes` 全量覆盖（不过滤来源），`lib/brain-ask-source.ts` `localSourceOf` 按 obsidianNoteId 细分来源并标注目录名。独立 Obsidian Connector 无实际价值（无凭据实时读取），留给本地文件 B8（桌面壳） | PRD §7.3；审计 Fu-1 |
| B5 | 生成验收报告：PRD 完整性评分/骨架覆盖率/Anti-Slop 结果 | 中期 | P2 | ⬜ 待办 | deliver 阶段呈现可读验收报告（非仅 verifySeed 布尔） | 新建议；已有 verifySeed 地基 |
| B6 | Studio RAG：知识库/历史项目做 few-shot 参考 | 远期 | P1 | ⬜ 待办 | 生成管线接入 embedding/检索（复用 `lib/embedding.ts`） | 新建议 |
| B7 | LLM 路由分级 + 只读用量统计（配额已下线） | 远期 | P2 | ✅ 已完成 | **路由分级 ✅**：`lib/llm/` 五件套（providers/features/resolve/chat/config-store）功能级路由 + BYOK；**配额 ❌ 已下线**：用户拍板「用户自用了多少是它自己的事，平台不提供免费 key、不做硬拦截」，全仓 quota/配额 0 实现，仅做只读统计；**只读用量统计 ✅（新增）**：`lib/llm/usage.ts`（`recordUsage` fire-and-forget 静默吞错 + `getUsageSummary` 内存聚合自然月窗口 + `recordUsageFromModel` 便捷封装）+ `lib/db` 注册 `aiUsage` 表（schema 已定义，index.ts 三处补齐）+ `transport.ts` 统一 fetch 落点（llmChat 内置 recordUsage，覆盖 chatWithModel/table/llm 路径）+ 12 处独立 fetch 出口（`ai-intent/name/concept/discover×2/panel`、`brain-ask`、`brand-rewrite×2`、`brain-organize/report`、`knowledge`、`copy`）补 `recordUsageFromModel` 埋点（修复此前「chatWithModel 非唯一出口导致 intent 等绕过、用量恒为 0」的架构漏洞）+ `api-handlers/ai/usage.ts` GET 只读汇总（401 保护）+ `app/account/models/page.tsx` UsageSection 展示（本月调用/token/延迟 + Top5 功能）+ `supabase/migrations/0017_ai_usage.sql`。**端到端实测（mock LLM 8771）**：触发 intent 后 `GET /api/ai/usage` 返回 `totalCalls:1, flow-intent 12in/7out`，证明 bypass 修复生效。验证：tsc --noEmit 0 错误 | PRD §8 |
| B8 | 本地文件连接器（目录索引/打开） | 远期 | P3 | ⬜ 待办 | local-file connector 存在；依赖桌面壳落地 | PRD §12-14；审计 Fu-3 |

## 四、主线 C · 底座（可靠层）

| ID | 升级项 | 时间窗 | 优先级 | 状态 | 验证点（做没做，怎么查） | 依据 |
|---|---|---|---|---|---|---|
| C1 | DB 类型契约收敛（lib/db 去 any） | 近期 | P2 | ✅ 已完成 | `lib/db/index.ts` 全部去 any：`db!: BetterSQLite3Database<typeof SqliteSchema>`、39 张表 `let xxx!: typeof SqliteSchema.xxx`，PG 分支同构断言（schema.pg/schema.ts 约定同步）；顺带修复 schema 漂移：`schema.ts` 补 `brainNotes.imaNoteId`、`userObsidianConfig.defaultFolder/categoryFolderMap`、`brainStrategies` 5 列（parentId/kind/goal/rationale/sortOrder），SQLite 建表区补 `user_obsidian_config` 幂等建表；`strat-fix/route.ts` 显式断言 PG 数据库（SQLite 驱动无 execute，一次性迁移工具 PG-only） | 审计 R-1 |
| C2 | 双 DB 模式单一开关（SQLite/PG） | 近期 | P3 | ✅ 已完成 | `lib/db/index.ts` 新增 `resolveDbMode()`：`DB_MODE=pg|sqlite` 单一开关（pg 缺串启动报错、sqlite 强制本地、未设置自动探测兼容 Vercel）；运行时对 `:5432?pgbouncer=true` session 池串打印引导告警（R-2）；`.env.example`/`drizzle.config.pg.ts` 引导改 6543 事务池 | 审计 R-2/C3 |
| C3 | Obsidian vault 根目录白名单校验 | 中期 | P1 | ✅ 已完成 | `lib/obsidian-sync.ts` 新增 `validateVaultPath`（拒绝空/磁盘根/用户主目录，要求存在且为目录且可写），`writeOne`/`removeOne`/`exportUnsyncedNotes` 三入口接入（writeOne 失败 warn 跳过、removeOne 拒绝返回、export 返回 error） | 审计 S-3 |
| C4 | 外部调用超时（飞书 client AbortSignal） | 中期 | P2 | ✅ 已完成 | `lib/feishu/client.ts` 新增 `fetchWithTimeout`（AbortController + 默认 10s），5 处 fetch（token 换取/刷新、listTables/listFields/listRecords）全部接入，超时抛清晰错误。**延伸项已收口**：原「约 12 处 LLM 裸 fetch 无超时」随 B7 落地解决——`lib/llm/chat.ts` 成为服务端唯一 fetch 落点，统一 `AbortSignal.timeout(40000)`，端到端实测端点不通时 7ms 即返回 502 而非挂死 | 审计 S-4 |
| C5 | 动态预览 sandbox（dev-server 级交互） | 远期 | P2 | ⬜ 待办 | 独立 sandbox 运行时存在 | PRD §6.3；审计 F-7 |
| C6 | 桌面壳承载（Electron/Tauri + watcher） | 远期 | P3 | ⬜ 待办 | 桌面运行态存在，Obsidian 直连可用 | PRD §12-14 |
| C7 | Supabase Auth 下线 → 本地档案体系（形态 C · 桌面单机） | 近期 | P0 | ✅ 已完成 | **已删除**：`lib/supabase/{client,env,middleware,server}.ts`、auth 7 个 handler（login/register/logout/confirm/resend/reset-password/update-password）、`app/login`、`app/register`、`app/auth/update-password`、`components/auth-guard-host.tsx`、`components/auth-menu.tsx`、`proxy.ts`、`scripts/{e2e-auth-regression,migrate-supabase-auth}`。**已新增**：`lib/local-profile.ts`（cookie `xiye_profile` + localStorage 档案列表）、`lib/local-scope.ts`（档案 id 归一化 `^[A-Za-z0-9_-]{1,64}$` + `ensureLocalUser` 幂等建档）、`components/profile-menu.tsx`、`profile-section.tsx`。**关键设计**（`lib/auth.ts:21-27`）：`getSessionUser()` 重写为「解析档案并伪装成会话用户」，**恒返回用户、永不为 null**，`sub`＝档案 id＝`users.id` 业务主键，故全部依赖 `getSessionUser`/`requireUser` 的既有 handler **零改动**继续跑；无 cookie 时回退库里最早的 user，老数据不会一夜清空。**端到端实测**：`GET /api/auth/me` → 200 `{"user":{"id":"local","email":"local@local.xiye"}}`；`.env` `DB_MODE=sqlite` 强制本地库 | 形态 C 决策 |

---

## 五、推荐执行顺序

1. **B1 + B2**（历史偏好注入 + gap 追问）：改动小、智能感知最强，先兑现「更懂你」
2. **A1 + A2 + A3**（入口收敛 + 移动导航 + onboarding）：PRD 已承诺，体验感知最直接
3. **B3 + A4**（Decision Ledger + 预览自动刷新）：差异化核心，与模板拼装器拉开差距
4. **A6 + B4 + C3**（复习回归 + 跨库问答 + vault 白名单）：PRD 承诺 + 安全补齐 —— ✅ 已全部完成
5. **C1 + C4**（DB 类型契约 + 外部调用超时）：底座可靠层，先收近期的类型收敛，再补中期超时防护 —— ✅ 已全部完成
6. 其余按时间窗推进（A7/A8/A9 → B5/B6/B7/B8 → C5/C6）
7. **已完成的架构转向（非排期项，仅作参照）**：C7 Supabase Auth 下线 → 本地档案（形态 C 桌面单机）、B7「BYOK 用户自带模型 + 功能级路由 + 只读用量统计（配额已下线）」。注意这两项**尚未提交入库**（工作树 ~90 文件未提交，仅 1 个组件库 commit 未推送）

---

## 六、已完成基线（2026-09-08 ~ 09-12，非本路线范围，仅作参照）

上一轮审计批次已闭环、**无需再排期**：全局 toast/错误边界/确认弹窗统一（A 批）、认证死路修复+resend（B 批）、阶段门禁统一+产物库入口（C 批）、Brain 反馈/搜索入口（D 批）、连接器聚合+ima 体验（E 批）、审美收尾（F 批）、鉴权集中收口+限流 fail-degraded、全局操作审计日志、Obsidian 双向同步、IMA 写回、Originkit 组件库。

---

## 七、更新日志

| 日期 | 更新内容 |
|---|---|
| 2026-09-22 | 台账创建：23 项升级路线（A9/B8/C6）全部登记为待办，附验证点与依据 |
| 2026-09-22 | **B1、B2 完成**：新增 `lib/project-preferences.ts`（历史偏好统计+格式化）；`ai-discover-server` 增加 `detectBriefGaps` 并注入 system；`api/ai/discover` 回传 `prefsUsed`；`intent-explorer` 显示偏好参考提示条。验证：tsc 无新增错误、eslint --quiet 0 error、gap 检测行为单测通过 |
| 2026-09-22 | **A1/A2/A3 完成**：A1 核对确认（9-11 已落地导航分组+Brain 单一入口）；A2 补移动端抽屉「首页」入口（`site-nav.tsx`）；A3 新增 `app/welcome/page.tsx` 双产品线引导页 + `register` 注册成功跳转引导。验证：tsc 无新增错误、eslint --quiet 0 error |
| 2026-09-22 | **B3/A4 核对确认完成**（均为审计后已落地项，无代码改动）：B3 Decision Ledger 三态注入 AGENTS.md/CLAUDE.md（`seed-project.ts` M2-D）+ 采纳/驳回写回（`decision-suggestion-card.tsx`）；A4 live preview 自动刷新 effect + 三档宽度（`live-preview.tsx` / `lib/live-preview.ts`） |
| 2026-10-14 | **Vercel 函数数削减落地（14 → 8）**：将 `auth`/`enter`/`strat-fix` 三个独立 route 合并进根分发器 `app/api/[[...path]]`（措施 A/B/C）；`brain`/`library`/`enter` 三个页面去 `force-dynamic`/静态化（措施 D/E，library 改走 `KnowledgeBrowserFromClient` 客户端取数，数据来源与行为不变）。剩余 8 个函数（7 个 API 分发器 + 0 个动态页面）≤ Hobby 12 上限、余量 4。同步修正 `lib/browser/sw-entry.ts` 两处已删 route 的 import 指向新 handler 模块（`lib/api-handlers/auth/me`、`lib/api-handlers/misc/strat-fix`）。验证：tsc --noEmit 0 错误；SW 打包（esbuild）通过（仅本地安全策略拦截写 `public/sw.js`，与代码无关） |
| 2026-10-14 | **Vercel 公开版（路线 A）落地**：大前提从「桌面单机」转向「部署到 Vercel 给他人使用」。新增部署模式开关 `lib/deploy-mode.ts`（`DEPLOY_MODE`/`NEXT_PUBLIC_DEPLOY_MODE`=local\|public，默认 local 行为零变化）+ `lib/profile-signature.ts`（HMAC-SHA256 签名 cookie `id.sig`，Web Crypto 兼容 edge）+ `middleware.ts` 总闸（public 下验签失败：页面 307 跳 /enter、API 401；87 处 `getSessionUser` 调用方零改动）+ `app/enter/page.tsx` 邀请码门户 + `app/api/enter`（POST 校验 ACCESS_CODE→建档→种 HttpOnly 签名 cookie；DELETE 退出清 cookie）。**P0 全修**：P0-1 越权（验签失败**绝不回退默认档案**）、P0-2 用量 userId 断链（`recordUsage` 内部自动从会话解析，12 处埋点零改动）、P0-3 补 10 个 nodejs 路由 `maxDuration=300`、P0-4 env 硬校验 + public 默认关 Obsidian watcher。**关键 bug 修复**：`lib/local-profile.ts` `writeProfileCookie` 在 public 下必须 no-op —— `document.cookie` 会按 (name,domain,path) 覆盖 HttpOnly 签名 cookie（HttpOnly 只挡读取不挡覆写），否则抹掉签名 → 401 死循环。**桌面特性入口隐藏**（ima 导入/绑定卡/写回、Obsidian 设置卡与连接器行、档案切换器、知识库本地路径），代码保留。**端到端实测（public 模式真机）**：无 cookie → `/` 307 跳 `/enter?next=%2F`、`/api/ai/usage` 401；错邀请码 403 `invalid_code`；正确码 200 + `Set-Cookie: xiye_profile=<id>.<sig>; HttpOnly`；改 id 保留签名 / 裸 id 无签名 / 任意签名 **三种伪造全部拒绝**（401/307）；两档案各触发一次 intent（mock LLM）→ 各自 `totalCalls:1`（证明用量按 userId 隔离，非混记）；DELETE 退出下发 `Max-Age=0`。local 模式回归：`/api/auth/me` 仍返回 `id:"local"`，行为不变。新增 `docs/vercel-公开版部署.md` + `.env.example` 补 public 变量（移除已失效的 AUTH_SECRET）。验证：tsc --noEmit 0 错误 |
| 2026-09-22 | **B4/A6 核对确认完成**（审计后已恢复/落地，无代码改动）：B4 Obsidian 经同步入库+本地检索+来源细分覆盖跨库问答（`brain-ask-source.ts`）；A6 今日复习按 PRD §7.4 恢复（`today.ts` ≤5 上限 + `today-space.tsx` 渲染与四动作） |
| 2026-09-22 | **C3/C1 完成（底座线首次动工）**：C3 `obsidian-sync.ts` 新增 `validateVaultPath` 白名单校验并接入三入口；C1 `db/index.ts` 全量去 any（`typeof SqliteSchema.*` 类型契约 + PG 同构断言），修复 schema.ts 三处列漂移（imaNoteId / defaultFolder+categoryFolderMap / brainStrategies 5 列）+ SQLite 补 user_obsidian_config 建表，`strat-fix` 断言 PG-only。验证：tsc 无新增错误（仅剩 4 个存量：brain-display×2 / rate-limit / middleware）、eslint --quiet 0 error |
| 2026-09-22 | **C4 完成**：`lib/feishu/client.ts` 新增 `fetchWithTimeout`（AbortController + 10s 默认超时），5 处 fetch 全部接入（token 换取/刷新、listTables/listFields/listRecords），超时抛清晰错误。验证：tsc 无新增、eslint --quiet 0 error。延伸观察：约 12 处 LLM 端点裸 fetch 无超时，列后续收口项 |
| 2026-09-22 | **C2 完成**：`lib/db/index.ts` 新增 `DB_MODE=pg|sqlite` 单一开关（`resolveDbMode`，pg 缺串报错/sqlite 强制本地/未设置自动探测兼容 Vercel）+ 运行时对 session 池串（5432+pgbouncer）打印引导告警；`.env.example` 与 `drizzle.config.pg.ts` 连接串示例改 6543 事务池。验证：tsc 无新增（4 个存量不变）、eslint --quiet 0 error |
| 2026-10-12 | **A3 下线 + 孤儿页清理**：用户拍板选「删除」——`app/welcome/page.tsx` 随 C7 Auth 下线失去入口（全站 0 引用），已删除整个 `app/welcome/` 目录，删除后 grep 全站残留 0 处。台账新增 ❌ 已下线 状态（载体消失不再排期），A3 由 🟡 改 ❌；总览加「❌ 已下线」列：24 项 = 14 完成 / 1 进行中 / 8 待办 / 1 已下线 |
| 2026-10-13 | **B7 完整收口（只读用量统计 ✅ + 配额 ❌ 已下线）**：用户拍板「用户自用了多少是它自己的事，平台不提供免费 key、不做硬拦截」→ 砍掉用户级配额，只做只读用量统计。代码落地：`lib/llm/usage.ts`（`recordUsage` fire-and-forget 静默吞错 + `getUsageSummary` 自然月内存聚合 + `recordUsageFromModel` 便捷封装）、`lib/db/index.ts` 三处补齐 `aiUsage` 表注册、`lib/llm/transport.ts` 统一 fetch 落点（llmChat 内置 recordUsage，覆盖 chatWithModel/table/llm）、**12 处独立 fetch 出口补 `recordUsageFromModel` 埋点**（修复此前「chatWithModel 非唯一出口导致 intent 等绕过、用量恒为 0」的架构漏洞）、`api-handlers/ai/usage.ts` GET 只读汇总（401 保护）、`app/account/models/page.tsx` UsageSection 只读展示、`supabase/migrations/0017_ai_usage.sql`。**端到端实测（mock LLM 8771）**：触发 intent 后 `GET /api/ai/usage` → `totalCalls:1, flow-intent 12in/7out`，bypass 修复生效。验证：tsc --noEmit 0 错误。B7 由 🟡 改 ✅；总览 15 完成 / 0 进行中 / 8 待办 / 1 已下线 = 63% |
| 2026-10-12 | **台账与代码对齐 + 端到端验证（dev server 3200 实测）**：新增 C7 登记「Supabase Auth 下线 → 本地档案体系」（端到端实测 `/api/auth/me` 恒返回 `id:"local"`）；B7 改 🟡（路由分级/BYOK 已落地、**配额 0 实现**）；C4 延伸项收口（LLM 超时由 `lib/llm/chat.ts` 统一 40s）；A3 改 🟡（⚠️ register 已删，`/welcome` 成孤儿页、0 引用）。**端到端实测**：6 个页面全 200（`/` `/welcome` `/account/models` `/brain` `/components` `/workflow`）；未配模型 → 412 `model_not_configured` + 正确引导；模型端点不通 → 502 `provider_unavailable`（7ms，未卡超时）；`DELETE /api/ai/models/:id` 在仍生效时正确返回 409 `model_in_use`。**顺带修复**：3 处用户可见文案仍指向已废的 `LLM_MODEL_*` 环境变量（`overview-panel.tsx:323`、`second-brain.tsx:2806`、`ai-fallback-badge.tsx:26`）+ 2 处 lib 注释，统一改为指向「设置 → AI 模型」。验证：tsc --noEmit 0 错误 |
| 2026-09-22 | **A5 完成**：新增 `lib/checkpoint-diff.ts`（纯函数 diff 引擎：逐页新增/删除/修改 + 字段级 + 全局配置聚合 + 中文标签）+ `builder-checkpoints.tsx` 对比面板（与当前工作区对比 / 双选历史版本对比）。验证：tsc 无新增、eslint 0 error、行为单测 ALL PASS（页面增删改/字段/损坏输入/相同快照） |
