-- 0009: 补齐 schema.pg.ts 声明、但既不在 migrations(0001-0008) 也不在
-- 运行时自愈(pg-schema-reconcile.ts) 中的 11 张表，使「仅应用 migrations」的
-- 干净 Supabase 环境也能获得完整 schema（流程幂等 / 学习复习 / 策展 / 表格会话 /
-- IMA / 飞书 / 相似关系 / 周报 / 任务结果 不再在运行时炸）。
--
-- 全部 IF NOT EXISTS / IF NOT EXISTS INDEX，重复应用零副作用；
-- 与运行时 reconcile 共存（reconcile 用 IF NOT EXISTS，不会冲突）。
-- FK 仅引用已存在的表（users / brain_notes / brain_tasks，来自 0001-0008）；
-- brain_task_outcomes.project_id → brain_projects，故此处一并创建 brain_projects
-- （reconcile 也会创建，幂等，不冲突）。

-- user_ima_config（IMA 知识库 OAuth，按 email 隔离）
CREATE TABLE IF NOT EXISTS user_ima_config (
  email text PRIMARY KEY,
  ima_client_id text NOT NULL,
  ima_api_key text NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- user_feishu_config（飞书自建应用 OAuth，按 userId 隔离）
CREATE TABLE IF NOT EXISTS user_feishu_config (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  access_token_enc text NOT NULL,
  refresh_token_enc text NOT NULL,
  expires_at bigint NOT NULL DEFAULT 0,
  scope text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- brain_similar_pairs（P2-B 相似内容）
CREATE TABLE IF NOT EXISTS brain_similar_pairs (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_id_a text NOT NULL REFERENCES brain_notes(id) ON DELETE CASCADE,
  note_id_b text NOT NULL REFERENCES brain_notes(id) ON DELETE CASCADE,
  score double precision NOT NULL,
  method text NOT NULL DEFAULT 'keyword',
  status text NOT NULL DEFAULT 'suggested',
  created_at bigint NOT NULL,
  decided_at bigint
);
CREATE INDEX IF NOT EXISTS brain_similar_pairs_user_id_idx ON brain_similar_pairs(user_id);
CREATE INDEX IF NOT EXISTS brain_similar_pairs_note_idx ON brain_similar_pairs(user_id, note_id_a, note_id_b);

-- brain_relations（P2-B 关系建议）
CREATE TABLE IF NOT EXISTS brain_relations (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  source_id text NOT NULL,
  source_type text NOT NULL,
  target_id text NOT NULL,
  target_type text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'suggested',
  created_at bigint NOT NULL,
  decided_at bigint
);
CREATE INDEX IF NOT EXISTS brain_relations_user_id_idx ON brain_relations(user_id);
CREATE INDEX IF NOT EXISTS brain_relations_src_idx ON brain_relations(user_id, source_id, source_type);

-- brain_curation_log（P2-B 过期整理审计）
CREATE TABLE IF NOT EXISTS brain_curation_log (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_id text NOT NULL REFERENCES brain_notes(id) ON DELETE CASCADE,
  reason text NOT NULL,
  threshold_days integer NOT NULL,
  stale_days integer NOT NULL,
  action text NOT NULL,
  created_at bigint NOT NULL,
  decided_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS brain_curation_log_user_id_idx ON brain_curation_log(user_id);
CREATE INDEX IF NOT EXISTS brain_curation_log_note_id_idx ON brain_curation_log(user_id, note_id);

-- brain_weekly_reviews（P3-C 周报复盘，按 (userId, weekKey) 幂等）
CREATE TABLE IF NOT EXISTS brain_weekly_reviews (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_key text NOT NULL,
  week_label text NOT NULL,
  period_start bigint NOT NULL,
  period_end bigint NOT NULL,
  summary text NOT NULL,
  payload_json text NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS brain_weekly_reviews_user_id_idx ON brain_weekly_reviews(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS brain_weekly_reviews_user_week_uidx ON brain_weekly_reviews(user_id, week_key);

-- brain_learning_reviews（P4-B 学习笔记复习闭环）
CREATE TABLE IF NOT EXISTS brain_learning_reviews (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_id text NOT NULL REFERENCES brain_notes(id) ON DELETE CASCADE,
  stage integer NOT NULL DEFAULT 0,
  interval_days integer NOT NULL,
  next_review_at bigint NOT NULL,
  last_reviewed_at bigint,
  review_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS brain_learning_reviews_user_id_idx ON brain_learning_reviews(user_id);
CREATE INDEX IF NOT EXISTS brain_learning_reviews_user_note_idx ON brain_learning_reviews(user_id, note_id);
CREATE INDEX IF NOT EXISTS brain_learning_reviews_user_next_idx ON brain_learning_reviews(user_id, next_review_at);

-- brain_learning_review_events（P4-B 学习复习历史）
CREATE TABLE IF NOT EXISTS brain_learning_review_events (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  review_id text NOT NULL REFERENCES brain_learning_reviews(id) ON DELETE CASCADE,
  note_id text NOT NULL REFERENCES brain_notes(id) ON DELETE CASCADE,
  reviewed_at bigint NOT NULL,
  action text NOT NULL,
  stage_before integer NOT NULL,
  stage_after integer NOT NULL,
  next_review_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS brain_learning_review_events_user_id_idx ON brain_learning_review_events(user_id);
CREATE INDEX IF NOT EXISTS brain_learning_review_events_review_id_idx ON brain_learning_review_events(review_id);

-- flow_op_ledger（F1-A 流程操作幂等台账）
CREATE TABLE IF NOT EXISTS flow_op_ledger (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  operation_id text NOT NULL,
  operation_type text NOT NULL,
  result_json text,
  applied_at bigint NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS flow_op_ledger_unique ON flow_op_ledger(user_id, project_id, operation_id, operation_type);

-- brain_table_sessions（表格分析会话缓存）
CREATE TABLE IF NOT EXISTS brain_table_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload text NOT NULL,
  expires_at bigint NOT NULL,
  created_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS brain_table_sessions_user_id_idx ON brain_table_sessions(user_id);
CREATE INDEX IF NOT EXISTS brain_table_sessions_exp_idx ON brain_table_sessions(expires_at);

-- brain_projects（原仅由运行时 reconcile 创建；此处纳入迁移，
-- 使 flow_op_ledger/brain_task_outcomes 的 FK 在干净环境即可解析）
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

-- brain_task_outcomes（P3-B 任务结果沉淀）
CREATE TABLE IF NOT EXISTS brain_task_outcomes (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id text NOT NULL REFERENCES brain_tasks(id) ON DELETE CASCADE,
  project_id text REFERENCES brain_projects(id) ON DELETE SET NULL,
  note_id text REFERENCES brain_notes(id) ON DELETE SET NULL,
  status text NOT NULL,
  summary text NOT NULL,
  detail text,
  idem_key text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS brain_task_outcomes_user_id_idx ON brain_task_outcomes(user_id);
CREATE INDEX IF NOT EXISTS brain_task_outcomes_task_id_idx ON brain_task_outcomes(user_id, task_id);
