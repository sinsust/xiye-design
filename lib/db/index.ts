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
let brainProcessingPlans: any;
let brainReminderItems: any;
let brainSimilarPairs: any;
let brainRelations: any;
let brainCurationLog: any;
let brainTaskOutcomes: any;
let brainWeeklyReviews: any;
let brainLearningReviews: any;
let brainLearningReviewEvents: any;
let brainProactiveState: any;
let brainProactivePreferences: any;
let brainProactiveActions: any;
let brainNotifications: any;
let userPreferences: any;
let userImaConfig: any;
let userFeishuConfig: any;
let flowOpLedger: any;
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
  brainProcessingPlans = schemaPg.brainProcessingPlans;
  brainReminderItems = schemaPg.brainReminderItems;
  brainSimilarPairs = schemaPg.brainSimilarPairs;
  brainRelations = schemaPg.brainRelations;
  brainCurationLog = schemaPg.brainCurationLog;
  brainTaskOutcomes = schemaPg.brainTaskOutcomes;
  brainWeeklyReviews = schemaPg.brainWeeklyReviews;
  brainLearningReviews = schemaPg.brainLearningReviews;
  brainLearningReviewEvents = schemaPg.brainLearningReviewEvents;
  brainProactiveState = schemaPg.brainProactiveState;
  brainProactivePreferences = schemaPg.brainProactivePreferences;
  brainProactiveActions = schemaPg.brainProactiveActions;
  brainNotifications = schemaPg.brainNotifications;
  userPreferences = schemaPg.userPreferences;
  userImaConfig = schemaPg.userImaConfig;
  userFeishuConfig = schemaPg.userFeishuConfig;
  flowOpLedger = schemaPg.flowOpLedger;
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
  // C2 修复：补建 users / projects / agent_settings
  // 此前遗漏这三张表；在 foreign_keys=ON 下，首个引用 users 的 FK 表 CREATE 会因父表不存在而 abort，
  // 导致全新环境（删库/克隆）注册/登录/脑库写入全挂。此处必须位于任何 references users(id) 的表之前。
  sqlite.exec(`create table if not exists users (
    id text primary key,
    email text not null unique,
    password_hash text,
    created_at integer not null
  );`);
  sqlite.exec(`create table if not exists projects (
    id text primary key,
    user_id text not null,
    name text not null,
    data text not null,
    created_at integer not null,
    updated_at integer not null,
    foreign key (user_id) references users(id) on delete cascade
  );`);
  sqlite.exec(`create table if not exists agent_settings (
    user_id text not null,
    role text not null,
    name text not null,
    avatar_url text,
    created_at integer not null,
    updated_at integer not null,
    primary key (user_id, role),
    foreign key (user_id) references users(id) on delete cascade
  );`);
  // F1-A 流程操作幂等台账：同 (user, project, operationId, operationType) 只落一次。
  sqlite.exec(`create table if not exists flow_op_ledger (
    id text primary key,
    user_id text not null,
    project_id text not null,
    operation_id text not null,
    operation_type text not null,
    result_json text,
    applied_at integer not null,
    foreign key (user_id) references users(id) on delete cascade
  );`);
  sqlite.exec(`create unique index if not exists flow_op_ledger_unique
    on flow_op_ledger (user_id, project_id, operation_id, operation_type);`);
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
  // 阶段升级：收件箱来源/产出链路列（P2-A，幂等补列，已存在则忽略错误）
  for (const col of [
    `alter table brain_inbox_items add column processing_plan_id text`,
    `alter table brain_inbox_items add column output_task_ids text`,
    `alter table brain_inbox_items add column output_reminder_ids text`,
    `alter table brain_inbox_items add column output_project_id text`,
    `alter table brain_inbox_items add column converted_at integer`,
    `alter table brain_inbox_items add column failed_reason text`,
  ]) {
    try {
      sqlite.exec(col);
    } catch {
      /* 列已存在 */
    }
  }
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
  // P3-A：项目优先级与目标摘要（幂等补列，列已存在则忽略错误）
  for (const col of [
    `alter table brain_projects add column priority text not null default 'medium'`,
    `alter table brain_projects add column objective text`,
  ]) {
    try {
      sqlite.exec(col);
    } catch {
      /* 列已存在 */
    }
  }
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
  // —— P0 统一信息加工确认闭环（幂等建表）——
  sqlite.exec(`create table if not exists brain_processing_plans (
    id text primary key,
    user_id text not null,
    raw_content text not null,
    input_type text,
    plan_json text not null,
    edits_json text,
    status text not null default 'pending_confirmation',
    source text not null default 'workbench',
    note_id text,
    task_ids text,
    strategy_ids text,
    reminder_ids text,
    project_id text,
    failure_reason text,
    recovery text,
    created_at integer not null,
    apply_at integer,
    updated_at integer not null
  );`);
  // 阶段升级：plans 软归档列（幂等补列，列已存在则忽略错误）
  try {
    sqlite.exec(`alter table brain_processing_plans add column archived_at integer`);
  } catch {
    /* 列已存在 */
  }
  sqlite.exec(`create table if not exists brain_reminder_items (
    id text primary key,
    user_id text not null,
    title text not null,
    remind_at text,
    due_date text,
    note_id text,
    task_id text,
    plan_id text,
    done integer not null default 0,
    status text not null default 'pending',
    created_at integer not null,
    read_at integer
  );`);
  // —— P2-B 相似内容 / 关系建议 / 过期整理审计（幂等建表）——
  sqlite.exec(`create table if not exists brain_similar_pairs (
    id text primary key,
    user_id text not null,
    note_id_a text not null,
    note_id_b text not null,
    score real not null,
    method text not null default 'keyword',
    status text not null default 'suggested',
    created_at integer not null,
    decided_at integer,
    foreign key (user_id) references users(id) on delete cascade,
    foreign key (note_id_a) references brain_notes(id) on delete cascade,
    foreign key (note_id_b) references brain_notes(id) on delete cascade
  );`);
  sqlite.exec(`create table if not exists brain_relations (
    id text primary key,
    user_id text not null,
    type text not null,
    source_id text not null,
    source_type text not null,
    target_id text not null,
    target_type text not null,
    note text,
    status text not null default 'suggested',
    created_at integer not null,
    decided_at integer,
    foreign key (user_id) references users(id) on delete cascade
  );`);
  sqlite.exec(`create table if not exists brain_curation_log (
    id text primary key,
    user_id text not null,
    note_id text not null,
    reason text not null,
    threshold_days integer not null,
    stale_days integer not null,
    action text not null,
    created_at integer not null,
    decided_at integer not null,
    foreign key (user_id) references users(id) on delete cascade,
    foreign key (note_id) references brain_notes(id) on delete cascade
  );`);
  // P3-B：任务结果沉淀表（幂等建表，兼容旧库升级）
  sqlite.exec(`create table if not exists brain_task_outcomes (
    id text primary key,
    user_id text not null,
    task_id text not null,
    project_id text,
    note_id text,
    status text not null,
    summary text not null,
    detail text,
    idem_key text,
    created_at integer not null,
    updated_at integer not null,
    foreign key (user_id) references users(id) on delete cascade,
    foreign key (task_id) references brain_tasks(id) on delete cascade,
    foreign key (project_id) references brain_projects(id) on delete set null,
    foreign key (note_id) references brain_notes(id) on delete set null
  );`);
  // P3-C：周报复盘表（幂等建表；(userId, weekKey) 同周仅保留一版，覆盖旧值）
  sqlite.exec(`create table if not exists brain_weekly_reviews (
    id text primary key,
    user_id text not null,
    week_key text not null,
    week_label text not null,
    period_start integer not null,
    period_end integer not null,
    summary text not null,
    payload_json text not null,
    created_at integer not null,
    updated_at integer not null,
    foreign key (user_id) references users(id) on delete cascade
  );`);
  sqlite.exec(`create unique index if not exists brain_weekly_reviews_user_week_uidx on brain_weekly_reviews (user_id, week_key);`);
  // P4-B：学习笔记复习闭环（幂等建表 + 索引；独立于普通 SM-2 复习）
  sqlite.exec(`create table if not exists brain_learning_reviews (
    id text primary key,
    user_id text not null,
    note_id text not null,
    stage integer not null default 0,
    interval_days integer not null,
    next_review_at integer not null,
    last_reviewed_at integer,
    review_count integer not null default 0,
    status text not null default 'active',
    created_at integer not null,
    updated_at integer not null,
    foreign key (user_id) references users(id) on delete cascade,
    foreign key (note_id) references brain_notes(id) on delete cascade
  );`);
  sqlite.exec(`create index if not exists brain_learning_reviews_user_id_idx on brain_learning_reviews (user_id);`);
  sqlite.exec(`create index if not exists brain_learning_reviews_user_note_idx on brain_learning_reviews (user_id, note_id);`);
  sqlite.exec(`create index if not exists brain_learning_reviews_user_next_idx on brain_learning_reviews (user_id, next_review_at);`);
  // P4-B：学习复习历史（可追溯每次复习动作；级联随复习/笔记删除）
  sqlite.exec(`create table if not exists brain_learning_review_events (
    id text primary key,
    user_id text not null,
    review_id text not null,
    note_id text not null,
    reviewed_at integer not null,
    action text not null,
    stage_before integer not null,
    stage_after integer not null,
    next_review_at integer not null,
    foreign key (user_id) references users(id) on delete cascade,
    foreign key (review_id) references brain_learning_reviews(id) on delete cascade,
    foreign key (note_id) references brain_notes(id) on delete cascade
  );`);
  sqlite.exec(`create index if not exists brain_learning_review_events_user_id_idx on brain_learning_review_events (user_id);`);
  sqlite.exec(`create index if not exists brain_learning_review_events_review_id_idx on brain_learning_review_events (review_id);`);
  // P4-C：主动风险简报（幂等建表 + 索引；独立于全部业务对象，仅消费真实数据）
  sqlite.exec(`create table if not exists brain_proactive_state (
    id text primary key,
    user_id text not null,
    brief_key text not null,
    type text not null,
    title text not null,
    summary text not null,
    severity text not null default 'medium',
    score real not null default 0,
    reasons_json text not null default '[]',
    target_type text not null,
    target_id text not null,
    project_id text,
    link text not null,
    primary_action_json text not null default '{}',
    action_status text,
    created_at integer not null,
    foreign key (user_id) references users(id) on delete cascade
  );`);
  sqlite.exec(`create index if not exists brain_proactive_state_user_created_idx on brain_proactive_state (user_id, created_at);`);
  sqlite.exec(`create index if not exists brain_proactive_state_user_brief_key_idx on brain_proactive_state (user_id, brief_key);`);
  sqlite.exec(`create table if not exists brain_proactive_preferences (
    id text primary key,
    user_id text not null,
    type text not null,
    scope text not null,
    target_type text,
    target_id text,
    project_id text,
    week_key text not null,
    created_at integer not null,
    foreign key (user_id) references users(id) on delete cascade
  );`);
  sqlite.exec(`create index if not exists brain_proactive_preferences_user_scope_idx on brain_proactive_preferences (user_id, type, week_key);`);
  sqlite.exec(`create table if not exists brain_proactive_actions (
    id text primary key,
    user_id text not null,
    brief_id text,
    action text not null,
    scope text not null,
    brief_type text not null,
    target_type text not null,
    target_id text,
    project_id text,
    created_at integer not null,
    foreign key (user_id) references users(id) on delete cascade
  );`);
  sqlite.exec(`create index if not exists brain_proactive_actions_user_idx on brain_proactive_actions (user_id);`);
  // P4：站内通知队列（幂等建表 + 索引支持按用户/去重键检索）
  sqlite.exec(`create table if not exists brain_notifications (
    id text primary key,
    user_id text not null,
    type text not null,
    title text not null,
    detail text,
    link text,
    ref_type text,
    ref_id text,
    reason text,
    status text not null default 'new',
    priority text not null default 'medium',
    dedup_key text not null,
    delivered_at integer,
    snoozed_until integer,
    completed_at integer,
    attempts integer not null default 0,
    last_error text,
    created_at integer not null,
    updated_at integer not null,
    foreign key (user_id) references users(id) on delete cascade
  );`);
  sqlite.exec(`create index if not exists brain_notifications_user_status_idx on brain_notifications (user_id, status);`);
  sqlite.exec(`create index if not exists brain_notifications_user_dedup_idx on brain_notifications (user_id, dedup_key);`);
  // H2 修复：去重硬兜底（原仅 SELECT 再 INSERT，非原子，竞态下可突破每日上限/产生重复通知）。
  // 先剔除同 (user_id, dedup_key, 当日) 的历史重复行，保证唯一索引可建；随后以「每日唯一索引」兜底：
  // 竞态下第二次 INSERT 触发 UNIQUE 异常，被 insertBrainNotification 的 try/catch 吞掉返回 null，不产生重复行。
  sqlite.exec(`delete from brain_notifications where id not in (
    select min(id) from brain_notifications
    group by user_id, dedup_key, date(created_at / 1000, 'unixepoch')
  );`);
  sqlite.exec(`create unique index if not exists brain_notifications_user_dedup_day_idx
    on brain_notifications (user_id, dedup_key, date(created_at / 1000, 'unixepoch'));`);
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
  brainProcessingPlans = schemaSqlite.brainProcessingPlans;
  brainReminderItems = schemaSqlite.brainReminderItems;
  brainSimilarPairs = schemaSqlite.brainSimilarPairs;
  brainRelations = schemaSqlite.brainRelations;
  brainCurationLog = schemaSqlite.brainCurationLog;
  brainTaskOutcomes = schemaSqlite.brainTaskOutcomes;
  brainWeeklyReviews = schemaSqlite.brainWeeklyReviews;
  brainLearningReviews = schemaSqlite.brainLearningReviews;
  brainLearningReviewEvents = schemaSqlite.brainLearningReviewEvents;
  brainProactiveState = schemaSqlite.brainProactiveState;
  brainProactivePreferences = schemaSqlite.brainProactivePreferences;
  brainProactiveActions = schemaSqlite.brainProactiveActions;
  brainNotifications = schemaSqlite.brainNotifications;
  userPreferences = schemaSqlite.userPreferences;
  userImaConfig = schemaSqlite.userImaConfig;
  userFeishuConfig = schemaSqlite.userFeishuConfig;
  flowOpLedger = schemaSqlite.flowOpLedger;
  schema = schemaSqlite;
}

export { db, users, projects, agentSettings, knowledgeEntries, brainNotes, brainTasks, brainReviews, brainStrategies, brainImaSyncLog, brainInboxItems, brainProjects, brainTaskTimeline, brainTaskComments, brainReminderRules, brainReminderLog, brainNoteAccessLog, brainProcessingPlans, brainReminderItems, brainSimilarPairs, brainRelations, brainCurationLog, brainTaskOutcomes, brainWeeklyReviews, brainLearningReviews, brainLearningReviewEvents, brainProactiveState, brainProactivePreferences, brainProactiveActions, brainNotifications, userPreferences, userImaConfig, userFeishuConfig, flowOpLedger, schema };
