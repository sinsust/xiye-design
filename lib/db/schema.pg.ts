import { pgTable, text, bigint, index, primaryKey } from "drizzle-orm/pg-core";

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

export type UserRow = typeof users.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type AgentSettingRow = typeof agentSettings.$inferSelect;
export type KnowledgeEntryRow = typeof knowledgeEntries.$inferSelect;
