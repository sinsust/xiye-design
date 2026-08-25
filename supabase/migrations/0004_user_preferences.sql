-- 用户的 UI 视觉偏好（主题明暗 + 配色预设/覆盖），登录后跨设备同步。
-- 对应 lib/db/schema.pg.ts。运行方式：Supabase 控制台 SQL Editor 粘贴执行，或
--   DATABASE_URL=... npx drizzle-kit push --config drizzle.pg.config.ts

create table if not exists user_preferences (
  user_id         text primary key references users(id) on delete cascade,
  theme           text not null default 'light',
  active_style_id text not null default 'aw-brutalist',
  custom          text not null default '{}',
  updated_at      bigint not null
);