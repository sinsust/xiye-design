// P4-B：学习笔记复习闭环服务。
// 复习状态是独立领域数据（brain_learning_reviews），通知只负责提醒（review_due）。
// 所有规则集中配置在此，不散落在 API 或前端；严格按 userId 隔离。
// 不改变 ProcessingPlan / 任务 / 项目 / 普通提醒 / 通知状态机的核心语义。

import { and, asc, eq, desc } from "drizzle-orm";
import { db, brainLearningReviews, brainLearningReviewEvents } from "@/lib/db";
import {
  listBrainNotes,
  getBrainNote,
  listBrainNotifications,
  updateBrainNotification,
  type BrainNotificationRefType,
} from "./brain-db";
import { genId } from "./id";

// —— 规则集中配置 ——
// stage 0→3 的间隔天数（天）：新学 1 天 → 7 天 → 21 天 → 30 天
export const STAGE_INTERVALS = [1, 7, 21, 30] as const;
export const INITIAL_STAGE = 0;
export const MAX_STAGE = 3;
// 加入学习计划后首次复习的延迟（天）
export const INITIAL_REVIEW_DELAY_DAYS = 1;
// snooze 延后天数边界
export const SNOOZE_MIN_DAYS = 1;
export const SNOOZE_MAX_DAYS = 7;
// 通知类型与去重前缀（通知只负责提醒，真相在复习表）
export const REVIEW_DUE_TYPE = "review_due";
export const REVIEW_DUE_DEDUP_PREFIX = "learning_review:";

export type LearningReviewStatus = "active" | "mastered" | "paused";
export type LearningReviewAction = "mastered" | "not_sure" | "snooze" | "pause" | "resume";

export interface LearningReview {
  id: string;
  userId: string;
  noteId: string;
  stage: number;
  intervalDays: number;
  nextReviewAt: number;
  lastReviewedAt: number | null;
  reviewCount: number;
  status: LearningReviewStatus;
  createdAt: number;
  updatedAt: number;
}

export interface LearningReviewEvent {
  id: string;
  userId: string;
  reviewId: string;
  noteId: string;
  reviewedAt: number;
  action: string;
  stageBefore: number;
  stageAfter: number;
  nextReviewAt: number;
}

export interface LearningReviewWithNote extends LearningReview {
  noteTitle: string;
  noteSummary: string;
  noteSuperseded: boolean;
}

const DAY_MS = 86400_000;

function uid(prefix: string): string {
  return genId(prefix);
}

interface ReviewRow {
  id: string;
  userId: string;
  noteId: string;
  stage: number | null;
  intervalDays: number | null;
  nextReviewAt: number | null;
  lastReviewedAt: number | null;
  reviewCount: number | null;
  status: string | null;
  createdAt: number | null;
  updatedAt: number | null;
}

function toReview(r: ReviewRow): LearningReview {
  return {
    id: r.id,
    userId: r.userId,
    noteId: r.noteId,
    stage: Number(r.stage ?? INITIAL_STAGE),
    intervalDays: Number(r.intervalDays ?? STAGE_INTERVALS[INITIAL_STAGE]),
    nextReviewAt: Number(r.nextReviewAt ?? 0),
    lastReviewedAt: r.lastReviewedAt ?? null,
    reviewCount: Number(r.reviewCount ?? 0),
    status: (r.status ?? "active") as LearningReviewStatus,
    createdAt: Number(r.createdAt ?? 0),
    updatedAt: Number(r.updatedAt ?? 0),
  };
}

// —— 读取 ——

/** 按笔记查学习复习；非本人返回 null（隔离）。 */
export async function getLearningReviewByNote(
  userId: string,
  noteId: string,
): Promise<LearningReview | null> {
  try {
    const rows = (await db
      .select()
      .from(brainLearningReviews)
      .where(
        and(
          eq(brainLearningReviews.userId, userId),
          eq(brainLearningReviews.noteId, noteId),
        ),
      )
      .limit(1)) as ReviewRow[];
    return rows[0] ? toReview(rows[0]) : null;
  } catch (err) {
    console.error("[learning-review] get by note failed:", err);
    return null;
  }
}

