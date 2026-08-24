# xiye 流程工作台 · 工作流程与设计边界总结

> 本文档用于：**在不改动底层数据模型与生成导出契约的前提下，重新设计前端 UI / 交互层**。
> 目标读者：一个原型设计 AI（负责产出高保真重设计原型图）。
> 文档内容均来自对当前代码库的真实梳理（标注文件:行号作为代码铁证）。

---

## 0. 给原型设计 AI 的使用说明

- 本文描述了一个名为 **xiye** 的「产品需求合成器」：用户输入一个初始想法 → AI 多轮探索访谈 → 技术栈 / 视觉 / 组件选型 → 骨架搭建 → 最终导出**一个能被 AI 编程工具直接接手开发的项目包（.zip）**。
- 你的任务：**重新设计它的前端界面与交互**，让它更现代、专业、好用。
- **硬约束（不可动）**：见 §6。重设计只能改"外壳（UI/布局/交互/视觉表现）"，不能改底层数据流、状态字段语义、以及最终导出的文件契约——因为下游的 AI 编程工具（Cursor/Codex/WorkBuddy 等）严格依赖这些契约。
- 建议重设计的重点界面：① 4 步流程页（§2）② 视觉微调工作台 builder（§2.5）③ 组件库浏览/预览页（§3）。

---

## 1. 产品定位

- **一句话**：xiye 是一个"产品需求合成器"，不是视觉模板拼装器。它把用户的模糊想法，通过 AI 探索式访谈做丰满，再结合真实参考资料（知识库 / 骨架仓库）合成出**业务专属**的功能页与完整工程资产。
- **核心价值**：交付物不是一个空模板站，而是——`docs/*.md` 文档包（PRD / 技术选型 / 视觉规范 / 动效规范 / AI 交接提示词）+ `styles/` 设计 token + `xiye.config.json` / `xiye.agent.json` 机器可读配置 + `seed/` 可运行工程底座，全部打包成 .zip，交给 AI 编程工具即可开工。
- **关键差异化**：第 1 步的"AI 多轮探索式访谈 + 分支方向卡片选择"是产品灵魂，重设计时**必须保留**这一交互范式。

---

## 2. 端到端用户流程（4 步 + builder 子流程）

总步数定义在 `app/flow/page.tsx:18-19`（`TOTAL_STEPS = 4`，`STEP_NAMES = ["AI 意图","页面搭建","收尾配置","生成项目"]`）。状态由 zustand store `lib/store/flow-store.ts` 统一驱动（`currentStep` 1..4）。

### 第 1 步 · AI 意图（Step0Intent → IntentExplorer）
- **入口**：`app/flow/steps/step0-intent.tsx` 渲染 `components/intent-explorer.tsx`。
- **交互**：
  1. 用户说一个初始想法（输入框，支持首页带 `?intent=` 进入）。
  2. AI 分析意图 → 返回**多个分支方向卡片（Branch）**（`intent-explorer.tsx:206,214,384` 的 `m.branches`）。
  3. 用户点击某分支卡片 → AI 沿该方向深化，再给下一轮分支 → 多轮循环。
  4. 过程中 AI 实时把产品叙事同步进 `flow-store`（`intentNarrative` / `productBrief` / `intentSession`，见 `flow-store.ts:47-53,100-108`）。
- **产出（写入 store）**：`IntentNarrative`（vision / positioning / targetAudience / coreFeatures / pages / marketFit，`lib/ai-intent.ts`）、`ProductBrief`（完整 PRD 草稿）、`IntentSession` 缓存（避免每次重生成）。
- **底部操作**：「下一步」进入页面搭建（`flow/page.tsx:186-189`）。

### 第 2 步 · 页面搭建（Step2Skeleton）
- **入口**：`app/flow/steps/step2-skeleton.tsx`。
- **内容**：
  - 顶部 3 张摘要卡：视觉风格（配色点 + 名称）/ 技术栈（默认 Next.js+Supabase）/ 蓝图覆盖（N 页 · M 区块，`step2-skeleton.tsx:58-86`）。
  - 下方「AI 已回填的页面蓝图」清单：按页面分组、可折叠，列出每页的区块（组件名 + 变体名 + 可选交互，`step2-skeleton.tsx:88-132`）。蓝图来自第 1 步 AI 回填 + builder 工作台累积的 `pageBlueprint`。
- **底部操作**：
  - 「视觉微调」→ `router.push("/builder?from=flow")`，将 `builderReturnStep` 设为当前步（`flow/page.tsx:192-194`）。
  - 「下一步」→ 收尾配置。

