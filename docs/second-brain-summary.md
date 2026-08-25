# 第二大脑（Second Brain）子系统 · 技术实现总结

> 用途：便于 AI 协作/评审。仅描述技术栈与已实现能力，不含本地绝对路径。

## 一、产品定位

本产品的「第二大脑」是一个 **AI 驱动的个人私域知识系统**，核心价值：**「只管往里扔，AI 帮你理清楚、记得住、用得上」**。
- 用户把会议纪要、学习笔记、临时想法等**任意原始文本**随手丢进来；
- AI 自动完成 **分类 / 摘要 / 打标签 / 关联建议**，用户确认后入库；
- 之后可基于**该用户自己的全部笔记**做 **RAG 问答**；
- 并附带 **自动周报**、**学习路径可视化** 两个输出层能力。

它承载在一个 Next.js 全栈单体应用内，`/brain` 为独立路线，与平台级「共享知识库」（`/library`）天然隔离。

---

## 二、技术栈

| 层 | 选型 |
|---|---|
| 前端 | Next.js（App Router）+ React 18 + TypeScript + Tailwind CSS + lucide-react 图标 |
| 后端 | Next.js API Route（Node.js 运行时，`export const runtime = "nodejs"`） |
| 数据库 | **双模式** SQLite（本地，`better-sqlite3` + Drizzle ORM）+ PostgreSQL（生产，`postgres-js`），同一份 schema 双镜像 |
| ORM | Drizzle ORM |
| AI | OpenAI 兼容的 Chat Completions（默认 Qwen 系），经 `LLM_MODEL_BASE_URL / LLM_MODEL_API_KEY / LLM_MODEL_MODEL_ID` 三个环境变量接入 |
| 检索 | 中文友好的轻量关键词双向匹配（无外置向量库，MVP 足够） |
| 认证 | 服务端 `getSessionUser()`，用户唯一标识 `user.sub` |
| 权限 | 私有笔记按 `userId` 硬隔离，仅本人可见/编辑/删除 |

---

## 三、数据模型

`brain_notes` 表（用户私有笔记，按 `userId` 隔离）：

```
id        text PK      # "bn-<base36时间戳>-<随机4位>"
user_id   text +index  # 归属用户，级联删除
source    text         # text(粘贴/手输) / file(上传) / clip(剪藏) / voice(语音)
title     text
content   text NOT NULL # 原始未整理全文
category  text         # AI 分类，如「工作/学习/技术/设计/生活/灵感/随手记」
summary   text         # AI 一句话摘要
tags      text         # JSON 数组
related   text         # JSON 数组，指向其他笔记 id（关联建议）
created_at integer
updated_at integer
```

对外（API/UI）序列化为 `BrainNote`：
```ts
interface BrainNote {
  id: string; userId: string; source: "text"|"file"|"clip"|"voice";
  title: string; content: string; category: string; summary: string;
  tags: string[]; related: string[]; createdAt: number; updatedAt: number;
}
```

---

## 四、后端能力（API）

| 路由 | 方法 | 作用 |
|---|---|---|
| `/api/brain/notes` | GET | 当前用户全部私有笔记（服务端已按 userId 过滤） |
| `/api/brain/notes` | POST | 新增笔记（必填 content，可选 title/category/summary/tags/related/source） |
| `/api/brain/notes?id=` | PUT | 部分更新（未传字段保留原值） |
| `/api/brain/notes?id=` | DELETE | 删除笔记（仅本人） |
| `/api/brain/organize` | POST | **AI 整理草稿**：原始文本 → `{ draft: { title, category, summary, tags, related, relatedReason } }`，不落库，返回给前端确认 |
| `/api/brain/ask` | POST | **私有 RAG 问答**：`{ question }` → `{ answer, hits }`，只检索当前用户笔记 |
| `/api/brain/report` | GET | **自动周报**：`{ report, source }`，基于本周工作类笔记生成 |

三个模块化 lib：

1. **`lib/brain-db.ts`** — 数据访问层，所有读写都带 `userId` 过滤（硬隔离）。
2. **`lib/brain-organizer.ts`** — AI 整理管线。**Qwen 优先 + 启发式兜底**：
   - Qwen 命中环境变量时，system prompt 要求输出严格 JSON（title/category/summary/tags/related/relatedReason）；
   - 未配置或调用失败时，回退本地启发式（首行作标题、关键词分类、2-6 字中文关键词打标），**保证永远能返回可用结构**；
   - 关联建议：先由 LLM 从用户已有笔记里选 id；AI 未给出时用关键词重合度启发式补。
3. **`lib/brain-rag.ts`** — 私有问答检索。中文友好：对问题/笔记各取关键词，用 **2 字滑窗**判定「笔记是否覆盖问题词」「问题是否覆盖笔记词」，双向打分排序，取 Top N 拼进 prompt。命中不足则返回本地引导（不空耗 LLM token）。
4. **`lib/brain-report.ts`** — 周报引擎。自动圈定「本周」（周一零点起），优先取工作类笔记；LLM 生成 `{ weekLabel, summary, completed[], decisions[], blockers[], next[] }`；失败回退启发式。
5. **`lib/brain-path.ts`** — 学习路径。纯本地规则，从笔记标题/摘要/标签/正文按关键词聚出主题（Python / 易经…），按时间排成学习节点。

