"use client";

/** 浏览器通知封装（仅客户端）。 */

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission {
  return notificationsSupported() ? Notification.permission : "denied";
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

/** 发送一条浏览器通知；点击跳到 link（full page 跳转，保证通知内可用）。 */
export function sendNotification(title: string, body: string, link: string): void {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try {
    const n = new Notification(`🧠 第二大脑 · ${title}`, {
      body,
      tag: "second-brain-reminder",
      icon: undefined,
    });
    n.onclick = () => {
      window.focus();
      if (link) window.location.href = link;
      n.close();
    };
  } catch {
    /* 浏览器不允许时静默 */
  }
}