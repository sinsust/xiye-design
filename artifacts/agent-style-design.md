# 第二大脑 · 角色风格系统（多风格预设）设计方案

> 目标：把当前硬编码的「后宫智囊团 / 老鸨子」主题，解耦成 **可切换的风格注册表**，预设 5–8 套风格（后宫 / 帝王 / 霸总 / 江湖 / 修仙 / 校园 / 赛博），用户自选即生效到「做产品」全流程（会诊 prompt、对话文案、人设管理 UI）。趣味优先，兼顾闷骚。头像用网上风格化图源（DiceBear）+ 支持人工上传 + 链接修改。

---

## 1. 现状与痛点（已用代码铁证定位）

「后宫」主题散落在 **11+ 处硬编码**，无法切换：

| 位置 | 硬编码内容 | 类型 |
|---|---|---|
| `lib/ai-panel-server.ts:30` | `你是…「老鸨子」，负责统筹后宫智囊团会诊` | **moderator system prompt（核心）** |
| `lib/ai-panel-server.ts:290` | 对话标注 `非用户 → "老鸨子"` | 会诊转写标签 |
| `lib/ai-discover-server.ts:557` | persona 注入（资深产品架构师口吻） | 对话 persona |
| `app/account/agents/page.tsx:157` | 标题「后宫智囊团 · 人设管理」 | UI |
| `app/account/agents/page.tsx:20` | `moderator: "老鸨子 · 主持"` (ROLE_TAG) | UI |
| `app/account/page.tsx:278` | 入口「后宫智囊团 · 人设管理」 | UI |
| `app/workflow/agents.ts:32-70` | 5 个 agent 默认名（老鸨子-丽颖…苍老师） | 数据 |
| `app/workflow/agents-store.ts:3` | 注释「后宫智囊团」 | 注释 |
| `app/workflow/components/chat-stream.tsx:350,446` | 「老鸨子会陪你聊清楚…」「后宫智囊团会诊中」 | UI 文案 |
| `app/workflow/components/collab-stage.tsx:1369,1374,1452` | 「后宫智囊团」×3 | UI 文案 |
| `app/globals.css:189` | 动画注释「后宫智囊团」 | 注释（可留） |

**结论**：要支持多风格，必须把上述主题字符串收口到一个 **风格注册表**，并按 `styleId` 透传到 prompt 与 UI。

---

## 2. 架构方案

### 2.1 风格注册表（单一真值源）
新增 `lib/agent-styles.ts`（client + server 共用，无 server-only 依赖）：

```ts
export type AgentStyleId =
  | "harem" | "emperor" | "ceo" | "jianghu" | "xianxia" | "campus" | "cyber";

export interface AgentStyle {
  id: AgentStyleId;
  name: string;            // 后宫风
  emoji: string;           // 🏮
  tagline: string;         // 趣味+闷骚一句话
  description: string;
  accent: string;          // 选择器卡片主色（hex）
  moderatorTitle: string;  // 老鸨子 / 朕 / 顾总 …
  moderatorLabel: string;  // 老鸨子 · 主持
  framing: string;         // 后宫智囊团 / 御前智囊 …
  consultingText: string;  // 后宫智囊团会诊中…
  hintText: string;        // 老鸨子会陪你聊清楚…
  diceBear: { style: string; };   // 预设头像 DiceBear 风格
  agents: Record<AgentId, { name: string; avatarSeed: string }>;
  moderatorSystem: (title: string, framing: string) => string; // 模板
}
export const AGENT_STYLES: Record<AgentStyleId, AgentStyle> = { ... };
export const DEFAULT_STYLE: AgentStyleId = "harem";
```

预设头像默认 URL：`https://api.dicebear.com/7.x/<diceBear.style>/svg?seed=<avatarSeed>`（按风格区分 DiceBear 子风格，视觉即「风格化」）。

### 2.2 状态与持久化
- `app/workflow/agents-store.ts`：新增 `currentStyleId` 状态 + `setStyle(styleId)`。
  - `setStyle` 行为：**批量应用**该风格 5 位 agent 的默认名 + 默认头像到 `overrides`，并写 `currentStyleId`（用户选风格 = 套用预设，之后仍可逐个微调）。
  - 持久化随现有 localStorage 机制；同时调用 `/api/agents` 同步服务端。