**关键检索实现（brain-rag）**：
```ts
// 中文关键词用 2 字滑窗判定是否出现在全文
function covers(kw: string, hay: string): boolean {
  const k = kw.toLowerCase();
  if (/^[a-z0-9+.-]+$/.test(k)) return hay.includes(k);
  for (let i = 0; i <= k.length - 2; i++) {
    if (hay.includes(k.slice(i, i + 2))) return true;
  }
  return false;
}
// 双向打分：问题关键词命中笔记(2分) + 笔记关键词命中问题(1分)
function scoreNote(n, questionLower) {
  const qkws = keywords(questionLower);
  const nText = `${n.title} ${n.category} ${n.summary} ${n.content}`.toLowerCase();
  const nkws = keywords(nText, 24);
  let s = 0;
  for (const kw of qkws) if (covers(kw, nText)) s += 2;
  for (const kw of nkws) if (covers(kw, questionLower)) s += 1;
  return s;
}
```

**关键整理调用（organizer）**：
```ts
const res = await fetch(`${baseUrl}/chat/completions`, {
  method: "POST",
  headers: { "Content-Type": "application/json",
             Authorization: `Bearer ${process.env.LLM_MODEL_API_KEY}` },
  body: JSON.stringify({
    model: process.env.LLM_MODEL_MODEL_ID,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "你是『第二大脑』的策展助手…输出严格 JSON：title/category/summary/tags/related/relatedReason" },
      { role: "user", content: JSON.stringify({ raw: content, existingNotes: existing.map(n => ({id,title,summary})) }) },
    ],
  }),
  signal: AbortSignal.timeout(25000),
});
```

---

## 五、前端能力（UI，`components/second-brain.tsx`）

单页区块布局（`/brain`），`lg` 三列栅格 + 顶部两个功能卡：

1. **顶部·自动周报卡**：一键「生成本周周报」；结果含周区间、一句话总览，以及「本周完成 / 关键决策 / 问题与阻塞 / 下周计划」四分区；底部「依据 N 条笔记」可折叠展开来源；支持重新生成。
2. **左侧列**：
   - **随手记输入**：大文本框，粘贴任意内容 → 「帮我整理」；
   - **整理草稿确认**：展示 AI 产出的 标题/分类/标签/摘要/关联（带主题色），确认后「入库」；
   - **问我的第二大脑**：自然语言提问 → 基于私有笔记 RAG 回答，支持 Enter 发送，过程中有加载态。
3. **右侧列**：分类统计标签、知识图谱（复用 `knowledge-graph.tsx`，个人笔记局部图谱）、笔记卡片列表（标题/摘要/分类色/来源/相对时间/标签，点开看原文+编辑+删除）。
4. **学习路径区块**：自动聚类出的主题卡（如 ☯易经 / 🐍Python），含主题色图标、篇数、最近学习时间、竖向时间线（圆点+标题+摘要），可点击展开。
5. **编辑弹窗**：标题 + 原文 monospace 编辑。

**UI 设计约定**：全部使用主题 token（`var(--primary)` / `--border` / `--muted-foreground` / `--background` / 圆角 `var(--radius)`），卡片式，分类用 `color-mix` 主题色着色，随明暗主题自适应。

---

## 六、工程 / 安全要点

- **蓝图**：`lib/db/schema.ts`（sqlite）+ `lib/db/schema.pg.ts`（pg 镜像），sqlite 侧幂等 `create table if not exists`，零运维自举。
- **权限**：每个 API 入口先 `await getSessionUser()`；所有 DB 操作绑定 `userId`，从根上杜绝越权。
- **健壮性**：所有 AI 调用带超时（`AbortSignal.timeout`）+ try/catch 兜底；RAG/organize/report 都有本地启发式回退，**LLM 不可用时系统仍可用**（只是降级）。
- **可扩展**：检索层为纯函数、无外置依赖，后续可平滑替换为向量检索（Embedding + 向量库）；`related`/`tags` 用 JSON 存储，兼容 Obsidian frontmatter 习惯。

---

## 七、下一步可开发方向（未实现）

1. **间隔复习（遗忘曲线）**：为笔记建模 `reviewAt`，按规则的间隔重复推送需复习的知识点。
2. **学习路径增强**：为题加学习阶段（入门/进阶/实战）与进度百分比；或接遗忘曲线做「该复习的主题」提醒。
3. **周报增强**：导出 Markdown/复制；按自定义时间段生成；每条结论标注来源笔记；较上周变化对比。
4. **RAG 升级**：接入向量库 + Embedding，语义检索取代当前关键词匹配（数据量大后）。
5. **多源输入**：文件上传（Word/PDF/TXT）、浏览器剪藏、语音转写入口。