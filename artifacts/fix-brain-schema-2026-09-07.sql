-- ============================================================================
-- Xiye 第二大脑「新建项目无反应」止血迁移
-- 生成: 2026-09-07  by WorkBuddy (A 方案)
-- 目的: 远端 Supabase/PG 库因表早建于缺列版本，导致 brain_projects / brain_inbox_items
--       查询抛 column ... does not exist，进而「项目」列表为空 + 新建项目静默失败。
-- 用法: 打开 Supabase → SQL Editor → 粘贴本文件全部内容 → Run。幂等可重复。
-- ============================================================================

-- ① brain_projects 缺 priority/objective（项目列表 / 工作台全依赖）
ALTER TABLE brain_projects ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium';
ALTER TABLE brain_projects ADD COLUMN IF NOT EXISTS objective text;

-- ①' brain_notes 缺版本链/片段/向量/obsidian 列（截图实测：insert into brain_notes 报缺列）
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
ALTER TABLE brain_notes ADD COLUMN IF NOT EXISTS obsidian_vault text;
ALTER TABLE brain_notes ADD COLUMN IF NOT EXISTS obsidian_rel_path text;
ALTER TABLE brain_notes ADD COLUMN IF NOT EXISTS obsidian_note_id text;
ALTER TABLE brain_notes ADD COLUMN IF NOT EXISTS obsidian_synced_at text;

-- ② brain_inbox_items 缺「来源/产出链路」6 列（收件箱 / 通知中心查询全崩）
ALTER TABLE brain_inbox_items ADD COLUMN IF NOT EXISTS processing_plan_id text;
ALTER TABLE brain_inbox_items ADD COLUMN IF NOT EXISTS output_task_ids text;
ALTER TABLE brain_inbox_items ADD COLUMN IF NOT EXISTS output_reminder_ids text;
ALTER TABLE brain_inbox_items ADD COLUMN IF NOT EXISTS output_project_id text;
ALTER TABLE brain_inbox_items ADD COLUMN IF NOT EXISTS converted_at bigint;
ALTER TABLE brain_inbox_items ADD COLUMN IF NOT EXISTS failed_reason text;

-- ③ 若上面任何列此前从未建成，补回对应索引（IF NOT EXISTS，安全）
CREATE INDEX IF NOT EXISTS brain_inbox_items_plan_id_idx ON brain_inbox_items(user_id, processing_plan_id);

-- ============================================================================
-- 验证（可选，跑完可执行看是否都返回正常/0 行）
--   select column_name from information_schema.columns
--    where table_name='brain_projects' and column_name in ('priority','objective');
--   select column_name from information_schema.columns
--    where table_name='brain_notes'
--      and column_name in ('parent_id','version','is_snippet','struct','embedding');
--   select column_name from information_schema.columns
--    where table_name='brain_inbox_items'
--      and column_name in ('processing_plan_id','output_task_ids','output_reminder_ids',
--                          'output_project_id','converted_at','failed_reason');
-- ============================================================================
