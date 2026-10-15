// dev 模式下「浏览器关闭自动停机」的共享状态。
// 用 globalThis 存储，避免 Next dev 的 HMR 重复 import 导致装多个计时器。
// 生产构建下此模块不会被触发（instrumentation 计时器与前端 ping 都是 dev-only），无副作用。

const KEY = "__xiye_dev_heartbeat__";

type HbState = { last: number };

function state(): HbState {
  const g = globalThis as unknown as Record<string, HbState | undefined>;
  if (!g[KEY]) g[KEY] = { last: Date.now() };
  return g[KEY]!;
}

/** 记录一次前端心跳（浏览器还开着） */
export function markHeartbeat(): void {
  state().last = Date.now();
}

/** 最近一次心跳时间戳（ms）。无任何 ping 前的起点为 server 启动时刻。 */
export function getLastHeartbeat(): number {
  return state().last;
}
