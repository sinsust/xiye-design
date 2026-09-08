// 服务端短 TTL 缓存：用于「提醒 / 简报」等每次页面挂载都会多表全量扫描的只读聚合，
// 把重扫频率从「每次挂载」降到「每 TTL 一次」（P2.3）。
//
// 设计取舍：
// - 审计原文建议「每日一次快照」，但提醒依赖「今天/明天到期」「免打扰时段」等时效性字段，
//   纯日级缓存会让到期/新任务延迟最多 24h。故采用分钟级 TTL（默认 5min），
//   既消除每挂载重扫，又保证时效性。
// - module 级 Map 随 HMR / 重启失效：最坏情况重扫一次，无功能回归；多实例不共享（与现状一致）。

type Entry<T> = { value: T; expires: number };

const store = new Map<string, Entry<unknown>>();

export async function getCached<T>(
  key: string,
  ttlMs: number,
  compute: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > now) return hit.value;
  const value = await compute();
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

/** 使某前缀下的所有缓存条目失效（如数据写操作后主动清缓存）。 */
export function invalidateCache(keyPrefix: string): void {
  for (const k of store.keys()) {
    if (k.startsWith(keyPrefix)) store.delete(k);
  }
}
