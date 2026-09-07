-- M4：私人资料删除审计（决策 20）
-- detail 存 JSON（含被删条目的 name/type 等去敏元数据），不落明文机密；
-- 明细由后端 handler 在删前写入，此处仅建表（服务端只存密文，RLS 关闭与 private_data 一致）。
create table if not exists private_data_audit (
  id              text primary key,
  user_id         text not null,
  private_data_id text,
  action          text not null default 'delete',
  detail          text,
  created_at      bigint not null,
  foreign key (user_id) references users(id) on delete cascade
);

create index if not exists private_data_audit_user_id_idx on private_data_audit (user_id);
alter table private_data_audit disable row level security;