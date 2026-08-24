-- 用户自定义「后宫智囊团」人设表
-- 每个 (user_id, role) 一行，覆盖默认专家名与头像图（自定义头像可为 NULL 表示用默认）。

create table if not exists agent_settings (
  user_id    text not null references users(id) on delete cascade,
  role       text not null,
  name       text not null,
  avatar_url text,
  created_at bigint not null,
  updated_at bigint not null,
  primary key (user_id, role)
);