import { defineConfig } from "drizzle-kit";

// Supabase / Postgres 迁移配置（用于 drizzle-kit push / generate）。
// 用法：DATABASE_URL=... npx drizzle-kit push --config drizzle.pg.config.ts
// 本地开发仍用默认 drizzle.config.ts（SQLite）。

export default defineConfig({
  schema: "./lib/db/schema.pg.ts",
  out: "./drizzle/pg",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
