// P4 通知队列 / 站内通知中心服务。
// 目标：让“适度主动、绝不打扰”成立 —— 所有通知可追溯（brain_notifications 为唯一事实来源）、
// 可跳转真实对象、可解释原因、稳定去重、每日上限、失败重试；严格按 userId 隔离。
// 本轮为 BASE 切片：只做数据模型 + 队列 + 状态机 + API/验证。
// 触发源复用 lib/brain-reminder 的 checkReminders（真实数据 → 提醒），不重写业务规则。

import { db, brainNotifications } from "@/lib/db";
import { and, eq, gte } from "drizzle-orm";
import { checkReminders, isInQuietHours } from "./brain-reminder";
import {
  insertBrainNotification,
  listBrainNotifications,
  getBrainNotification,
  updateBrainNotification,
  countUnreadBrainNotifications,
  type BrainNotification,
  type BrainNotificationStatus,
  type BrainNotificationRefType,
} from "./brain-db";

export type {
  BrainNotification,
  BrainNotificationStatus,
  BrainNotificationRefType,
} from "./brain-db";

export const NOTIFICATION_DAILY_CAP = 20;
export const DEDUP_WINDOW_MS = 24 * 3600_000;

export interface NotificationInput {
  type: string;
  title: string;
  detail?: string | null;
  link?: string | null;
  refType?: BrainNotificationRefType | null;
  refId?: string | null;
  reason?: string | null;
  priority?: "high" | "medium" | "low";
  dedupKey: string;
}

export type NotificationAction =
  | "read"
  | "defer"
  | "snooze"
  | "done"
  | "ignore"
  | "unread";

export interface EnqueueResult {
  created: BrainNotification | null;
  skipped: boolean;
  skipReason?: string;
}

