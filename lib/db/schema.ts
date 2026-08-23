import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

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

export type UserRow = typeof users.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
