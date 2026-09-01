-- 第二大脑 Supabase(PG) 缺失表补齐 DDL
-- 由 lib/db/schema.pg.ts 生成；在 Supabase → SQL Editor 整体执行即可（幂等可重复）。
-- 覆盖：联想相似对 / 关系建议 / 过期整理审计 / 任务结果 / 周报复盘 / 学习复习 / 复习历史 / 流程幂等台账

-- 1) 联想·相似笔记对
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

-- 2) 关系建议
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

-- 3) 过期整理审计
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

-- 4) 任务结果沉淀
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

-- 5) 周报复盘（按 user+week 幂等每周一版）
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

-- 6) 学习笔记复习闭环
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

-- 7) 学习复习历史
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

-- 8) 流程操作幂等台账
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

-- 9) 表格分析会话缓存（修复 Serverless 冷启动/多实例导致的 410 table_expired）
-- 仅本用户可读写自己的会话；防串读由应用层 userId 校验兜底（与本项目其他 brain_* 表一致，不启用 RLS）。
CREATE TABLE IF NOT EXISTS brain_table_sessions (
  id          text PRIMARY KEY,
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload     text NOT NULL,          -- base64(gzip(json(CacheEntry)))
  expires_at  bigint NOT NULL,
  created_at  bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS brain_table_sessions_user_id_idx ON brain_table_sessions(user_id);
CREATE INDEX IF NOT EXISTS brain_table_sessions_exp_idx ON brain_table_sessions(expires_at);

-- RLS + owner policy（双保险）：本项目 Supabase 对新建表默认启用 RLS。
-- 持久层（lib/table/session-persist.ts）实际用 service_role 客户端直写，绕过 RLS；
-- 此处 policy 作为双保险——即使未来回退到 anon 客户端，已登录用户也能读写本人行，
-- 未登录/他人 tableId 被 RLS 拒绝，提供 DB 层防串读。
ALTER TABLE brain_table_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS brain_table_sessions_owner ON brain_table_sessions;
CREATE POLICY brain_table_sessions_owner ON brain_table_sessions
  FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);