function localMidnight(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const REASON_EN: Record<string, string> = {
  task_overdue: "规则：任务今天到期且未完成",
  task_due_soon: "规则：任务明天到期（提前 24h 提醒）",
  review_due: "规则：笔记复习已到期",
  inbox_backlog: "规则：收件箱积压超过 5 条待处理",
  strategy_review: "规则：策略超 30 天未更新",
  knowledge_decay: "规则：笔记可能已被遗忘（60 天未访问）",
  project_milestone: "规则：里程碑任务临近截止",
  task_complete_followup: "规则：已完成任务待复盘（完成 7 天）",
  reminder_item: "规则：用户设定的单条提醒到时间",
};
function reasonFor(type: string, fallback: string | null): string {
  return REASON_EN[type] ?? fallback ?? `规则触发：${type}`;
}

/**
 * 入队一条通知。幂等：
 *  - 同 dedupKey 在 24h 窗口内已有记录 → 跳过（同一对象/规则不漏、不重复打扰）；
 *  - 当日已入队数 ≥ 每日上限 → 跳过（低打扰护栏）。
 * 严格按 userId 隔离。无 LLM 参与。
 */
export async function enqueueNotification(
  userId: string,
  input: NotificationInput,
  now = Date.now(),
): Promise<EnqueueResult> {
  try {
    // 1) 去重：同键在 24h 窗口内已入队 → 跳过
    const dup = (await db
      .select({ id: brainNotifications.id })
      .from(brainNotifications)
      .where(
        and(
          eq(brainNotifications.userId, userId),
          eq(brainNotifications.dedupKey, input.dedupKey),
          gte(brainNotifications.createdAt, now - DEDUP_WINDOW_MS),
        ),
      )
      .limit(1)) as { id: string }[];
    if (dup.length) return { created: null, skipped: true, skipReason: "dedup" };

    // 2) 每日上限：今日已入队数 ≥ 上限 → 跳过
    const todayStart = localMidnight(now);
    const todayRows = (await db
      .select({ id: brainNotifications.id })
      .from(brainNotifications)
      .where(
        and(eq(brainNotifications.userId, userId), gte(brainNotifications.createdAt, todayStart)),
      )
      .limit(NOTIFICATION_DAILY_CAP + 1)) as { id: string }[];
    if (todayRows.length >= NOTIFICATION_DAILY_CAP) {
      return { created: null, skipped: true, skipReason: "daily_cap" };
    }

    const created = await insertBrainNotification(userId, {
      type: input.type,
      title: input.title,
      detail: input.detail ?? null,
      link: input.link ?? null,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      reason: input.reason ?? null,
      priority: input.priority ?? "medium",
      dedupKey: input.dedupKey,
      status: "new",
      deliveredAt: now,
    });
    return { created, skipped: false };
  } catch (err) {
    console.error("[notify] enqueue failed:", err);
    return { created: null, skipped: true, skipReason: "error" };
  }
}

/**
 * 扫描真实数据 → 把应触发的提醒入队为通知。
 * 复用 checkReminders（任务/复习/收件箱/策略/里程碑/理财产品等规则触发 + reminder_item），
 * 全部带可解释 reason 与跳转 link；同样受去重与每日上限约束。非本人隔离由 db 层保证。
 * 输出今日是否处于免打扰（供前端决定浏览器/系统推送，站内中心始终完整保留）。
 */
export async function checkAndDeliverNotifications(
  userId: string,
  now = Date.now(),
): Promise<{
  enqueued: number;
  inQuietHours: boolean;
  today: string;
  skipped: { type: string; reason: string }[];
}> {
  const { reminders, inQuietHours, today } = await checkReminders(userId);
  const skipped: { type: string; reason: string }[] = [];
  let enqueued = 0;
  for (const r of reminders) {
    const refType: BrainNotificationRefType | null =
      r.type === "reminder_item" ? "reminder_item" : null;
    const res = await enqueueNotification(
      userId,
      {
        type: r.type,
        title: r.title.replace(/^⏰\s*/, ""),
        detail: r.detail,
        link: r.link,
        refType,
        refId: r.reminderId ?? null,
        reason: reasonFor(r.type, null),
        priority: (r.priority ?? "medium") as "high" | "medium" | "low",
        dedupKey: r.reminderId ? `${r.type}:${r.reminderId}` : `${r.type}:${today}`,
      },
      now,
    );
    if (res.skipped) skipped.push({ type: r.type, reason: res.skipReason ?? "unknown" });
    else enqueued++;
  }
  return { enqueued, inQuietHours, today, skipped };
}

/** 拉取通知中心数据：先扫描入队最新提醒，再返回活跃通知 + 未读计数 + 免打扰状态。 */
export async function getNotificationCenter(
  userId: string,
  now = Date.now(),
): Promise<{
  notifications: BrainNotification[];
  unread: number;
  inQuietHours: boolean;
  today: string;
  dailyCap: number;
  scanned: { enqueued: number; skipped: { type: string; reason: string }[] };
}> {
  const scanned = await checkAndDeliverNotifications(userId, now);
  const notifications = await listBrainNotifications(userId, { limit: 50 });
  const unread = await countUnreadBrainNotifications(userId);
  const settings = await import("./brain-reminder").then((m) => m.getReminderSettings(userId));
  const inQuietHours = isInQuietHours(settings.quietHoursStart, settings.quietHoursEnd, new Date(now));
  return {
    notifications,
    unread,
    inQuietHours,
    today: scanned.today,
    dailyCap: NOTIFICATION_DAILY_CAP,
    scanned: { enqueued: scanned.enqueued, skipped: scanned.skipped },
  };
}

/**
 * 通知动作（状态机）。严格隔离：非本人返回 null。
 *  - read    → status=read
 *  - unread  → status=new（撤消已读）
 *  - defer   → status=deferred（稍后查看，保留在列表）
 *  - snooze  → status=snoozed + snoozedUntil = now + opts.days 天（期间不再打扰）
 *  - done    → status=done + completedAt（完成/关闭）
 *  - ignore  → status=ignored + completedAt（忽略，不再打扰）
 */
export async function applyNotificationAction(
  userId: string,
  id: string,
  action: NotificationAction,
  opts: { days?: number } = {},
): Promise<BrainNotification | null> {
  const cur = await getBrainNotification(userId, id);
  if (!cur) return null;
  const now = Date.now();
  const patch: { status: BrainNotificationStatus; completedAt?: number | null; snoozedUntil?: number | null } = { status: "read" };
  switch (action) {
    case "read":
      patch.status = "read";
      break;
    case "unread":
      patch.status = "new";
      break;
    case "defer":
      patch.status = "deferred";
      break;
    case "snooze": {
      const days = Math.max(1, Math.min(opts.days ?? 1, 30));
      patch.status = "snoozed";
      patch.snoozedUntil = now + days * 86400_000;
      break;
    }
    case "done":
      patch.status = "done";
      patch.completedAt = now;
      break;
    case "ignore":
      patch.status = "ignored";
      patch.completedAt = now;
      break;
  }
  return updateBrainNotification(userId, id, patch);
}

/** 批量动作，返回处理成功数。 */
export async function applyNotificationBatch(
  userId: string,
  ids: string[],
  action: NotificationAction,
  opts: { days?: number } = {},
): Promise<number> {
  let n = 0;
  for (const id of ids) {
    const r = await applyNotificationAction(userId, id, action, opts);
    if (r) n++;
  }
  return n;
}

/** date 过滤辅助（供 API 查询今日/历史用）。 */
export function listNotificationsSince(
  userId: string,
  since: number,
  limit = 50,
): Promise<BrainNotification[]> {
  return listBrainNotifications(userId, { limit });
}