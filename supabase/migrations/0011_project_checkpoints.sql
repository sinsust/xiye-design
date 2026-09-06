-- M2-C：项目检查点（可回退的产物版本快照）
-- 背景：Studio 交付闭环需要「版本 / checkpoint / diff / undo，可回退任意 checkpoint」
--       （PRD 决策 6.2）。本表存每个项目的检查点载荷（整包工作区快照的 JSON）。
--
-- 本迁移提供：
--   1) project_checkpoints 表：按 project 归属，存快照 data（JSON 字符串）+ 可选 label
--   2) project_id 索引，加速「某项目的检查点列表」查询
-- 全部幂等，可重复执行。

CREATE TABLE IF NOT EXISTS public.project_checkpoints (
  id         text    PRIMARY KEY,
  project_id text    NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  user_id    text    NOT NULL,
  data       text    NOT NULL,
  label      text    NOT NULL DEFAULT '',
  created_at bigint  NOT NULL
);

CREATE INDEX IF NOT EXISTS project_checkpoints_project_id_idx
  ON public.project_checkpoints (project_id);

-- 仅经 service_role 访问，关闭 RLS 避免 anon 受约束（handler 内已做 user.sub 归属校验）。
ALTER TABLE public.project_checkpoints DISABLE ROW LEVEL SECURITY;
