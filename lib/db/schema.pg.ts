import { pgTable, text, bigint, index } from "drizzle-orm/pg-core";

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

export type UserRow = typeof users.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