- `lib/db/schema.pg.ts:34` + `schema.ts:28`：给 `agentSettings` 表加 `styleId TEXT`（nullable）。
- `lib/api-handlers/other/agents.ts`：PUT 接收可选 `styleId`，upsert 时写入；GET 返回 `styleId`。校验：仅允许注册表内 id。
- moderator 的 prompt 仅由 `styleId` 派生（不持久化标题文本），后端按 `styleId` 查注册表还原 `moderatorTitle/framing`。

### 2.3 Prompt 透传（做产品生效的核心）
- `lib/ai-panel-server.ts`：
  - `AGENT_SYSTEM.moderator` 改为模板 `你是多 Agent 协同工作台里的「{title}」，负责统筹{framing}会诊。`。
  - 新增导出 `buildAgentSystem(styleId)` → 解析后 `Record<PanelAgentId,string>`。
  - `:290` 转写标签 `非用户 → style.moderatorTitle`。
  - `consultAgents(brief, apiKey, messages, persona, styleId)` 增加 `styleId` 参数；调用方（`lib/api-handlers/ai/panel.ts:53,57`）透传 `body.styleId`。
- `lib/ai-discover-server.ts:557`：persona 注入改用 `style.moderatorTitle`（保留通用口吻，或加可选 `discoverTone`）。

### 2.4 UI 收口（11 处 → 读注册表）
- `app/account/agents/page.tsx`：标题、ROLE_TAG 读当前 `style`。**顶部新增「风格」选择器区块**（7 张风格卡，当前选中高亮 + accent 描边；点击 → 确认弹窗「应用【X风】将覆盖当前 5 位人设？」→ 确认即 `setStyle` 并保存）。
- 每个 agent 卡片新增：**上传头像**（`<input type=file>` → canvas 压缩 ≤256px webp → data URL 写入 `avatarUrl`）+ 链接输入框（沿用现有）。`avatarUrl` 列类型 `TEXT`、zod `max` 提到 50000 以容纳 data URL。
- `app/account/page.tsx:278`：入口标题随 `style.framing` 变化。
- `chat-stream.tsx` / `collab-stage.tsx`：文案读 `style.consultingText / hintText / framing`。
- `next.config`（如启用 next/image）加 `api.dicebear.com` remotePatterns；当前用原生 `<img>`，无需。

### 2.5 头像三来源（满足「网上找图 + 上传 + 链接」）
1. **预设**：DiceBear 风格化 SVG（每风格不同子风格 + seed，视觉即区分），零存储。
2. **上传**：前端 canvas 压缩为 webp data URL，落 `avatarUrl`（localStorage + DB TEXT）。
3. **链接**：现有 URL 输入框，保留。

---

## 3. 七套风格完整定义（待你圈定/增删）

| # | id | 名称 | emoji | accent | moderator 头衔 | framing | 趣味/闷骚 tagline |
|---|---|---|---|---|---|---|---|
| 1 | harem | 后宫风 | 🏮 | #e7559d | 老鸨子 | 后宫智囊团 | 「朕的后宫，你说啥就是啥（才怪）」 |
| 2 | emperor | 帝王风 | 👑 | #d4af37 | 朕 | 御前智囊 | 「普天之下，皆是朕的产品」 |
| 3 | ceo | 霸总风 | 💼 | #1f2937 | 顾总 | 董事会智囊 | 「这个项目，我要的是结果」 |
| 4 | jianghu | 江湖风 | 🗡️ | #7c2d12 | 帮主 | 江湖智囊 | 「江湖路远，产品为刀」 |
| 5 | xianxia | 修仙风 | ☯️ | #0ea5e9 | 掌门 | 宗门智囊 | 「大道至简，产品亦如修行」 |
| 6 | campus | 校园风 | 🎒 | #22c55e | 班长 | 班委智囊 | 「这次小组作业，包在我身上！」 |
| 7 | cyber | 赛博风 | 🤖 | #06b6d4 | 核心 ORACLE | 矩阵智囊 | 「初始化产品矩阵…意识已连接」 |