### 第 2.5 步 · 视觉微调工作台（builder 子流程）
- **入口**：`/builder`（`app/builder/page.tsx`），是独立全屏工作台（非 flow 内嵌）。
- **作用**：逐块微调视觉风格、设计 Token、组件变体、动效；实时预览；把选择累积进 `pageBlueprint`（`flow-store.ts:94-98,120-124`）。
- **关键能力**（来自项目长期记忆，本会话落地）：
  - 视觉风格面板（切换 `VISUAL_STYLES`，`data/visual-styles.ts`）→ 纵向换行网格，不用横滑。
  - 设计 Token 面板（DesignTokensPanel）：圆角/字体/字号/打字/间距/阴影/滚动/暗色，弹层或内联。
  - 组件变体（卡片/按钮/导航/表单/交互 5 维，`data/component-variants.ts`）。
  - 动效（按场景选变体，`data/motion-library.ts`）。
  - 整页预览（WidePreviewFrame 缩放测量）+ 点选区块挂 GSAP 动效（`components/selectable.tsx` + `lib/interaction-motion.ts`）。
  - 组件库浏览/预览（`app/components/page.tsx`，含 Originkit 接线的特效/整站模板组件 `components/originkit/*`）。
- **返回**：「返回流程」按 `builderReturnStep` 回跳 flow 对应步骤。

### 第 3 步 · 收尾配置（Step3Wrapup）
- **入口**：`app/flow/steps/step3-wrapup.tsx`，3 个 Tab 切换（`:418-422` `TABS = info/stack/keys`）：
  1. **项目信息**：名称（必填，AI 已预填）/ 描述 / Git 仓库地址（`ProjectInfoPane`）。
  2. **技术栈**：按 `projectType` + `aiCapabilities` **智能排序**的推荐卡片网格（星级/推荐标签/成本/周期/门槛，`step3-wrapup.tsx:50-147` `ranked`）。
  3. **服务接入**：按分类（llm/database/vector/auth/payment…）列出服务商，填写 API Key，实时生成 `.env.local` 预览（`ApiKeysPane`，`:275-411`）。
- **底部操作**：「进入生成」。

### 第 4 步 · 生成项目（Step11Generate）
- **入口**：`app/flow/steps/step11-generate.tsx`，调用 `generateProject(state)`（`lib/project-generator.ts:661`）实时计算全部产物。
- **界面区块**（自上而下）：
  1. **规格总览**：产品（名称/类型/定位/特点）+ 技术栈（框架/前后端/库/AI 集成）+ 架构规划（分层/目录/落点页）+ 视觉规范（色板/字体/圆角/密度/阴影/暗色）+ 页面与组件骨架清单（`:144-325`）。
  2. **AI 初始化提示词**：可一键复制，内容 = 交付包里的 `docs/AI_PROMPT.md`（`:327-365`）。
  3. **可运行底座（seed/）概览**：技术栈/文件数/启动命令/「可直接运行 or 权威脚手架」标签（`:375-409`）。
  4. **种子自检报告**：`verifySeed` 判定 通过/提示/失败 计数与明细（`:411-460`）。
  5. **导出的工程文件**：多 tab（md/css/ts/json）切换预览 + 单文件下载 + 一键下载全部 .zip（`:462-519`）。
- **底部操作栏**：复制提示词 / 下载全部 / 保存项目（自动存「我的项目」并支持重开，`flow/page.tsx:146-161,200-226`）。

### 流程控制与持久化
- 步骤切换：`nextStep / prevStep / goToStep / resetAll`（`flow-store.ts:310-330`）。
- 持久化：`persist` 中间件，localStorage key `xiye-flow-design`，`partialize` 持久化除函数外的全部字段（`:332-357`），刷新不丢。
- 首页 `?intent=&reset=1` → `resetAll(1)` 强制回首步（`flow/page.tsx:276-292`）；`/flow?pid=` → 拉取「我的项目」草稿恢复（`flow/page.tsx:240-271`）。

---

## 3. 当前前端页面与路由地图

