import { defineConfig } from "drizzle-kit";

// Supabase / Postgres 专属配置：用于把 lib/db/schema.pg.ts 定义的表
// 一次性物化到 Supabase 实例（本地 sqlite 靠启动期 create table 自动建，
// 但 Postgres 路径不会自动建表，必须 drizzle-kit push 一次，否则线上库无表）。
//
// 用法（本地执行，需先 export 你的 Supabase 连接串）：
//   export DATABASE_URL="postgresql://postgres:[密码]@db.xxx.supabase.co:6543/postgres"
//   npm run db:push:pg
// 注意：用 6543 事务池端口；不要用 5432+pgbouncer=true（session 池易打满，审计 R-2）。
export default defineConfig({
  schema: "./lib/db/schema.pg.ts",
  out: "./drizzle/pg",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
