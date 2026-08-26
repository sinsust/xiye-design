import { and, eq, gte } from "drizzle-orm";
import { db, brainReminderRules, brainReminderLog, brainNoteAccessLog } from "@/lib/db";
import {
  listBrainTasks,
  listBrainNotes,
  listPendingBrainReviews,
  listBrainInboxItems,
  listBrainStrategies,
  listPendingBrainReminderItems,
} from "@/lib/brain-db";

export const REMINDER_TYPES = [
  "task_overdue",
  "task_due_soon",
  "review_due",
  "inbox_backlog",
  "strategy_review",
  "knowledge_decay",
  "project_milestone",
  "task_complete_followup",
] as const;
// 用户确认创建的单条「独立提醒」；不在规则枚举里（无开关，仅展示/触发）
export type ReminderType = (typeof REMINDER_TYPES)[number] | "reminder_item";
export type ReminderPriority = "high" | "medium" | "low";

export interface Reminder {
  type: ReminderType;
  title: string;
  detail: string;
  link: string;
  priority: ReminderPriority;
}

const DAY_MS = 86400_000;

/** 每个类型的默认提前量（分钟）。 */
const DEFAULT_ADVANCE: Record<ReminderType, number> = {
  task_overdue: 0,
  task_due_soon: 1440, // 提前 24 小时
  review_due: 0,
  inbox_backlog: 0,
  strategy_review: 0, // 每周一
  knowledge_decay: 0, // 每周一
  project_milestone: 4320, // 提前 3 天
  task_complete_followup: 10080, // 完成后 7 天
  reminder_item: 0, // 用户确认的单条提醒按设定时刻触发
};
const DEFAULT_PRIORITY: Record<ReminderType, ReminderPriority> = {
  task_overdue: "high",
  task_due_soon: "medium",
  review_due: "medium",
  inbox_backlog: "medium",
  strategy_review: "medium",
  knowledge_decay: "low",
  project_milestone: "medium",
  task_complete_followup: "medium",
  reminder_item: "medium",
};
export const DEFAULT_QUIET_START = "22:00";
export const DEFAULT_QUIET_END = "08:00";

export interface ReminderRule {
  id: string;
  type: ReminderType;
  enabled: boolean;
  advanceMinutes: number | null;
}

export interface ReminderSettings {
  rules: ReminderRule[];
  quietHoursStart: string;
  quietHoursEnd: string;
}

/** 本地日期 YYYY-MM-DD（与 dueDate 存储格式一致）。 */
function localDayStr(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * DAY_MS);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayStr(): string {
  return localDayStr(0);
}
/** 今天本地 0 点对应的 epoch ms。 */
function localMidnight(ts = Date.now()): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 最近一次访问的第 N 天之前（epoch ms）。 */
function daysAgo(days: number): number {
  return Date.now() - days * DAY_MS;
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// —— 规则初始化 / 读取 ——

/** 幂等初始化当前用户的 8 条默认规则（全开 + 默认免打扰）。 */
export async function ensureReminderRules(userId: string): Promise<void> {
  try {
    const existing = (await db
      .select({ type: brainReminderRules.type })
      .from(brainReminderRules)
      .where(eq(brainReminderRules.userId, userId))) as { type: string }[];
    const have = new Set(existing.map((r) => r.type));
    const now = Date.now();
    for (const type of REMINDER_TYPES) {
      if (have.has(type)) continue;
      await db.insert(brainReminderRules).values({
        id: uid("rr"),
        userId,
        type,
        enabled: 1,
        advanceMinutes: DEFAULT_ADVANCE[type],
        quietHoursStart: DEFAULT_QUIET_START,
        quietHoursEnd: DEFAULT_QUIET_END,
        createdAt: now,
      });
    }
  } catch (err) {
    console.error("[reminder] ensure rules failed:", err);
  }
}

/** 读取当前用户规则 + 免打扰时段。 */
export async function getReminderSettings(userId: string): Promise<ReminderSettings> {
  await ensureReminderRules(userId);
  const ruleRows = (await db
    .select()
    .from(brainReminderRules)
    .where(eq(brainReminderRules.userId, userId))) as Array<{
    id: string;
    type: string;
    enabled: number;
    advanceMinutes: number | null;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
  }>;
  const quietRow = ruleRows.find((r) => r.quietHoursStart) ?? ruleRows[0];
  const rules: ReminderRule[] = ruleRows.map((r) => ({
    id: r.id,
    type: r.type as ReminderType,
    enabled: r.enabled === 1,
    advanceMinutes: r.advanceMinutes,
  }));
  return {
    rules,
    quietHoursStart: quietRow?.quietHoursStart || DEFAULT_QUIET_START,
    quietHoursEnd: quietRow?.quietHoursEnd || DEFAULT_QUIET_END,
  };
}

/** 更新规则开关 + 免打扰时段（免打扰写回所有行，读取任意行均一致）。 */
export async function updateReminderSettings(
  userId: string,
  patch: { rules?: { type: ReminderType; enabled: boolean }[]; quietHoursStart?: string; quietHoursEnd?: string },
): Promise<ReminderSettings> {
  await ensureReminderRules(userId);
  try {
    if (patch.quietHoursStart !== undefined || patch.quietHoursEnd !== undefined) {
      const set: Record<string, unknown> = {};
      if (patch.quietHoursStart !== undefined) set.quietHoursStart = patch.quietHoursStart;
      if (patch.quietHoursEnd !== undefined) set.quietHoursEnd = patch.quietHoursEnd;
      await db.update(brainReminderRules).set(set).where(eq(brainReminderRules.userId, userId));
    }
    if (patch.rules && patch.rules.length) {
      for (const r of patch.rules) {
        await db
          .update(brainReminderRules)
          .set({ enabled: r.enabled ? 1 : 0 })
          .where(and(eq(brainReminderRules.userId, userId), eq(brainReminderRules.type, r.type)));
      }
    }
  } catch (err) {
    console.error("[reminder] update settings failed:", err);
  }
  return getReminderSettings(userId);
}

// —— 免打扰 ——

/** 解析 "HH:mm" → 分钟数。 */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}
/** 当前是否处于免打扰时段（支持跨午夜，如 22:00→08:00）。 */
export function isInQuietHours(hhmmStart: string, hhmmEnd: string, now = new Date()): boolean {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(hhmmStart);
  const end = toMinutes(hhmmEnd);
  if (start === end) return false;
  if (start < end) return nowMin >= start && nowMin < end;
  // 跨午夜
  return nowMin >= start || nowMin < end;
}

