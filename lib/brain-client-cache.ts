// 轻量前端请求缓存：避免详情页反复打开同一笔记时重复打昂贵的后端查询
// （provenance / curate / learning-reviews 都是纯 DB 串行查询，非 AI 重算）。
// 注意：这不是 AI 结果缓存，内容基于已存数据，DB 不变则不会变——仅用于去重节流。

type Entry = { ts: number; data: unknown };

const TTL = 60_000; // 60s
const store = new Map<string, Entry>();

export function readBrainCache<T>(key: string): T | null {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > TTL) {
    store.delete(key);
    return null;
  }
  return e.data as T;
}

export function writeBrainCache(key: string, data: unknown): void {
  store.set(key, { ts: Date.now(), data });
}

export function clearBrainCache(key: string): void {
  store.delete(key);
}
