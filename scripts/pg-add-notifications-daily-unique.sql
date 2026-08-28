-- ============================================================================
-- PG 每日去重唯一索引（brain_notifications）— 对齐本地 sqlite 的 H2 硬兜底
-- 目标：竞态下同日同 (user_id, dedup_key) 的重复通知，再次 INSERT 会被唯一
--       索引拒绝，`insertBrainNotification`(lib/brain-db.ts) 的 try/catch 会
--       吞掉异常返回 null，从而保证「每日最多一条」的原子兜底、不产生重复行。
--
-- 由 lib/db/index.ts:647-652 的 sqlite「每日唯一索引」语义复刻而来。
-- 执行前请先核对：这段 SQL 在 Supabase → SQL Editor 一次性执行即可（幂等）。
-- ============================================================================

-- 0) 可选：先按 UTC 日去重清理历史重复行（否则唯一索引无法创建）。
--    与 sqlite 语义一致：同一 (user_id, dedup_key, 当日 UTC) 仅保留最早一条。
BEGIN;
DELETE FROM brain_notifications
WHERE id NOT IN (
  SELECT min(id)
  FROM brain_notifications
  GROUP BY user_id, dedup_key,
    to_char((to_timestamp(created_at / 1000.0) AT TIME ZONE 'UTC'), 'YYYY-MM-DD')
);
COMMIT;

-- 1) 创建「每日唯一」表达式唯一索引（幂等，可重复执行）。
--    若业务希望按本地日界（如亚洲/上海）来界定"当日"，把 AT TIME ZONE 'UTC'
--    替换为 AT TIME ZONE 'Asia/Shanghai'，且上面的 DELETE 需改成同一表达式。
CREATE UNIQUE INDEX IF NOT EXISTS brain_notifications_user_dedup_day_idx
  ON brain_notifications (
    user_id,
    dedup_key,
    to_char((to_timestamp(created_at / 1000.0) AT TIME ZONE 'UTC'), 'YYYY-MM-DD')
  );

-- 2) 以下原普通去重索引已被唯一索引覆盖（唯一索引天然支持 user_id,dedup_key
--    前缀查询），可选删除以降低写入放大；默认不删，保持非破坏性。
-- DROP INDEX IF EXISTS brain_notifications_user_dedup_idx;