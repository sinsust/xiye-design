-- 阶段 B7：AI 调用用量流水（只读统计，不做配额/拦截）
-- BYOK 形态（形态 C 桌面单机）下，API Key 与费用都归用户自己：
-- 本表只回答「我这个月调了多少次、token 花了多少、花在哪个功能」，
-- 不设上限、不做拦截——用多少是用户自己的事，与平台无关。
--
-- 设计要点：
-- 1) 只记成功调用（失败不花钱也不计数），写入 fire-and-forget，失败静默不阻断主流程。
-- 2) model_id 不设外键/级联 —— 用户删除模型配置后，历史流水必须保留，否则统计断档。
-- 3) tokens_in/out 取响应的 usage；端点不返回 usage 时记 0（不因此阻塞）。
-- 4) 按 (user_id, created_at) 建索引：查询形态固定为「某档案 + 某时间窗」。
create table if not exists ai_usage (
  id         text primary key,
  user_id    text,
  feature    text not null default 'unknown',
  model_id   text,
  model_name text,
  provider   text,
  model      text,
  tokens_in  bigint not null default 0,
  tokens_out bigint not null default 0,
  latency_ms bigint not null default 0,
  created_at bigint not null
);

create index if not exists ai_usage_user_id_created_at_idx on ai_usage (user_id, created_at);
create index if not exists ai_usage_feature_idx on ai_usage (feature);
alter table ai_usage disable row level security;
