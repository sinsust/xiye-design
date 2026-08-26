-- 0007 第二大脑 · P0 统一加工确认闭环 + 提醒系统（Postgres 补表）
-- 对应 lib/db/schema.pg.ts 中缺失的表：brain_processing_plans / brain_reminder_items / brain_reminder_rules / brain_reminder_log / brain_note_access_log
-- 幂等：可重复执行。

create table if not exists brain_processing_plans
(
  id             text primary key,
  user_id        text not null references users (id) on delete cascade,
  raw_content    text not null,
  input_type     text,
  plan_json      text not null,
  edits_json     text,
  status         text not null default 'pending_confirmation',
  source         text not null default 'workbench',
  note_id        text,
  task_ids       text,
  strategy_ids   text,
  reminder_ids   text,
  project_id     text,
  failure_reason text,
  recovery       text,
  created_at     bigint not null,
  apply_at       bigint,
  updated_at     bigint not null
);
create index if not exists brain_processing_plans_user_id_idx on brain_processing_plans (user_id);
create index if not exists brain_processing_plans_status_idx on brain_processing_plans (user_id, status);

create table if not exists brain_reminder_items
(
  id         text primary key,
  user_id    text not null references users (id) on delete cascade,
  title      text not null,
  remind_at  text,
  due_date   text,
  note_id    text,
  task_id    text,
  plan_id    text,
  done       integer not null default 0,
  status     text not null default 'pending',
  created_at bigint not null,
  read_at    bigint
);
create index if not exists brain_reminder_items_user_id_idx on brain_reminder_items (user_id);

create table if not exists brain_reminder_rules
(
  id               text primary key,
  user_id          text not null references users (id) on delete cascade,
  type             text not null,
  enabled          integer not null default 1,
  advance_minutes  integer,
  quiet_hours_start text,
  quiet_hours_end  text,
  created_at       bigint not null
);
create index if not exists brain_reminder_rules_user_id_idx on brain_reminder_rules (user_id);

create table if not exists brain_reminder_log
(
  id         text primary key,
  user_id    text not null references users (id) on delete cascade,
  type       text not null,
  title      text not null,
  read       integer not null default 0,
  created_at bigint not null,
  read_at    bigint
);
create index if not exists brain_reminder_log_user_id_idx on brain_reminder_log (user_id);

create table if not exists brain_note_access_log
(
  id          text primary key,
  note_id     text not null references brain_notes (id) on delete cascade,
  access_type text not null,
  created_at  bigint not null
);
create index if not exists brain_note_access_log_note_id_idx on brain_note_access_log (note_id);
