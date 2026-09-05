-- 批次2 (P1 #3): 跨实例限流持久化 —— 替代内存 Map
-- 背景：lib/rate-limit.ts 原用进程内 Map，Vercel Serverless 多容器/冷启动下不共享、
--       实例回收即清零，生产限流失效。改为共享存储（Supabase）后跨实例一致。
--
-- 本迁移提供：
--   1) rate_limits 表：按 key 记录窗口起点与命中数
--   2) check_rate_limit 原子 RPC：单次 upsert + 窗口过期重置 + 返回是否放行
--      （单条 plpgsql 事务，Postgres 在 PK 冲突上行级串行，无并发竞态）
-- 全部幂等，可重复执行。

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key          text        PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  hits         integer     NOT NULL DEFAULT 1,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limits_updated_at_idx
  ON public.rate_limits (updated_at);

-- 仅经 service_role（SECURITY DEFINER RPC）访问，关闭 RLS 避免 anon 受约束。
ALTER TABLE public.rate_limits DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key       text,
  p_limit     integer,
  p_window_ms integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now     timestamptz := now();
  v_window  interval     := (p_window_ms::text || ' milliseconds')::interval;
  v_hits    integer;
  v_allowed boolean;
BEGIN
  INSERT INTO public.rate_limits (key, window_start, hits)
  VALUES (p_key, v_now, 1)
  ON CONFLICT (key) DO UPDATE
    SET hits = CASE
          WHEN public.rate_limits.window_start < v_now - v_window
          THEN 1
          ELSE public.rate_limits.hits + 1
        END,
        window_start = CASE
          WHEN public.rate_limits.window_start < v_now - v_window
          THEN v_now
          ELSE public.rate_limits.window_start
        END,
        updated_at = v_now
  RETURNING hits INTO v_hits;

  v_allowed := v_hits <= p_limit;

  -- 最佳努力清理：约 1% 调用触发，删一批（最多 1000 行）过期数据，避免表无限增长。
  -- 不影响主路径正确性（活跃 key 的下次命中会被重置复用）。
  -- 注：Postgres 的 DELETE 不支持 LIMIT，用 ctid 子查询限定批大小。
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits
    WHERE ctid IN (
      SELECT ctid FROM public.rate_limits
      WHERE updated_at < v_now - interval '1 hour'
      LIMIT 1000
    );
  END IF;

  RETURN v_allowed;
END;
$$;

-- 可选：用 pg_cron 周期清理（无 pg_cron 可忽略，RPC 内 1% 触发已兜底）：
-- SELECT cron.schedule('rate_limits_cleanup', '*/10 * * * *',
--   $$ DELETE FROM public.rate_limits WHERE updated_at < now() - interval '1 hour' LIMIT 5000; $$);
