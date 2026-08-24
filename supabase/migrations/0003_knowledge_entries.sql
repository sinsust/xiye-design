-- 用户贡献的知识库条目：上传后进云端共享库（所有用户可见），记录贡献人邮箱。
-- 对应 lib/db/schema.pg.ts。运行方式：Supabase 控制台 SQL Editor 粘贴执行，或
--   DATABASE_URL=... npx drizzle-kit push --config drizzle.pg.config.ts

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