/** 按复习记录 id 查；非本人返回 null（隔离）。 */
export async function getLearningReview(
  userId: string,
  id: string,
): Promise<LearningReview | null> {
  try {
    const rows = (await db
      .select()
      .from(brainLearningReviews)
      .where(
        and(eq(brainLearningReviews.id, id), eq(brainLearningReviews.userId, userId)),
      )
      .limit(1)) as ReviewRow[];
    return rows[0] ? toReview(rows[0]) : null;
  } catch (err) {
    console.error("[learning-review] get failed:", err);
    return null;
  }
}

/** 当前用户全部学习复习，按下次复习时间倒序。 */
export async function listLearningReviews(userId: string): Promise<LearningReview[]> {
  try {
    const rows = (await db
      .select()
      .from(brainLearningReviews)
      .where(eq(brainLearningReviews.userId, userId))
      .orderBy(desc(brainLearningReviews.nextReviewAt))) as ReviewRow[];
    return rows.map(toReview);
  } catch (err) {
    console.error("[learning-review] list failed:", err);
    return [];
  }
}

/** 到期（active 且 nextReviewAt <= now）的学习复习，附带笔记信息；跳过已归档/已删除笔记。 */
export async function listDueLearningReviews(
  userId: string,
  now = Date.now(),
): Promise<LearningReviewWithNote[]> {
  const [reviews, notes] = await Promise.all([
    listLearningReviews(userId),
    listBrainNotes(userId),
  ]);
  const noteMap = new Map(notes.map((n) => [n.id, n]));
  return reviews
    .filter((r) => r.status === "active" && r.nextReviewAt <= now)
    .map((r) => {
      const n = noteMap.get(r.noteId);
      return {
        ...r,
        noteTitle: n?.title || "(笔记已删除)",
        noteSummary: n?.summary || "",
        noteSuperseded: n?.superseded ?? true,
      };
    })
    .filter((r) => !r.noteSuperseded && r.noteTitle !== "(笔记已删除)")
    .sort((a, b) => a.nextReviewAt - b.nextReviewAt);
}

/** 当前用户全部学习复习（含笔记信息），供前端展示进度。 */
export async function listLearningReviewsWithNotes(
  userId: string,
): Promise<LearningReviewWithNote[]> {
  const [reviews, notes] = await Promise.all([
    listLearningReviews(userId),
    listBrainNotes(userId),
  ]);
  const noteMap = new Map(notes.map((n) => [n.id, n]));
  return reviews.map((r) => {
    const n = noteMap.get(r.noteId);
    return {
      ...r,
      noteTitle: n?.title || "(笔记已删除)",
      noteSummary: n?.summary || "",
      noteSuperseded: n?.superseded ?? true,
    };
  });
}

/** 某条学习复习的历史事件（按时间正序）；非本人返回空。 */
export async function listLearningReviewEvents(
  userId: string,
  reviewId: string,
): Promise<LearningReviewEvent[]> {
  try {
    const rows = (await db
      .select()
      .from(brainLearningReviewEvents)
      .where(
        and(
          eq(brainLearningReviewEvents.userId, userId),
          eq(brainLearningReviewEvents.reviewId, reviewId),
        ),
      )
      .orderBy(asc(brainLearningReviewEvents.reviewedAt))) as Array<{
      id: string;
      userId: string;
      reviewId: string;
      noteId: string;
      reviewedAt: number | null;
      action: string | null;
      stageBefore: number | null;
      stageAfter: number | null;
      nextReviewAt: number | null;
    }>;
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      reviewId: r.reviewId,
      noteId: r.noteId,
      reviewedAt: Number(r.reviewedAt ?? 0),
      action: r.action ?? "",
      stageBefore: Number(r.stageBefore ?? 0),
      stageAfter: Number(r.stageAfter ?? 0),
      nextReviewAt: Number(r.nextReviewAt ?? 0),
    }));
  } catch (err) {
    console.error("[learning-review] list events failed:", err);
    return [];
  }
}

// —— 加入 / 移出学习计划 ——

/**
 * 加入学习计划：初始 stage=0，nextReviewAt = 1 天后。
 * 幂等：已存在则返回现有记录。校验笔记归属与有效性（非本人 / 已归档拒绝）。
 */
