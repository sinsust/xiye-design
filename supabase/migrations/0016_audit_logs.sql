-- 阶段 A：全局操作审计日志（商用合规基建，PRD §8）
-- 记录安全敏感操作 + AI 调用流水：认证（登录/注册/改密/重置/登出）、
-- 第三方凭证绑定与解绑（ima / obsidian / 飞书）、私人资料增删、AI 端点调用。
--
-- 设计要点：
-- 1) user_id 可为空 —— 登录失败时还没有可识别用户，仍需留痕（便于发现撞库）。
-- 2) 不设 on delete cascade —— 用户注销后审计记录必须保留，否则失去合规意义。
-- 3) detail 存 JSON 字符串，只写去敏元数据（类型/条数/操作名），严禁落明文机密。
-- 4) 本表只写不读业务；写入失败一律静默，绝不阻断主流程。
create table if not exists audit_logs (
  id          text primary key,
  user_id     text,
  action      text not null,
  target_type text,
  target_id   text,
  detail      text,
  ip          text,
  created_at  bigint not null
);

create index if not exists audit_logs_user_id_idx on audit_logs (user_id);
create index if not exists audit_logs_action_idx on audit_logs (action);
create index if not exists audit_logs_created_at_idx on audit_logs (created_at);
alter table audit_logs disable row level security;
