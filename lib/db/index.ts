// 双模式数据库层：
// - 设置了 DATABASE_URL → 走 Supabase Postgres（postgres-js 驱动），用于 Vercel 线上部署；
// - 否则 → 回退本地 better-sqlite3 文件库，用于本地零运维开发。
// 两个驱动均按需「动态 import」，确保 Vercel 构建期永远不会触碰 better-sqlite3 原生模块。
// 业务代码只需 `import { db, users, projects } from "@/lib/db"`，无需关心底层方言。

const isPg = Boolean(process.env.DATABASE_URL);

let db: any;
let users: any;
let projects: any;
let schema: any;

if (isPg) {
  const [{ drizzle }, postgresMod, schemaPg] = await Promise.all([
    import("drizzle-orm/postgres-js"),
    import("postgres"),
    import("./schema.pg"),
  ]);
  const client = postgresMod.default(process.env.DATABASE_URL!, { prepare: false });
  db = drizzle(client, { schema: schemaPg });
  users = schemaPg.users;
  projects = schemaPg.projects;
  schema = schemaPg;
} else {
  const [{ default: Database }, { drizzle: drizzleSqlite }, schemaSqlite] =
    await Promise.all([
      import("better-sqlite3"),
      import("drizzle-orm/better-sqlite3"),
      import("./schema"),
    ]);
  const sqlite = new Database(process.env.SQLITE_PATH || "./xiye.db");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  db = drizzleSqlite(sqlite, { schema: schemaSqlite });
  users = schemaSqlite.users;
  projects = schemaSqlite.projects;
  schema = schemaSqlite;
}

export { db, users, projects, schema };