// —— 触发计算 ——

interface ComputedTrigger {
  type: ReminderType;
  title: string;
  detail: string;
  link: string;
  // P2-A：携带独立提醒记录 id，供前端「来源与关联」回溯原始来源/处理计划
  reminderId?: string;
}

/**
 * 检查当前用户所有 enabled 规则，返回需触发的提醒（含本地日期去重）。
 * 不负责浏览器通知——由前端按免打扰时段决定是否推送。
 */
export async function checkReminders(userId: string): Promise<{
  reminders: Reminder[];
  inQuietHours: boolean;
  today: string;
}> {
  await ensureReminderRules(userId);
  const settings = await getReminderSettings(userId);
  const enabled = new Map(settings.rules.map((r) => [r.type, r.enabled]));
  const advance = new Map(settings.rules.map((r) => [r.type, r.advanceMinutes ?? DEFAULT_ADVANCE[r.type] ?? 0]));

  const now = Date.now();
  const today = todayStr();
  const tomo = localDayStr(1);
  const inQuietHours = isInQuietHours(settings.quietHoursStart, settings.quietHoursEnd);

  try {
    const [tasks, notes, reviews, inbox, strategies] = await Promise.all([
      listBrainTasks(userId),
      listBrainNotes(userId),
      listPendingBrainReviews(userId),
      listBrainInboxItems(userId, "pending"),
      listBrainStrategies(userId),
    ]);

    const noteTitle = new Map(notes.map((n) => [n.id, n.title || "(无标题)"]));
    const trunc = (s: string, n = 24) => (s.length > n ? s.slice(0, n) + "…" : s);

    const triggers: ComputedTrigger[] = [];

    // —— task_overdue：dueDate 今天且未完成 ——
    if (enabled.get("task_overdue")) {
      const due = tasks.filter((t) => !t.archived && t.status !== "done" && t.dueDate === today);
      if (due.length) {
        triggers.push({
          type: "task_overdue",
          title: `${due.length} 个任务今天到期`,
          detail: due.slice(0, 3).map((t) => trunc(t.title)).join("、"),
          link: "/brain?tab=tasks",
        });
      }
    }

    // —— task_due_soon：dueDate 明天且未完成（提前 24h）——
    if (enabled.get("task_due_soon")) {
      const soon = tasks.filter((t) => !t.archived && t.status !== "done" && t.dueDate === tomo);
      if (soon.length) {
        triggers.push({
          type: "task_due_soon",
          title: `${soon.length} 个任务明天到期`,
          detail: soon.slice(0, 3).map((t) => trunc(t.title)).join("、"),
          link: "/brain?tab=tasks",
        });
      }
    }

    // —— review_due：复习记录今天到期 ——
    if (enabled.get("review_due")) {
      const dueReviews = reviews.filter((r) => r.nextReviewAt.slice(0, 10) <= today || r.nextReviewAt <= new Date(now).toISOString());
      const pendingToday = dueReviews.filter((r) => r.nextReviewAt.slice(0, 10) <= today).slice(0, 12);
      if (pendingToday.length) {
        triggers.push({
          type: "review_due",
          title: `${pendingToday.length} 条笔记待复习`,
          detail: pendingToday.slice(0, 3).map((r) => trunc(noteTitle.get(r.noteId) || "(笔记已删除)")).join("、"),
          link: "/brain?tab=reviews",
        });
      }
    }

    // —— inbox_backlog：待处理 > 5 条 ——
    if (enabled.get("inbox_backlog") && inbox.length > 5) {
      triggers.push({
        type: "inbox_backlog",
        title: `收件箱积压 ${inbox.length} 条待处理`,
        detail: `共 ${inbox.length} 条输入等待整理`,
        link: "/brain?tab=inbox",
      });
    }

    // —— strategy_review：活跃策略 30 天未更新（每周一）——
    if (enabled.get("strategy_review") && isMonday(now)) {
      const stale = strategies.filter((s) => s.status === "active" && now - s.updatedAt > 30 * DAY_MS);
      if (stale.length) {
        triggers.push({
          type: "strategy_review",
          title: `${stale.length} 个策略已超 30 天未更新`,
          detail: stale.slice(0, 3).map((s) => trunc(s.title)).join("、"),
          link: "/brain?tab=strategies",
        });
      }
    }

    // —— knowledge_decay：60 天无任何访问（每周一）——
    if (enabled.get("knowledge_decay") && isMonday(now)) {
      const decayed = await computeDecayedNotes(notes, now);
      if (decayed.length) {
        triggers.push({
          type: "knowledge_decay",
          title: `${decayed.length} 条笔记可能已被遗忘`,
          detail: decayed.slice(0, 3).map((d) => `「${trunc(d.title, 14)}」已 ${d.days} 天未访问`).join("、"),
          link: "/brain?decay=1",
        });
      }
    }

    // —— project_milestone：里程碑任务临近截止（提前 advance）——
    if (enabled.get("project_milestone")) {
      const advDays = Math.ceil(((advance.get("project_milestone") ?? 4320) / (60 * 24)));
      const end = localDayStr(advDays);
      const due = tasks.filter(
        (t) => !t.archived && t.status !== "done" && t.milestone && t.milestone.trim() && t.dueDate && t.dueDate >= today && t.dueDate <= end,
      );
      if (due.length) {
        const names = [...new Set(due.map((t) => t.milestone!.trim().slice(0, 12)))].slice(0, 3);
        triggers.push({
          type: "project_milestone",
          title: `${due.length} 个里程碑临近截止`,
          detail: names.join("、") || "本轮里程碑",
          link: "/brain?tab=tasks",
        });
      }
    }

    // —— task_complete_followup：done 任务完成 7 天 ——
    if (enabled.get("task_complete_followup")) {
      const lo = now - 8 * DAY_MS;
      const hi = now - 6 * DAY_MS;
      const done = tasks.filter(
        (t) => t.status === "done" && t.completedAt != null && t.completedAt >= lo && t.completedAt <= hi,
      );
      if (done.length) {
        triggers.push({
          type: "task_complete_followup",
          title: `${done.length} 个已完成任务待复盘`,
          detail: done.slice(0, 3).map((t) => trunc(t.title)).join("、"),
          link: "/brain?tab=tasks",
        });
      }
    }

    // 去重：同类型同一天已被记录过则不重复触发
    const todayStart = localMidnight(now);
    const logRows = (await db
      .select({ type: brainReminderLog.type })
      .from(brainReminderLog)
      .where(and(eq(brainReminderLog.userId, userId), gte(brainReminderLog.createdAt, todayStart)))) as { type: string }[];
    const already = new Set(logRows.map((l) => l.type));
    const newTriggers = triggers.filter((t) => !already.has(t.type));

    // 落日志
    if (newTriggers.length) {
      const nowTs = Date.now();
      for (const t of newTriggers) {
        await db.insert(brainReminderLog).values({
          id: uid("rl"),
          userId,
          type: t.type,
          title: t.title,
          createdAt: nowTs,
        });
      }
    }
    // 今日已触发的全部（含早前触发的）都随日志返回，供前端展示当前待办
    const all: Reminder[] = triggers.map((t) => ({
      ...t,
      priority: DEFAULT_PRIORITY[t.type] ?? "medium",
    }));

    // —— 用户确认的单条独立提醒（reminder_item）：到时间即触发 ——
    try {
      const items = await listPendingBrainReminderItems(userId);
      for (const it of items) {
        const due =
          (it.remindAt && new Date(it.remindAt).getTime() <= now) ||
          (it.dueDate && it.dueDate <= today);
        if (!due) continue;
        all.push({
          type: "reminder_item",
          title: `⏰ ${it.title}`,
          detail: it.dueDate ? `提醒：${it.dueDate}` : "确认提醒",
          link: it.noteId ? `/brain?note=${it.noteId}` : "/brain?tab=tasks",
          priority: "medium",
        });
      }
    } catch (err) {
      console.error("[reminder] load reminder items failed:", err);
    }

    const order: Record<ReminderPriority, number> = { high: 0, medium: 1, low: 2 };
    all.sort((a, b) => order[a.priority] - order[b.priority] || a.type.localeCompare(b.type));

    return { reminders: all, inQuietHours, today };
  } catch (err) {
    console.error("[reminder] check failed:", err);
    return { reminders: [], inQuietHours, today };
  }
}

