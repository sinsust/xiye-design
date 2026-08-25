-- 第二大脑 + 用户 UI 偏好等缺失表。
-- 对应 lib/db/schema.pg.ts。running：与 migrations/0003 一并已在 reconcile 脚本幂等执行过。

create table if not exists knowledge_entries (
  slug             text primary key,
  type             text not null,
  name             text not null,
  summary          text,
  use_case         text,
  stack            text,
  tags             text,
  status           text,
  updated          text,
  repo_url         text,
  source           text,
  contributor_email text,
  body             text not null,
  created_at       bigint not null,
  updated_at       bigint not null
);
create index if not exists knowledge_entries_type_idx on knowledge_entries(type);

create table if not exists brain_notes (
  id         text primary key,
  user_id    text not null references users(id) on delete cascade,
  source     text not null default 'text',
  title      text,
  content    text not null,
  category   text,
  summary    text,
  tags       text,
  related    text,
  created_at bigint not null,
  updated_at bigint not null
);
create index if not exists brain_notes_user_id_idx on brain_notes(user_id);

create table if not exists brain_tasks (
  id           text primary key,
  user_id      text not null references users(id) on delete cascade,
  note_id      text not null references brain_notes(id) on delete cascade,
  title        text not null,
  status       text not null default 'todo',
  due_date     text,
  priority     text not null default 'medium',
  created_at   bigint not null,
  completed_at bigint
);
create index if not exists brain_tasks_user_id_idx on brain_tasks(user_id);

create table if not exists user_preferences (
  user_id         text primary key references users(id) on delete cascade,
  theme           text not null default 'light',
  active_style_id text not null default 'aw-brutalist',
  custom          text not null default '{}',
  updated_at      bigint not null
);
create index if not exists user_preferences_user_id_idx on user_preferences(user_id);