-- 登录/注册迁移 Supabase Auth：业务侧 users.password_hash 改可空。
-- 密码改由 Supabase 托管后，新注册的 profile 该列为空；存量 bcrypt 账号迁移后亦置空。
alter table public.users alter column password_hash drop not null;