function isMonday(ts: number): boolean {
  return new Date(ts).getDay() === 1;
}

/** 返回当前用户的衰减笔记列表（superseded=0 且 60 天无访问）。 */
export async function getDecayedNotes(userId: string): Promise<{ id: string; title: string; days: number }[]> {
  const notes = await listBrainNotes(userId);
  return computeDecayedNotes(notes, Date.now());
}

async function computeDecayedNotes(
  notes: Awaited<ReturnType<typeof listBrainNotes>>,
  now: number,
): Promise<{ id: string; title: string; days: number }[]> {
  const cutoff = now - 60 * DAY_MS;
  let recent: { noteId: string }[] = [];
  try {
    recent = (await db
      .select({ noteId: brainNoteAccessLog.noteId })
      .from(brainNoteAccessLog)
      .where(gte(brainNoteAccessLog.createdAt, cutoff))) as { noteId: string }[];
  } catch {
    recent = [];
  }
  const active = new Set(recent.map((r) => r.noteId));
  return notes
    .filter((n) => !n.superseded && n.createdAt < cutoff && !active.has(n.id))
    .map((n) => ({ id: n.id, title: n.title || "(无标题)", days: Math.floor((now - n.createdAt) / DAY_MS) }))
    .sort((a, b) => b.days - a.days);
}

