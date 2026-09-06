-- M4：私人资料（端到端加密，服务端只存密文，决策20）
-- salt/iv/ciphertext 为 AES-GCM 加密产物；secret 明文仅存在于用户本地（WebCrypto + 解锁口令）。
-- type/name/hint/tags 为可见元数据，用于脱敏预览与筛选，不含明文机密。
create table if not exists private_data (
  id text primary key,
  user_id text not null,
  type text not null,
  name text not null,
  hint text not null default '',
  tags text not null default '[]',
  salt text not null,
  iv text not null,
  ciphertext text not null,
  created_at bigint not null,
  updated_at bigint not null,
  foreign key (user_id) references users(id) on delete cascade
);

create index if not exists private_data_user_id_idx on private_data (user_id);

-- 行级安全：本表经后端 handler 做 user.sub 归属校验（404/403），此处关闭 RLS 以避免与现有
-- 非 RLS 表策略不一致；若后续统一启用 RLS，需补 policy。
alter table private_data disable row level security;
