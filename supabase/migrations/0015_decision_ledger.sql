-- 阶段 A：决策台账（Decision Ledger，PRD 决策18）
-- 记录项目产品方向上的「已采纳 / 已驳回 / 待验证」决策及其理由，
-- 供 AGENTS.md / CLAUDE.md 注入决策上下文；title 按项目唯一，同名决策幂等更新。
create table if not exists decision_ledger (
  id         text primary key,
  project_id text not null,
  user_id    text not null,
  title      text not null,
  detail     text not null default '',
  status     text not null default 'hypothesis',
  reason     text not null default '',
  created_at bigint not null,
  updated_at bigint not null,
  foreign key (user_id) references users(id) on delete cascade
);

create unique index if not exists decision_ledger_project_title_idx
  on decision_ledger (project_id, title);
alter table decision_ledger disable row level security;