export async function addToLearningPlan(
  userId: string,
  noteId: string,
  now = Date.now(),
): Promise<{ review: LearningReview; created: boolean }> {
  const existing = await getLearningReviewByNote(userId, noteId);
  if (existing) return { review: existing, created: false };
  const note = await getBrainNote(userId, noteId);
  if (!note) throw new Error("note_not_found");
  if (note.superseded) throw new Error("note_archived");
  const review: LearningReview = {
    id: uid("lr"),
    userId,
    noteId,
    stage: INITIAL_STAGE,
    intervalDays: STAGE_INTERVALS[INITIAL_STAGE],
    nextReviewAt: now + INITIAL_REVIEW_DELAY_DAYS * DAY_MS,
    lastReviewedAt: null,
    reviewCount: 0,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  try {
    await db.insert(brainLearningReviews).values(review);
    return { review, created: true };
  } catch (err) {
    console.error("[learning-review] add failed:", err);
    throw new Error("add_failed");
  }
}

/** 移出学习计划：删除复习记录（复习事件随 FK 级联删除）。 */
export async function removeFromLearningPlan(
  userId: string,
  noteId: string,
): Promise<boolean> {
  try {
    await db
      .delete(brainLearningReviews)
      .where(
        and(
          eq(brainLearningReviews.userId, userId),
          eq(brainLearningReviews.noteId, noteId),
        ),
      );
    return true;
  } catch (err) {
    console.error("[learning-review] remove failed:", err);
    return false;
  }
}

// —— 状态机 ——

export interface LearningReviewActionResult {
  review: LearningReview;
  event: LearningReviewEvent | null;
  /** true = 未发生状态变化（幂等命中：重复点击 / 未到期 / 状态不允许） */
  noop: boolean;
  reason?: string;
}

async function updateReview(
  userId: string,
  id: string,
  patch: Partial<LearningReview>,
): Promise<LearningReview> {
  const set: Record<string, unknown> = { updatedAt: patch.updatedAt ?? Date.now() };
  if (patch.stage !== undefined) set.stage = patch.stage;
  if (patch.intervalDays !== undefined) set.intervalDays = patch.intervalDays;
  if (patch.nextReviewAt !== undefined) set.nextReviewAt = patch.nextReviewAt;
  if (patch.lastReviewedAt !== undefined) set.lastReviewedAt = patch.lastReviewedAt;
  if (patch.reviewCount !== undefined) set.reviewCount = patch.reviewCount;
  if (patch.status !== undefined) set.status = patch.status;
  await db
    .update(brainLearningReviews)
    .set(set)
    .where(and(eq(brainLearningReviews.id, id), eq(brainLearningReviews.userId, userId)));
  return (await getLearningReview(userId, id))!;
}

async function insertEvent(
  userId: string,
  e: Omit<LearningReviewEvent, "id" | "userId">,
): Promise<LearningReviewEvent> {
  const event: LearningReviewEvent = { id: uid("lre"), userId, ...e };
  await db.insert(brainLearningReviewEvents).values(event);
  return event;
}

/**
 * 执行复习动作（幂等）：
 *  - mastered：stage 递进（0→1→2→3），间隔 1→7→21→30 天；到 stage 3 置 mastered
 *  - not_sure：stage 回退到 0，1 天后复习
 *  - snooze：不改变 stage，仅把 nextReviewAt 延后 1～7 天（有边界限制）
 *  - pause / resume：生命周期动作，随时可用
 * 幂等护栏：完成类动作（mastered/not_sure/snooze）仅当「active 且已到期」可执行，
 * 双击 / 未到期 / 已掌握 / 已暂停 均返回 noop，不推进 stage。
 * action 成功后关闭关联 review_due 通知（通知状态不是复习真相来源）。
 */
export async function applyLearningReviewAction(
  userId: string,
  id: string,
  action: LearningReviewAction,
  opts: { days?: number; now?: number } = {},
): Promise<LearningReviewActionResult | null> {
  const now = opts.now ?? Date.now();
  const review = await getLearningReview(userId, id);
  if (!review) return null;

  // 生命周期动作
  if (action === "pause") {
    if (review.status === "paused") {
      return { review, event: null, noop: true, reason: "already_paused" };
    }
    const updated = await updateReview(userId, id, { status: "paused", updatedAt: now });
    return { review: updated, event: null, noop: false };
  }
  if (action === "resume") {
    if (review.status !== "paused") {
      return { review, event: null, noop: true, reason: "not_paused" };
    }
    const nextReviewAt = now + review.intervalDays * DAY_MS;
    const updated = await updateReview(userId, id, {
      status: "active",
      nextReviewAt,
      updatedAt: now,
    });
    return { review: updated, event: null, noop: false };
  }

  // 完成类动作：仅 active 且已到期可执行（幂等防双击）
  if (review.status !== "active") {
    return {
      review,
      event: null,
      noop: true,
      reason: review.status === "mastered" ? "already_mastered" : "paused",
    };
  }
  if (review.nextReviewAt > now) {
    return { review, event: null, noop: true, reason: "not_due" };
  }

  const stageBefore = review.stage;
  let stageAfter = review.stage;
  let intervalDays = review.intervalDays;
  let nextReviewAt = now;
  let status: LearningReviewStatus = "active";
  let eventAction: string;

  if (action === "mastered") {
    eventAction = "mastered";
    stageAfter = Math.min(stageBefore + 1, MAX_STAGE);
    intervalDays = STAGE_INTERVALS[stageAfter];
    nextReviewAt = now + intervalDays * DAY_MS;
    if (stageAfter >= MAX_STAGE) status = "mastered";
  } else if (action === "not_sure") {
    eventAction = "not_sure";
    stageAfter = INITIAL_STAGE;
    intervalDays = STAGE_INTERVALS[INITIAL_STAGE];
    nextReviewAt = now + INITIAL_REVIEW_DELAY_DAYS * DAY_MS;
    status = "active";
  } else {
    // snooze：不改变 stage，仅延后 1～7 天
    eventAction = "snoozed";
    const days = Math.min(
      Math.max(Math.round(opts.days ?? SNOOZE_MIN_DAYS), SNOOZE_MIN_DAYS),
      SNOOZE_MAX_DAYS,
    );
    nextReviewAt = now + days * DAY_MS;
  }

  const updated = await updateReview(userId, id, {
    stage: stageAfter,
    intervalDays,
    nextReviewAt,
    lastReviewedAt: now,
    reviewCount: action === "snooze" ? review.reviewCount : review.reviewCount + 1,
    status,
    updatedAt: now,
  });

  const event = await insertEvent(userId, {
    reviewId: id,
    noteId: review.noteId,
    reviewedAt: now,
    action: eventAction,
    stageBefore,
    stageAfter,
    nextReviewAt,
  });

  await completeReviewNotifications(userId, id);

  return { review: updated, event, noop: false };
}

// —— 通知联动 ——

export interface LearningReviewNotificationIntent {
  type: string;
  title: string;
  detail: string;
  link: string;
  refType: BrainNotificationRefType;
  refId: string;
  reason: string;
  priority: "high" | "medium" | "low";
  dedupKey: string;
}

/**
 * 计算到期学习复习的通知意图（纯数据，由通知服务统一入队）。
 * 每条到期学习项一条 review_due 通知，link 指向笔记（阅读态），refType=learning_review。
 */
export async function listDueLearningReviewNotificationIntents(
  userId: string,
  now = Date.now(),
): Promise<LearningReviewNotificationIntent[]> {
  const due = await listDueLearningReviews(userId, now);
  return due.map((r) => ({
    type: REVIEW_DUE_TYPE,
    title: `「${r.noteTitle.slice(0, 16)}」待复习`,
    detail: r.noteSummary
      ? r.noteSummary.slice(0, 40)
      : `第 ${r.reviewCount + 1} 次复习`,
    link: `/brain?note=${r.noteId}`,
    refType: "learning_review",
    refId: r.id,
    reason: "规则：学习笔记复习已到期",
    priority: "medium",
    dedupKey: `${REVIEW_DUE_DEDUP_PREFIX}${r.noteId}`,
  }));
}

/** action 成功后关闭关联 review_due 通知（通知状态不是复习真相来源）。 */
export async function completeReviewNotifications(
  userId: string,
  reviewId: string,
): Promise<number> {
  try {
    const notifs = await listBrainNotifications(userId, {
      refType: "learning_review",
    });
    let n = 0;
    for (const notif of notifs) {
      if (
        notif.refId === reviewId &&
        notif.status !== "done" &&
        notif.status !== "ignored"
      ) {
        await updateBrainNotification(userId, notif.id, {
          status: "done",
          completedAt: Date.now(),
        });
        n++;
      }
    }
    return n;
  } catch (err) {
    console.error("[learning-review] complete notifications failed:", err);
    return 0;
  }
}