| 路由 | 文件 | 作用 |
| --- | --- | --- |
| `/` | `app/page.tsx` | 首页：输入想法 → `?intent=&reset=1` 进 flow |
| `/flow` | `app/flow/page.tsx` + `steps/*` | 4 步流程工作台（核心重设计对象） |
| `/builder` | `app/builder/page.tsx` | 视觉微调 / 骨架工作台（子流程） |
| `/components` | `app/components/page.tsx` | 组件库浏览与整页预览 |
| `/library` `/skills` | `app/library/page.tsx` `app/skills/page.tsx` | 知识库 / 技能浏览 |
| `/login` `/register` `/account` | `app/login|register|account/page.tsx` | 账户体系 |
| `/api/*` | `app/api/*` | AI 访谈 / 项目存取 / 知识库 / 品牌导出 / 鉴权 / 组件源码 |

---

## 4. 底层内容层（尽量不变）

这些是当前"工作的地基"，重设计前端时**不要改它们的字段语义、产出结构、对外契约**：

### 4.1 状态数据模型 · `lib/store/flow-store.ts`
单一 zustand store，字段（`:55-138`）承载全流程输入：
- `currentStep`、`projectType`、`aiCapabilities[]`、`techStack`
- `designSystem`（圆角/字体/字号/密度/阴影/滚动/暗色/主辅色 hex）
- `uiLibrary`（main/addon）、`componentVariants`（card/button/navbar/form/interaction）
- `projectInfo`（name/desc/gitRepoUrl）、`apiKeys`（扁平 key-value）
- `visualStyle`（视觉风格 ID）、`motionSelections`（场景→变体）
- `pageBlueprint`（BlueprintEntry[]：pageSlug + componentId + variantId）—— builder 逐块累积
- `intentNarrative` / `productBrief` / `intentSession` —— AI 访谈产物
- `savedProjectId`、快照 `captureFlowSnapshot()`、`generateConfig()`

### 4.2 生成管线 · `lib/project-generator.ts`
`generateProject(state)`（`:661`）→ `GeneratedProject`，再 `buildProjectZipFiles()`（`:718`）拼装 .zip。
**导出契约（下游 AI 工具强依赖，不可改文件名/结构）**：
```
docs/README.md  PRD.md  STACK.md  AI_HANDOFF.md  AI_PROMPT.md
docs/ARCHITECTURE.md  DESIGN_SPEC.md  SKELETON.md  MOTION.md
AGENTS.md  CLAUDE.md            # 仓库根，AI 编码工具自动读取
styles/globals.css             # 设计 token 唯一真值（:root 变量）
styles/tailwind.config.ts
xiye.agent.json  xiye.config.json   # 机器可读闭环清单
seed/...                       # 可运行工程底座（含 scripts/verify.mjs）
```
- `buildPrdMd`（`:531`）：第 4 节拆「4.1 通用骨架页 + 4.2 业务专属页面（P0/P1/P2）」，这是产品差异化的关键产出。

### 4.3 蓝图生成器 · `lib/blueprint-generator.ts`
`buildBlueprint()` → `PROJECT_BLUEPRINT.md`：统一规范指令 + 视觉 token + 区块完整代码 + 动效规范 + 反 AI 味（Anti-Slop）Pre-Flight 自检。供编程工具直接落地页面。

### 4.4 数据资产目录 · `data/*`
`visual-styles.ts`（视觉风格 + 配色，单一事实源）、`skeletons.ts`（12 页面/57 组件/227 变体骨架库）、`tech-stacks.ts`、`ui-libraries.ts`、`component-variants.ts`、`motion-library.ts`、`ai-capabilities.ts`、`project-types.ts`、`service-providers.ts`。
> 改这些会牵动生成产物，重设计前端时**只读消费**，不要改其结构。

### 4.5 组件接线 · `components/originkit/*`
特效 / 整站模板组件（Coverflow、Round Carousel、Wexo 等）通过 `data/component-library.ts` + `app/components/page.tsx` 接线预览，源码白名单读取。

### 4.6 知识库 · `knowledge/*`
内置素材库（只读）+ 用户自建（可读写），`app/api/knowledge/*` 提供 CRUD。

---

## 5. 技术栈与主题机制

- **运行时**：Next.js 16（App Router）/ React 19 / TypeScript / Tailwind v4 / zustand 5。
- **动画引擎**：GSAP 3.15 + `@gsap/react`（全插件免费），framer-motion 已移除（builder 交互与预览动效统一走 GSAP）。
- **UI 基底**：shadcn 风格组件（`@/components/ui/button` 等），`cn()` 合并类名。
- **主题/防闪烁（FOUC）**：`app/layout.tsx` 在 `<head>` 注入同步内联脚本，hydration 前读 `localStorage.theme-preset` 写入 `<html data-theme-preset>`；`<html>` 加 `suppressHydrationWarning` 消除水合差异（next-themes 范式）。
- **设计 token 唯一真值**：`styles/globals.css` 的 `:root` 变量；任何前端重设计**必须仍消费这套变量名**（`--background`/`--surface`/`--primary` 等），不得新增明色没有的变量名、不得改 `--primary` 语义。