五位 agent 每套的「称呼」建议（moderator / pm / architect / designer / guard）：

- **后宫风**：老鸨子-丽颖 / 产品专家-亦菲 / 架构专家-热巴 / 视觉专家-冰冰 / 开发规范-苍老师（保留现状）
- **帝王风**：朕-秦皇 / 丞相-魏征 / 太尉-李靖 / 尚衣监-公输 / 御史大夫-狄仁
- **霸总风**：顾总 / COO-林特助 / CTO-沈工 / CVO-苏设计 / 合规官-秦律
- **江湖风**：帮主-风爷 / 军师-诸葛 / 堂主-铁手 / 绣娘-青鸾 / 刑堂-冷面
- **修仙风**：掌门-清虚 / 首座-云岚 / 器峰-墨阳 / 丹青-琉璃 / 戒律-玄铁
- **校园风**：班长-小杨 / 学委-小琳 / 电教-大神 / 宣传-阿美 / 纪律-老班
- **赛博风**：核心-ORACLE / 逻辑体-PLAN / 架构体-SYS / 美学体-AESTH / 防火墙-SENTRY

（DiceBear 子风格映射建议：harem→lorelei，emperor→personas，ceo→notionists，jianghu→open-peeps，xianxia→lorelei，campus→fun-emoji，cyber→bottts。可在实现时微调。）

---

## 4. 改动文件清单（file:line 触达）

| 文件 | 改动 |
|---|---|
| `lib/agent-styles.ts` | **新增**：风格注册表（7 套）+ 默认值 + 派生函数 |
| `lib/db/schema.pg.ts` / `schema.ts` | `agentSettings` 加 `styleId` 列 |
| `lib/api-handlers/other/agents.ts` | PUT/GET 支持 `styleId`，zod 放宽 `avatarUrl` |
| `lib/ai-panel-server.ts` | moderator 模板化 + `buildAgentSystem(styleId)` + 转写标签 |
| `lib/ai-discover-server.ts` | persona 用 `style.moderatorTitle` |
| `lib/api-handlers/ai/panel.ts` | 透传 `body.styleId` |
| `app/workflow/agents-store.ts` | 加 `currentStyleId` + `setStyle` |
| `app/workflow/agents.ts` | 默认名改为「当前风格默认」（registry 驱动） |
| `app/account/agents/page.tsx` | 顶部风格选择器 + 上传控件 + 文案读注册表 |
| `app/account/page.tsx` | 入口标题读 `style.framing` |
| `app/workflow/components/chat-stream.tsx` | 文案读注册表 |
| `app/workflow/components/collab-stage.tsx` | 文案读注册表 |
| `app/workflow/components/agent-common.tsx` | 头像解析兼容 data URL / DiceBear URL |

---

## 5. 实施步骤（建议分 3 批，每批 tsc/lint 验证）

- **批 1 · 注册表 + 持久化**：`lib/agent-styles.ts`、`schema` 加列、`/api/agents` 支持 `styleId`、`agents-store` 加 `setStyle`。tsc 验证。
- **批 2 · 做产品生效**：`ai-panel-server.ts` 模板化 + 透传、`ai-discover-server.ts`、`panel.ts`。端到端验证会诊 prompt 随风格变化（curl 实测）。
- **批 3 · UI 选择器 + 上传/链接**：`agents/page.tsx` 风格卡 + 上传、`account/page.tsx`、`chat-stream`、`collab-stage`、`agent-common`。`next build` 验证。

---

## 6. 待确认（见下方选项）

1. **风格套数**：默认 7 套（上表）。是否增删？（如加「喵娘/毒舌」第 8 套，或砍掉某套）
2. **头像图源**：DiceBear 风格化 SVG（推荐，契合+零存储）/ 我额外用 AI 生成写实立绘（最贴合但需落二进制）/ 你给图我接。
3. **选择器落点**：人设管理页顶部（推荐）+ 个人中心入口显示当前风格。
4. **选风格语义**：选风格 = 套用整套预设（覆盖当前 5 位人设），之后仍可逐个微调。是否认可？

> 本方案仅设计，未改动、未提交。确认后按批实施。
