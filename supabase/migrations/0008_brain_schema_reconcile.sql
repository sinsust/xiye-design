-- 0008 第二大脑 PG schema 对齐（与 lib/db/schema.pg.ts 对齐；幂等可重复执行）
-- 背景：supabase/migrations/0005 的 brain_notes/brain_tasks 缺 10 列、0007 的 brain_processing_plans
-- 缺 archived_at，且 brain_strategies / brain_reviews / brain_ima_sync_log / brain_inbox_items /
-- brain_projects / brain_task_timeline / brain_task_comments / brain_notifications /
-- brain_proactive_state / brain_proactive_preferences / brain_proactive_actions 从未被任何建表脚本创建。
-- 线上（Vercel + Postgres）运行时不自愈，纯 .sql 轨道下写操作会因缺表/缺列而崩。
-- 本迁移幂等补齐，可安全重复执行。运行时 lib/db/index.ts 也会自愈（DATABASE_RECONCILE=0 可关闭）。

-- ===== 缺失表补齐 =====
CREATE TABLE IF NOT EXISTS brain_projects (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  priority text NOT NULL DEFAULT 'medium',
  objective text,
  color text NOT NULL DEFAULT '#3B82F6',
  start_date text,
  due_date text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS brain_projects_user_id_idx ON brain_projects(user_id);

CREATE TABLE IF NOT EXISTS brain_strategies (
  id text PRIMARY KEY,
  note_id text NOT NULL REFERENCES brain_notes(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS brain_strategies_user_id_idx ON brain_strategies(user_id);

CREATE TABLE IF NOT EXISTS brain_reviews (
  id text PRIMARY KEY,
  note_id text NOT NULL REFERENCES brain_notes(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  next_review_at text NOT NULL,
  interval integer NOT NULL,
  ease_factor double precision NOT NULL DEFAULT 2.5,
  status text NOT NULL DEFAULT 'pending',
  review_count integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS brain_reviews_user_id_idx ON brain_reviews(user_id);
CREATE INDEX IF NOT EXISTS brain_reviews_note_id_idx ON brain_reviews(note_id);

CREATE TABLE IF NOT EXISTS brain_ima_sync_log (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  synced_at text NOT NULL,
  total integer NOT NULL DEFAULT 0,
  created integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  failures text NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS brain_ima_sync_log_user_id_idx ON brain_ima_sync_log(user_id);

CREATE TABLE IF NOT EXISTS brain_inbox_items (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raw_content text NOT NULL,
  intent text,
  suggested_title text,
  suggested_category text,
  suggested_tags text,
  organized text,
  note_id text,
  task_id text,
  status text NOT NULL DEFAULT 'pending',
  created_at bigint NOT NULL,
  processed_at bigint,
  processing_plan_id text,
  output_task_ids text,
  output_reminder_ids text,
  output_project_id text,
  converted_at bigint,
  failed_reason text
);
CREATE INDEX IF NOT EXISTS brain_inbox_items_user_id_idx ON brain_inbox_items(user_id);
CREATE INDEX IF NOT EXISTS brain_inbox_items_status_idx ON brain_inbox_items(user_id, status);
CREATE INDEX IF NOT EXISTS brain_inbox_items_plan_id_idx ON brain_inbox_items(user_id, processing_plan_id);

CREATE TABLE IF NOT EXISTS brain_task_timeline (
  id text PRIMARY KEY,
  task_id text NOT NULL REFERENCES brain_tasks(id) ON DELETE CASCADE,
  action text NOT NULL,
  detail text,
  created_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS brain_task_timeline_task_id_idx ON brain_task_timeline(task_id);

CREATE TABLE IF NOT EXISTS brain_task_comments (
  id text PRIMARY KEY,
  task_id text NOT NULL REFERENCES brain_tasks(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS brain_task_comments_task_id_idx ON brain_task_comments(task_id);

CREATE TABLE IF NOT EXISTS brain_notifications (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  detail text,
  link text,
  ref_type text,
  ref_id text,
  reason text,
  status text NOT NULL DEFAULT 'new',
  priority text NOT NULL DEFAULT 'medium',
  dedup_key text NOT NULL,
  delivered_at bigint,
  snoozed_until bigint,
  completed_at bigint,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS brain_notifications_user_id_idx ON brain_notifications(user_id);
CREATE INDEX IF NOT EXISTS brain_notifications_user_dedup_idx ON brain_notifications(user_id, dedup_key);

CREATE TABLE IF NOT EXISTS brain_proactive_state (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brief_key text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  score double precision NOT NULL DEFAULT 0,
  reasons_json text NOT NULL DEFAULT '[]',
  target_type text NOT NULL,
  target_id text NOT NULL,
  project_id text,
  link text NOT NULL,
  primary_action_json text NOT NULL DEFAULT '{}',
  action_status text,
  created_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS brain_proactive_state_user_created_idx ON brain_proactive_state(user_id, created_at);
CREATE INDEX IF NOT EXISTS brain_proactive_state_user_brief_key_idx ON brain_proactive_state(user_id, brief_key);

CREATE TABLE IF NOT EXISTS brain_proactive_preferences (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  scope text NOT NULL,
  target_type text,
  target_id text,
  project_id text,
  week_key text NOT NULL,
  created_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS brain_proactive_preferences_user_scope_idx ON brain_proactive_preferences(user_id, type, week_key);

CREATE TABLE IF NOT EXISTS brain_proactive_actions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brief_id text,
  action text NOT NULL,
  scope text NOT NULL,
  brief_type text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  project_id text,
  created_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS brain_proactive_actions_user_id_idx ON brain_proactive_actions(user_id);

-- ===== 漂移列补齐 =====
ALTER TABLE brain_notes ADD COLUMN IF NOT EXISTS parent_id text REFERENCES brain_notes(id) ON DELETE SET NULL;
ALTER TABLE brain_notes ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE brain_notes ADD COLUMN IF NOT EXISTS superseded integer NOT NULL DEFAULT 0;
ALTER TABLE brain_notes ADD COLUMN IF NOT EXISTS is_snippet integer NOT NULL DEFAULT 0;
ALTER TABLE brain_notes ADD COLUMN IF NOT EXISTS language text;
ALTER TABLE brain_notes ADD COLUMN IF NOT EXISTS code_content text;
ALTER TABLE brain_notes ADD COLUMN IF NOT EXISTS embedding text;
ALTER TABLE brain_notes ADD COLUMN IF NOT EXISTS ima_doc_id text;
ALTER TABLE brain_notes ADD COLUMN IF NOT EXISTS ima_synced_at text;
ALTER TABLE brain_notes ADD COLUMN IF NOT EXISTS struct text;

ALTER TABLE brain_tasks ADD COLUMN IF NOT EXISTS archived integer NOT NULL DEFAULT 0;
ALTER TABLE brain_tasks ADD COLUMN IF NOT EXISTS strategy_id text REFERENCES brain_strategies(id) ON DELETE SET NULL;
ALTER TABLE brain_tasks ADD COLUMN IF NOT EXISTS project_id text REFERENCES brain_projects(id) ON DELETE SET NULL;
ALTER TABLE brain_tasks ADD COLUMN IF NOT EXISTS assignee text;
ALTER TABLE brain_tasks ADD COLUMN IF NOT EXISTS start_date text;
ALTER TABLE brain_tasks ADD COLUMN IF NOT EXISTS milestone text;
ALTER TABLE brain_tasks ADD COLUMN IF NOT EXISTS parent_task_id text REFERENCES brain_tasks(id) ON DELETE SET NULL;
ALTER TABLE brain_tasks ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE brain_tasks ADD COLUMN IF NOT EXISTS estimated_hours double precision;
ALTER TABLE brain_tasks ADD COLUMN IF NOT EXISTS actual_hours double precision;

ALTER TABLE brain_processing_plans ADD COLUMN IF NOT EXISTS archived_at bigint;
