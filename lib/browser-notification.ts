"use client";

/**
 * 浏览器通知封装（仅客户端）。
 *
 * P4-D：浏览器通知权限与降级。
 *  - 附加渠道：只有站内通知中心是事实来源；浏览器通知仅在已生成站内通知且为高优先级时
 *    才可能弹出，失败 / 未授权 / 不支持一律降级为站内通知。
 *  - 权限态：unsupported / default / granted / denied（四态）。
 *  - 会话去重：同一通知 id 在当前会话只显示一次，SPA 重挂载不重复弹；登出或切换用户时清理。
 *  - 安全跳转：浏览器通知点击仅允许跳转到本站内部链接。
 *  - 关键判定（shouldAttemptBrowserPush / safeInternalLink / 去重读写）均为纯逻辑，
 *    可在无浏览器环境（Node 验证脚本）中离线测试。
 */

export type PushPermissionState = "unsupported" | "default" | "granted" | "denied";

/** 浏览器是否支持 Web Notification。 */
export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** 原兼容导出：不支持时视为 denied。 */
export function notificationPermission(): NotificationPermission {
  return notificationsSupported() ? Notification.permission : "denied";
}

/** 统一四态权限态：unsupported / default / granted / denied。 */
export function getPushPermissionState(): PushPermissionState {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

/** 请求通知权限，返回是否已授权。 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  try {
    const p = await Notification.requestPermission();
    return p === "granted";
  } catch {
    return false;
  }
}

/**
 * 判定是否应尝试弹出一条浏览器通知（纯函数，可在无浏览器环境验证）。
 *
 * 规则（低打扰原则）：
 *  - 支持且已授权：state === "granted"
 *  - 非免打扰时段：!inQuiet
 *  - 站内通知处于 new（未读）
 *  - 优先级属于最高档（topTiers，默认 ["high"]；
 *    现有通知优先级模型为 high / medium / low，high 即最高档。
 *    若未来数据模型引入更高级别（如 critical），调用方可传入 ["high","critical"]，无需改本判定。）
 *
 * 该函数只负责「该不该尝试」。真正弹不弹由调用方在满足该条件时调用 sendNotification；
 * 沿用站内通知中心作为单一事实来源，尝试之外不再拦截。
 */
export function shouldAttemptBrowserPush(opts: {
  state: PushPermissionState;
  inQuiet: boolean;
  status: string;
  priority: string;
  topTiers?: ReadonlyArray<string>;
}): boolean {
  const tiers = opts.topTiers ?? ["high"];
  if (opts.state === "unsupported" || opts.state !== "granted") return false;
  if (opts.inQuiet) return false;
  if (opts.status !== "new") return false;
  return tiers.includes(opts.priority);
}

// ---------------- 当前会话去重（sessionStorage） ----------------

// 持久化键前缀；加入 userId 隔离，登出/切换用户各用各的桶，互不串扰。
const SESSION_PREFIX = "second-brain:push-seen:";

function sessionGet(key: string): string | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function sessionSet(key: string, value: string): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(key, value);
  } catch {
    /* storage 被禁用时静默：去重退化为仅内存不可用，但不会破坏功能 */
  }
}
function sessionDel(key: string): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** 某用户在当前会话中已「出现过」的通知 id 集合（sessionStorage 持久，SPA 重挂载不重复）。 */
export function getSeenPushIds(userId: string): string[] {
  const raw = sessionGet(SESSION_PREFIX + userId);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** 通知 id 是否已在本会话出现过。 */
export function isPushSeen(userId: string, notifId: string): boolean {
  return getSeenPushIds(userId).includes(notifId);
}

/** 标记某通知 id 已在本会话出现（去重上限 200 条，防无限膨胀）。 */
export function markPushSeen(userId: string, notifId: string): void {
  const ids = getSeenPushIds(userId);
  if (ids.includes(notifId)) return;
  ids.push(notifId);
  sessionSet(SESSION_PREFIX + userId, JSON.stringify(ids.slice(-200)));
}

/** 登出 / 用户切换时清理某用户的本地去重记录。 */
export function clearPushSession(userId: string): void {
  sessionDel(SESSION_PREFIX + userId);
}

// ---------------- 安全跳转 ----------------

/**
 * 归一化为本站安全内部链接（纯函数，可在无浏览器环境验证）。
 *  - 以 / 开头的站内相对路径：原样返回
 *  - 与 origin 同源的绝对 URL：剥离为 pathname+search+hash
 *  - 外部站、javascript: / data: / 其它协议：降级为 "/brain"
 */
export function safeInternalLink(link: string | null | undefined, origin?: string): string {
  if (!link) return "/brain";
  if (link.startsWith("/")) return link;
  try {
    const base = origin ?? (typeof window !== "undefined" ? window.location.origin : undefined);
    if (!base) return "/brain";
    const u = new URL(link, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "/brain";
    if (u.origin !== base) return "/brain";
    return u.pathname + u.search + u.hash;
  } catch {
    return "/brain";
  }
}

/**
 * 发送一条浏览器通知；未授权 / 不支持时静默降级（站内通知中心仍保留）。
 * 点击仅跳转站内安全链接，阻断外部跳转。
 */
export function sendNotification(title: string, body: string, link: string): void {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try {
    const target = safeInternalLink(link);
    const n = new Notification(`🧠 第二大脑 · ${title}`, {
      body,
      tag: "second-brain-reminder",
      icon: undefined,
    });
    n.onclick = () => {
      window.focus();
      window.location.href = target;
      n.close();
    };
  } catch {
    /* 浏览器不允许时静默 */
  }
}