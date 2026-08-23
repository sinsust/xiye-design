-- xiye-design 初始表结构（Supabase Postgres）
-- 对应 lib/db/schema.pg.ts
-- 运行方式：Supabase 控制台 SQL Editor 粘贴执行，或用
--   DATABASE_URL=... npx drizzle-kit push --config drizzle.pg.config.ts

create table if not exists users (
  id            text primary key,
  email         text not null unique,
  password_hash text not null,
  created_at    bigint not null
);

create table if not exists projects (
  id          text primary key,
  user_id     text not null references users(id) on delete cascade,
  name        text not null,
  data        text not null,
  created_at  bigint not null,
  updated_at  bigint not null
);

create index if not exists projects_user_id_idx on projects(user_id);
