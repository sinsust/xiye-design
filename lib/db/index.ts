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
let brainNotes: any;
let brainTasks: any;
let brainReviews: any;
let brainStrategies: any;
let brainImaSyncLog: any;
let brainInboxItems: any;
let brainProjects: any;
let brainTaskTimeline: any;
let brainTaskComments: any;
let brainReminderRules: any;
let brainReminderLog: any;
let brainNoteAccessLog: any;
let userPreferences: any;
let userImaConfig: any;
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
  brainNotes = schemaPg.brainNotes;
  brainTasks = schemaPg.brainTasks;
  brainReviews = schemaPg.brainReviews;
  brainStrategies = schemaPg.brainStrategies;
  brainImaSyncLog = schemaPg.brainImaSyncLog;
  brainInboxItems = schemaPg.brainInboxItems;
  brainProjects = schemaPg.brainProjects;
  brainTaskTimeline = schemaPg.brainTaskTimeline;
  brainTaskComments = schemaPg.brainTaskComments;
  brainReminderRules = schemaPg.brainReminderRules;
  brainReminderLog = schemaPg.brainReminderLog;
  brainNoteAccessLog = schemaPg.brainNoteAccessLog;
  userPreferences = schemaPg.userPreferences;
  userImaConfig = schemaPg.userImaConfig;
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
  // 本地零运维：直接幂等建表（避免每次手动 drizzle-kit push）
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
  sqlite.exec(`create table if not exists user_ima_config (
    email text primary key,
    ima_client_id text not null,
    ima_api_key text not null,
    created_at integer not null,
    updated_at integer not null
  );`);
  sqlite.exec(`create table if not exists brain_notes (
    id text primary key,
    user_id text not null,
    source text not null default 'text',
    title text,
    content text not null,
    category text,
    summary text,
    tags text,
    related text,
    created_at integer not null,
    updated_at integer not null
  );`);
  // 阶段升级：brain_notes 版本链 + 代码片段字段（幂等补列，已存在则忽略错误）
  for (const col of [
    `alter table brain_notes add column parent_id text references brain_notes(id) on delete set null`,
    `alter table brain_notes add column version integer not null default 1`,
    `alter table brain_notes add column superseded integer not null default 0`,
    `alter table brain_notes add column is_snippet integer not null default 0`,
    `alter table brain_notes add column language text`,
    `alter table brain_notes add column code_content text`,
  ]) {
    try {
      sqlite.exec(col);
    } catch {
      /* 列已存在 */
    }
  }
  // 阶段升级：brain_notes 语义向量列（幂等补列）
  try {
    sqlite.exec(`alter table brain_notes add column embedding text`);
  } catch {
    /* 列已存在 */
  }
  // 阶段升级：brain_notes ima 增量同步列（幂等补列）
  for (const col of [
    `alter table brain_notes add column ima_doc_id text`,
    `alter table brain_notes add column ima_synced_at text`,
  ]) {
    try {
      sqlite.exec(col);
    } catch {
      /* 列已存在 */
    }
  }
  // 阶段升级：brain_notes AI 整理结构化结果列（幂等补列）
  try {
    sqlite.exec(`alter table brain_notes add column struct text`);
  } catch {
    /* 列已存在 */
  }
  sqlite.exec(`create table if not exists brain_ima_sync_log (
    id text primary key,
    user_id text not null,
    synced_at text not null,
    total integer not null default 0,
    created integer not null default 0,
    updated integer not null default 0,
    skipped integer not null default 0,
    failed integer not null default 0,
    status text not null default 'success',
    failures text not null default '[]',
    foreign key (user_id) references users(id) on delete cascade
  );`);
  sqlite.exec(`create table if not exists brain_tasks (
    id text primary key,
    user_id text not null,
    note_id text not null,
    title text not null,
    status text not null default 'todo',
    due_date text,
    priority text not null default 'medium',
    created_at integer not null,
    completed_at integer,
    archived integer not null default 0,
    foreign key (user_id) references users(id) on delete cascade,
    foreign key (note_id) references brain_notes(id) on delete cascade
  );`);
  // 阶段升级：老库的 brain_tasks 无 archived 列，幂等补列（列已存在则忽略错误）
  try {
    sqlite.exec(`alter table brain_tasks add column archived integer not null default 0`);
  } catch {
    /* 列已存在 */
  }
  sqlite.exec(`create table if not exists brain_strategies (
    id text primary key,
    note_id text not null,
    user_id text not null,
    title text not null,
    description text,
    status text not null default 'active',
    created_at integer not null,
    updated_at integer not null,
    foreign key (note_id) references brain_notes(id) on delete cascade,
    foreign key (user_id) references users(id) on delete cascade
  );`);
  // 阶段升级：brain_tasks 的 strategy_id 列（先建 brain_strategies 再补列，保证外键顺序）
  try {
    sqlite.exec(
      `alter table brain_tasks add column strategy_id text references brain_strategies(id) on delete set null`,
    );
  } catch {
    /* 列已存在 */
  }
  sqlite.exec(`create table if not exists brain_reviews (
    id text primary key,
    note_id text not null,
    user_id text not null,
    next_review_at text not null,
    interval integer not null,
    ease_factor real not null default 2.5,
    status text not null default 'pending',
    review_count integer not null default 0,
    created_at integer not null,
    foreign key (note_id) references brain_notes(id) on delete cascade,
    foreign key (user_id) references users(id) on delete cascade
  );`);
  sqlite.exec(`create table if not exists user_preferences (
    user_id text primary key references users(id) on delete cascade,
    theme text not null default 'light',
    active_style_id text not null default 'aw-brutalist',
    custom text not null default '{}',
    updated_at integer not null
  );`);
  sqlite.exec(`create table if not exists brain_inbox_items (
    id text primary key,
    user_id text not null,
    raw_content text not null,
    intent text,
    suggested_title text,
    suggested_category text,
    suggested_tags text,
    organized text,
    note_id text,
    task_id text,
    status text not null default 'pending',
    created_at integer not null,
    processed_at integer,
    foreign key (user_id) references users(id) on delete cascade
  );`);
  // —— 第十阶段：结构化项目管理 ——
  // brain_projects 先于 brain_tasks.project_id 外键创建。
  sqlite.exec(`create table if not exists brain_projects (
    id text primary key,
    user_id text not null,
    name text not null,
    description text,
    status text not null default 'active',
    color text not null default '#3B82F6',
    start_date text,
    due_date text,
    created_at integer not null,
    updated_at integer not null,
    foreign key (user_id) references users(id) on delete cascade
  );`);
  // 阶段升级：brain_tasks 新增项目管理字段（幂等补列，列已存在则忽略错误）
  for (const col of [
    `alter table brain_tasks add column project_id text references brain_projects(id) on delete set null`,
    `alter table brain_tasks add column assignee text`,
    `alter table brain_tasks add column start_date text`,
    `alter table brain_tasks add column milestone text`,
    `alter table brain_tasks add column parent_task_id text references brain_tasks(id) on delete set null`,
    `alter table brain_tasks add column sort_order integer not null default 0`,
    `alter table brain_tasks add column estimated_hours real`,
    `alter table brain_tasks add column actual_hours real`,
  ]) {
    try {
      sqlite.exec(col);
    } catch {
      /* 列已存在 */
    }
  }
  // 任务事件时间线：任务变更自动日志
  sqlite.exec(`create table if not exists brain_task_timeline (
    id text primary key,
    task_id text not null,
    action text not null,
    detail text,
    created_at integer not null,
    foreign key (task_id) references brain_tasks(id) on delete cascade
  );`);
  // 任务备注/评论
  sqlite.exec(`create table if not exists brain_task_comments (
    id text primary key,
    task_id text not null,
    content text not null,
    created_at integer not null,
    foreign key (task_id) references brain_tasks(id) on delete cascade
  );`);
  // —— 第十二阶段：提醒系统 ——
  sqlite.exec(`create table if not exists brain_reminder_rules (
    id text primary key,
    user_id text not null,
    type text not null,
    enabled integer not null default 1,
    advance_minutes integer,
    quiet_hours_start text,
    quiet_hours_end text,
    created_at integer not null
  );`);
  sqlite.exec(`create table if not exists brain_reminder_log (
    id text primary key,
    user_id text not null,
    type text not null,
    title text not null,
    read integer not null default 0,
    created_at integer not null,
    read_at integer
  );`);
  sqlite.exec(`create table if not exists brain_note_access_log (
    id text primary key,
    note_id text not null,
    access_type text not null,
    created_at integer not null
  );`);
  db = drizzleSqlite(sqlite, { schema: schemaSqlite });
  users = schemaSqlite.users;
  projects = schemaSqlite.projects;
  agentSettings = schemaSqlite.agentSettings;
  knowledgeEntries = schemaSqlite.knowledgeEntries;
  brainNotes = schemaSqlite.brainNotes;
  brainTasks = schemaSqlite.brainTasks;
  brainReviews = schemaSqlite.brainReviews;
  brainStrategies = schemaSqlite.brainStrategies;
  brainImaSyncLog = schemaSqlite.brainImaSyncLog;
  brainInboxItems = schemaSqlite.brainInboxItems;
  brainProjects = schemaSqlite.brainProjects;
  brainTaskTimeline = schemaSqlite.brainTaskTimeline;
  brainTaskComments = schemaSqlite.brainTaskComments;
  brainReminderRules = schemaSqlite.brainReminderRules;
  brainReminderLog = schemaSqlite.brainReminderLog;
  brainNoteAccessLog = schemaSqlite.brainNoteAccessLog;
  userPreferences = schemaSqlite.userPreferences;
  userImaConfig = schemaSqlite.userImaConfig;
  schema = schemaSqlite;
}

export { db, users, projects, agentSettings, knowledgeEntries, brainNotes, brainTasks, brainReviews, brainStrategies, brainImaSyncLog, brainInboxItems, brainProjects, brainTaskTimeline, brainTaskComments, brainReminderRules, brainReminderLog, brainNoteAccessLog, userPreferences, userImaConfig, schema };
