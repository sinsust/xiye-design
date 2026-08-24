// 双模式数据库层：
// - 设置了 Postgres 连接串 → 走 Supabase/Postgres（postgres-js 驱动），用于 Vercel 线上部署；
// - 否则 → 回退本地 better-sqlite3 文件库，用于本地零运维开发。
// 两个驱动均按需「动态 import」，确保 Vercel 构建期永远不会触碰 better-sqlite3 原生模块。
// 业务代码只需 `import { db, users, projects } from "@/lib/db"`，无需关心底层方言。

// Vercel 部署时数据库 URL 可能由不同集成自动注入，这里按优先级兜底识别：
// 1) DATABASE_URL          —— 用户手动设置（推荐，可用 Supabase 池化串）
// 2) POSTGRES_URL          —— Vercel 自带 Postgres Storage（池化）
// 3) SUPABASE_DB_URL       —— Supabase 官方 Vercel 集成（直连）
// 4) POSTGRES_URL_NON_POOLING —— Vercel Postgres 直连
function resolveDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.SUPABASE_DB_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    ""
  );
}

const DATABASE_URL = resolveDatabaseUrl();
const isPg = Boolean(DATABASE_URL);

let db: any;
let users: any;
let projects: any;
let agentSettings: any;
let knowledgeEntries: any;
let schema: any;

if (isPg) {
  const [{ drizzle }, postgresMod, schemaPg] = await Promise.all([
    import("drizzle-orm/postgres-js"),
    import("postgres"),
    import("./schema.pg"),
  ]);
  const client = postgresMod.default(DATABASE_URL, { prepare: false });
  db = drizzle(client, { schema: schemaPg });
  users = schemaPg.users;
  projects = schemaPg.projects;
  agentSettings = schemaPg.agentSettings;
  knowledgeEntries = schemaPg.knowledgeEntries;
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
  // 本地零运维：直接幂等建 knowledge_entries（避免每次手动 drizzle-kit push）
  sqlite.exec(`create table if not exists knowledge_entries (
    slug text primary key,
    type text not null,
    name text not null,
    summary text,
    use_case text,
    stack text,
    tags text,
    status text,
    updated text,
    repo_url text,
    source text,
    contributor_email text,
    body text not null,
    created_at integer not null,
    updated_at integer not null
  );`);
  db = drizzleSqlite(sqlite, { schema: schemaSqlite });
  users = schemaSqlite.users;
  projects = schemaSqlite.projects;
  agentSettings = schemaSqlite.agentSettings;
  knowledgeEntries = schemaSqlite.knowledgeEntries;
  schema = schemaSqlite;
}

export { db, users, projects, agentSettings, knowledgeEntries, schema };