---

## 6. 重新设计时的「不可动」边界（契约红线）

1. **store 字段语义不变**：新 UI 仍通过 `useFlowStore` 读写既有字段；不要新增/重命名字段导致 `captureFlowSnapshot()` 与导出断裂。如需新 UI 状态，优先复用现有字段或仅作为纯前端局部 state。
2. **导出文件契约不变**：`docs/`、`styles/`、`xiye.agent.json`、`xiye.config.json`、`seed/` 的文件名、目录结构、JSON schema 由 `project-generator.ts` 决定，前端重设计**不得要求改动它们**。
3. **设计 token 契约不变**：所有视觉必须引用 `globals.css` 的 `:root` 变量；禁止硬编码颜色/字体/圆角数值（见 `blueprint-generator.ts:234` 规范第 2 条）。
4. **AI 访谈「多轮分支选择」范式保留**：第 1 步的核心交互（初始想法 → 分支卡片 → 深化 → 同步叙事）是产品差异化，UI 可重做但交互本质要保留。
5. **文案单一事实源约定保留**：生成产物中区块读取 `site-content.ts`，前端预览/导出不得破坏此约定。
6. **数据资产只读消费**：`data/*` 与 `components/originkit/*` 重设计时只消费，不改动其结构（除非另有明确任务）。

---

## 7. 建议重设计可聚焦的界面（可变外壳）

- **第 1 步 AI 意图**：访谈气泡 + 分支方向卡片的视觉与布局（更现代的对话式 / 画布式呈现）。
- **第 2 步 页面搭建**：蓝图摘要与清单的呈现方式（目前是卡片+可折叠列表，可改为更直观的页面树/画布缩略图）。
- **第 2.5 步 builder**：视觉微调工作台的布局（左侧风格/Token/变体面板 + 中央预览 + 右侧区块树），这是体验重头。
- **第 3 步 收尾配置**：Tab 交互、技术栈推荐卡片、API Key 表单与 .env 实时预览。
- **第 4 步 生成项目**：规格总览报告、文件 tab 浏览器、下载/复制行动的视觉层级。
- **整体**：导航/步骤指示器（当前是居中步骤条 `flow/page.tsx:21-61`）、明暗双主题、空白与栅格、组件库浏览页。
- **可引入的现代化范式**：Linear / Vercel / Raycast 级审美；品牌色 Emerald→Teal 渐变 accent；克制留白、中性色面；卡片用指标/硬数据替代 CTA；动效只动 transform/opacity 并尊重 `prefers-reduced-motion`。

---

## 8. 关键文件索引（代码铁证）

| 关注点 | 文件:行 |
| --- | --- |
| 4 步定义 / 步骤名 | `app/flow/page.tsx:18-19` |
| 步骤渲染分发 | `app/flow/page.tsx:305-318` |
| 底部操作栏 | `app/flow/page.tsx:66-233` |
| 持久化与重置 | `app/flow/page.tsx:240-292` |
| 状态模型 | `lib/store/flow-store.ts:55-138,310-357` |
| 第 1 步 AI 访谈 | `app/flow/steps/step0-intent.tsx` / `components/intent-explorer.tsx:206-214,384` |
| 第 2 步 蓝图摘要 | `app/flow/steps/step2-skeleton.tsx:58-132` |
| 第 3 步 收尾 Tab | `app/flow/steps/step3-wrapup.tsx:418-484` |
| 第 4 步 生成 | `app/flow/steps/step11-generate.tsx:41-519` |
| 生成管线 | `lib/project-generator.ts:661,718` |
| PRD 业务专属页 | `lib/project-generator.ts:531,566-631` |
| 蓝图生成器 | `lib/blueprint-generator.ts:61,220-337` |
| 视觉风格数据 | `data/visual-styles.ts` |
| 骨架库 | `data/skeletons.ts` |
| 主题防闪烁 | `app/layout.tsx`（同步脚本 + suppressHydrationWarning） |
| builder 工作台 | `app/builder/page.tsx` / `app/builder/previews.tsx` |
| 组件库浏览 | `app/components/page.tsx` |

---

_本文由对 xiye 代码库的真实梳理生成，作为重设计前端原型时的阅读上下文。所有改动尚未 git 提交。_
