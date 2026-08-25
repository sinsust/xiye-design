import { pgTable, text, bigint, integer, doublePrecision, index, primaryKey } from "drizzle-orm/pg-core";

// 线上（Supabase Postgres）镜像 lib/db/schema.ts 的 SQLite 表结构。
// 注意：created_at / updated_at 用 bigint（存储 Date.now() 毫秒值，
// 超过 PG 32 位 integer 上限），与 SQLite 的 64 位 integer 行为保持一致。

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // 整个 builder 工作区快照（flow-store + skeleton-store 的可序列化部分，JSON 字符串）
    data: text("data").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    userIdIdx: index("projects_user_id_idx").on(t.userId),
  })
);

// 用户自定义「后宫智囊团」人设：每个 (user, role) 一行，覆盖默认专家名与头像。
export const agentSettings = pgTable(
  "agent_settings",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    name: text("name").notNull(),
    avatarUrl: text("avatar_url"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    userRolePk: primaryKey({ columns: [t.userId, t.role] }),
  })
);

// 用户贡献的知识库条目：上传后进云端共享库（所有用户可见），并记录贡献人邮箱。
// 与 schema.ts 的 SQLite 镜像（created_at / updated_at 用 bigint 存毫秒）。
export const knowledgeEntries = pgTable("knowledge_entries", {
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
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

// 用户绑定的腾讯 ima 知识库凭证（每用户一行，按 email 隔离）。
// imaApiKey 为 AES-256-GCM 加密后的密文，明文不出服务端、不落 log。
export const userImaConfig = pgTable("user_ima_config", {
  email: text("email").primaryKey(),
  imaClientId: text("ima_client_id").notNull(),
  imaApiKey: text("ima_api_key").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

// 第二大脑：用户私有的个人知识笔记（sqlite 镜像，userId 隔离）。
export const brainNotes = pgTable(
  "brain_notes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    source: text("source").notNull().default("text"),
    title: text("title"),
    content: text("content").notNull(),
    category: text("category"),
    summary: text("summary"),
    tags: text("tags"),
    related: text("related"),
    parentId: text("parent_id"),
    version: integer("version").notNull().default(1),
    superseded: integer("superseded").notNull().default(0),
    isSnippet: integer("is_snippet").notNull().default(0),
    language: text("language"),
    codeContent: text("code_content"),
    embedding: text("embedding"),
    imaDocId: text("ima_doc_id"),
    imaSyncedAt: text("ima_synced_at"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    userIdIdx: index("brain_notes_user_id_idx").on(t.userId),
  })
);

// 第二大脑任务看板（sqlite 镜像，noteId 关联 brain_notes）。
export const brainTasks = pgTable(
  "brain_tasks",
  {
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
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    completedAt: bigint("completed_at", { mode: "number" }),
    archived: integer("archived").notNull().default(0),
    strategyId: text("strategy_id").references(() => brainStrategies.id, {
      onDelete: "set null",
    }),
  },
  (t) => ({
    userIdIdx: index("brain_tasks_user_id_idx").on(t.userId),
  })
);

// 第二大脑：策略管理（纪要 → 策略 → 任务），sqlite 镜像。
export const brainStrategies = pgTable(
  "brain_strategies",
  {
    id: text("id").primaryKey(),
    noteId: text("note_id")
      .notNull()
      .references(() => brainNotes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    userIdIdx: index("brain_strategies_user_id_idx").on(t.userId),
  })
);

// 第二大脑：间隔复习调度（艾宾浩斯遗忘曲线），sqlite 镜像。
export const brainReviews = pgTable(
  "brain_reviews",
  {
    id: text("id").primaryKey(),
    noteId: text("note_id")
      .notNull()
      .references(() => brainNotes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    nextReviewAt: text("next_review_at").notNull(),
    interval: integer("interval").notNull(),
    easeFactor: doublePrecision("ease_factor").notNull().default(2.5),
    status: text("status").notNull().default("pending"),
    reviewCount: integer("review_count").notNull().default(0),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    userIdIdx: index("brain_reviews_user_id_idx").on(t.userId),
    noteIdx: index("brain_reviews_note_id_idx").on(t.noteId),
  })
);

// 用户的 UI 视觉偏好（主题明暗 + 配色预设/覆盖），登录后跨设备同步到服务端。
export const userPreferences = pgTable(
  "user_preferences",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    theme: text("theme").notNull().default("light"),
    activeStyleId: text("active_style_id").notNull().default("aw-brutalist"),
    custom: text("custom").notNull().default("{}"),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    userIdIdx: index("user_preferences_user_id_idx").on(t.userId),
  })
);

// 第二大脑 · 腾讯 ima 知识库增量同步日志（sqlite 镜像）。
export const brainImaSyncLog = pgTable(
  "brain_ima_sync_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    syncedAt: text("synced_at").notNull(),
    total: integer("total").notNull().default(0),
    created: integer("created").notNull().default(0),
    updated: integer("updated").notNull().default(0),
    skipped: integer("skipped").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    status: text("status").notNull().default("success"),
    failures: text("failures").notNull().default("[]"),
  },
  (t) => ({
    userIdIdx: index("brain_ima_sync_log_user_id_idx").on(t.userId),
  })
);

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
