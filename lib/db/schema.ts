import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";

// 本地：SQLite（better-sqlite3）。
// PHASE B（线上 Supabase）：另建 lib/db/schema.pg.ts 用 pg-core 镜像下表，
// 并在 lib/db/index.ts 按 DATABASE_URL 切换 postgres-js 驱动，schema 语义保持不变。

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // 整个 builder 工作区快照（flow-store + skeleton-store 的可序列化部分，JSON 字符串）
  data: text("data").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// 用户自定义「后宫智囊团」人设：每个 (user, role) 一行，覆盖默认专家名与头像。
export const agentSettings = sqliteTable(
  "agent_settings",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    name: text("name").notNull(),
    avatarUrl: text("avatar_url"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    userRolePk: primaryKey({ columns: [t.userId, t.role] }),
  })
);

// 用户贡献的知识库条目：上传后进云端共享库（所有用户可见），并记录贡献人邮箱。
// stack / tags 以 JSON 字符串存列（跨 sqlite / pg 通用）。用户自建条目统一 userAdded=true，db 行都源于云端共享。
export const knowledgeEntries = sqliteTable("knowledge_entries", {
  slug: text("slug").primaryKey(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  summary: text("summary"),
  useCase: text("use_case"),
  stack: text("stack"),
  tags: text("tags"),
  status: text("status"),
  updated: text("updated"),
  repoUrl: text("repo_url"),
  source: text("source"),
  contributorEmail: text("contributor_email"),
  body: text("body").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// 用户绑定的腾讯 ima 知识库凭证（每用户一行，按 email 隔离）。
// imaApiKey 为 AES-256-GCM 加密后的密文，明文不出服务端、不落 log。
export const userImaConfig = sqliteTable("user_ima_config", {
  email: text("email").primaryKey(),
  imaClientId: text("ima_client_id").notNull(),
  imaApiKey: text("ima_api_key").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// 第二大脑：用户私有的个人知识笔记（随手记 + AI 自动整理）。
// 与知识库(共享技能库)不同，这里是个人私有、按 userId 隔离、随时间累积的笔记。
export const brainNotes = sqliteTable("brain_notes", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // 来源：text(粘贴/手输) / file(上传) / clip(剪藏) / voice(语音)
  source: text("source").notNull().default("text"),
  title: text("title"),
  // 原始正文，用户"只管往里扔"的未经整理内容
  content: text("content").notNull(),
  // AI 整理结果：分类 / 摘要 / 标签 / 关联建议（关联指向其他笔记 id 或标题）
  category: text("category"),
  summary: text("summary"),
  tags: text("tags"),
  related: text("related"),
  // 版本链：parentId 指向上一版本笔记(id)，null 表示初版；version 从 1 递增
  // 自引用 FK 由 lib/db/index.ts 的原始 DDL 补充（on delete set null）
  parentId: text("parent_id"),
  version: integer("version").notNull().default(1),
  // superseded：0=当前有效版本，1=已被更高版本取代（归档）
  superseded: integer("superseded").notNull().default(0),
  // 代码片段专用字段
  isSnippet: integer("is_snippet").notNull().default(0),
  // 编程语言（python/js/ts/sql/shell 等）
  language: text("language"),
  // 原始代码（不含解释），供高亮与一键复制
  codeContent: text("code_content"),
  // 语义向量（384 维 float 数组的 JSON 字符串）；null 表示未生成，检索降级为关键词
  embedding: text("embedding"),
  // ima 增量同步：来源文档唯一标识 + 最近一次同步时间
  imaDocId: text("ima_doc_id"),
  imaSyncedAt: text("ima_synced_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// 第二大脑：从笔记中 AI 提取的任务项，组成看板。按 userId 隔离，noteId 关联来源笔记。
export const brainTasks = sqliteTable("brain_tasks", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  noteId: text("note_id")
    .notNull()
    .references(() => brainNotes.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: text("status").notNull().default("todo"),
  dueDate: text("due_date"),
  priority: text("priority").notNull().default("medium"),
  createdAt: integer("created_at").notNull(),
  completedAt: integer("completed_at"),
  // 归档标记：笔记被复习后，其 done 任务自动归档（看板隐藏、库内保留）
  archived: integer("archived").notNull().default(0),
  // 关联策略（可选）：删除策略时置空，不删除任务
  strategyId: text("strategy_id").references(() => brainStrategies.id, {
    onDelete: "set null",
  }),
});

// 第二大脑：从会议纪要等输入中 AI 拆解出的策略。按 userId 隔离，noteId 关联来源笔记。
// 一条策略可关联多个任务（brain_tasks.strategyId），构成「纪要 → 策略 → 任务」闭环。
export const brainStrategies = sqliteTable("brain_strategies", {
  id: text("id").primaryKey(),
  noteId: text("note_id")
    .notNull()
    .references(() => brainNotes.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // 策略标题，如"Q3主攻东南亚市场"
  title: text("title").notNull(),
  description: text("description"),
  // active(活跃) / paused(暂停) / achieved(已达成) / abandoned(已放弃)
  status: text("status").notNull().default("active"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// 第二大脑：间隔复习调度（艾宾浩斯遗忘曲线）。每条笔记一条"待复习"记录，复习后按 SM-2 生成下一条。
export const brainReviews = sqliteTable("brain_reviews", {
  id: text("id").primaryKey(),
  noteId: text("note_id")
    .notNull()
    .references(() => brainNotes.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // 下次复习时间（ISO 字符串）
  nextReviewAt: text("next_review_at").notNull(),
  // 间隔天数（1→3→7→15→30→60…）
  interval: integer("interval").notNull(),
  // 熟练度系数（SM-2 ease factor），默认 2.5，上限 3.0
  easeFactor: real("ease_factor").notNull().default(2.5),
  // pending(待复习) / reviewed(已复习) / skipped(已跳过)
  status: text("status").notNull().default("pending"),
  reviewCount: integer("review_count").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

// 用户的 UI 视觉偏好（主题明暗 + 配色预设/覆盖），登录后跨设备同步到服务端。
// custom 存 JSON 字符串：Record<presetId, PaletteOverride>。
export const userPreferences = sqliteTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  theme: text("theme").notNull().default("light"),
  activeStyleId: text("active_style_id").notNull().default("aw-brutalist"),
  custom: text("custom").notNull().default("{}"),
  updatedAt: integer("updated_at").notNull(),
});

// 第二大脑 · 腾讯 ima 知识库增量同步日志：每次同步记录统计与状态。
// 供「最近同步时间 + 结果摘要」展示，不参与业务判定。
export const brainImaSyncLog = sqliteTable("brain_ima_sync_log", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // 同步完成时间（ISO 字符串）
  syncedAt: text("synced_at").notNull(),
  total: integer("total").notNull().default(0),
  created: integer("created").notNull().default(0),
  updated: integer("updated").notNull().default(0),
  skipped: integer("skipped").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  // success / partial / failed
  status: text("status").notNull().default("success"),
  // 失败条目详情（JSON 数组，供展开查看）
  failures: text("failures").notNull().default("[]"),
});

export type UserRow = typeof users.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type AgentSettingRow = typeof agentSettings.$inferSelect;
export type KnowledgeEntryRow = typeof knowledgeEntries.$inferSelect;
export type BrainNoteRow = typeof brainNotes.$inferSelect;
export type BrainTaskRow = typeof brainTasks.$inferSelect;
export type BrainReviewRow = typeof brainReviews.$inferSelect;
export type BrainStrategyRow = typeof brainStrategies.$inferSelect;
export type UserPreferenceRow = typeof userPreferences.$inferSelect;
export type BrainImaSyncLogRow = typeof brainImaSyncLog.$inferSelect;