// —— 已读 / 日志 ——

/** 今日提醒日志（未读在前，用于角标计数）。 */
export async function listTodayReminderLogs(userId: string): Promise<
  { id: string; type: string; title: string; read: boolean; createdAt: number }[]
> {
  try {
    const rows = (await db
      .select()
      .from(brainReminderLog)
      .where(and(eq(brainReminderLog.userId, userId), gte(brainReminderLog.createdAt, localMidnight())))) as Array<{
      id: string;
      type: string;
      title: string;
      read: number;
      createdAt: number;
    }>;
    return rows
      .map((r) => ({ id: r.id, type: r.type, title: r.title, read: r.read === 1, createdAt: r.createdAt }))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.error("[reminder] list logs failed:", err);
    return [];
  }
}

export function unreadCount(logs: { read: boolean }[]): number {
  return logs.filter((l) => !l.read).length;
}

/** 全部已读。 */
export async function markAllRemindersRead(userId: string): Promise<void> {
  try {
    await db
      .update(brainReminderLog)
      .set({ read: 1, readAt: Date.now() })
      .where(and(eq(brainReminderLog.userId, userId), eq(brainReminderLog.read, 0)));
  } catch (err) {
    console.error("[reminder] mark read failed:", err);
  }
}

// —— 笔记访问埋点 ——

export type AccessType = "view" | "edit" | "rag_reference" | "review";

/** 记录一次笔记访问（view/edit/rag_reference/review），供衰减判定。 */
export async function logBrainNoteAccess(noteId: string, accessType: AccessType): Promise<void> {
  try {
    await db.insert(brainNoteAccessLog).values({
      id: uid("na"),
      noteId,
      accessType,
      createdAt: Date.now(),
    });
  } catch (err) {
    console.error("[reminder] log access failed:", err);
  }
}