import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  listBrainNotes,
  listBrainTasks,
  listBrainStrategies,
  listBrainProjects,
  listPendingBrainReviews,
  listBrainInboxItems,
  listBrainProcessingPlans,
  type BrainTask,
  type BrainNote,
  type BrainStrategy,
  type BrainProject,
} from "@/lib/brain-db";
import { buildTodayBrief } from "@/lib/brain-priority";

export const runtime = "nodejs";

const DAY_MS = 86400_000;

function startOfToday(): { start: number; end: number } {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const start = d.getTime();
  return { start, end: start + DAY_MS };
}

function localDateStr(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

/** 距今天数（可为负=已过期）。 */
function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00Z").getTime();
  const today = new Date().toISOString().slice(0, 10) + "T00:00:00Z";
  return Math.round((target - Date.parse(today)) / 86400000);
}

// GET /api/brain/dashboard
// 一次性返回每日助理面板所需全部数据：今日待办 / 今日复习 / 收件箱 / 本周洞察 / 项目进度。
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [notes, tasks, strategies, reviews, inbox, projects, plans] = await Promise.all([
    listBrainNotes(user.sub),
    listBrainTasks(user.sub),
    listBrainStrategies(user.sub),
    listPendingBrainReviews(user.sub),
    listBrainInboxItems(user.sub),
    listBrainProjects(user.sub),
    listBrainProcessingPlans(user.sub, ["pending_confirmation"]),
  ]);

  const now = Date.now();
  const { start, end } = startOfToday();
  const dueDateMs = (t: BrainTask) => (t.dueDate ? new Date(t.dueDate).getTime() : NaN);

  // —— 任务分组 ——
  type TaskBucketOut = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  daysOverdue: number;
  strategyName: string | null;
};

  const overdue: TaskBucketOut[] = [];
  const dueToday: TaskBucketOut[] = [];
  const dueThisWeek: TaskBucketOut[] = [];
  const strategyName = new Map(strategies.map((s) => [s.id, s.title]));
  const bucket = (t: BrainTask) => {
    const due = dueDateMs(t);
    const elapsed = Math.floor((start - due) / DAY_MS);
    return {
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      daysOverdue: elapsed,
      strategyName: t.strategyId ? strategyName.get(t.strategyId) ?? null : null,
    };
  };
  for (const t of tasks) {
    if (t.status === "done") continue;
    const due = dueDateMs(t);
    if (isNaN(due)) continue;
    if (due < start) overdue.push(bucket(t));
    else if (due >= start && due < end) dueToday.push(bucket(t));
    else if (due >= end && due < start + 7 * DAY_MS) dueThisWeek.push(bucket(t));
  }
  // 到期时间升序，紧急排前
  overdue.sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));

  // —— 今日复习（到期或已过期）——
  const noteTitle = new Map(notes.map((n) => [n.id, n.title || "(无标题)"]));
  const dueReviews = reviews
    .filter((r) => new Date(r.nextReviewAt).getTime() <= end)
    .map((r) => ({
      noteId: r.noteId,
      title: noteTitle.get(r.noteId) ?? "(已删除)",
      reviewCount: r.reviewCount,
      easeFactor: r.easeFactor,
    }));

  // —— 本周洞察 ——
  const weekStart = now - 7 * DAY_MS;
  const newNotes = notes.filter((n) => n.createdAt >= weekStart);
  const completedTasks = tasks.filter((t) => t.completedAt != null && t.completedAt >= weekStart).length;
  const newStrategies = strategies.filter((s) => s.createdAt >= weekStart).length;
  const catCount = new Map<string, number>();
  const tagCount = new Map<string, number>();
  for (const n of newNotes) {
    const c = (n.category || "未分类").trim();
    catCount.set(c, (catCount.get(c) ?? 0) + 1);
    for (const tg of n.tags) tagCount.set(tg, (tagCount.get(tg) ?? 0) + 1);
  }
  const topCategory = [...catCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const topTags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);

  const decayAlerts: { noteId: string; title: string; lastAccessedAt: string; daysSinceAccess: number }[] = [];
  for (const n of notes) {
    if (n.superseded) continue;
    const days = Math.floor((now - n.updatedAt) / DAY_MS);
    if (days >= 60) {
      decayAlerts.push({ noteId: n.id, title: n.title || "(无标题)", lastAccessedAt: toIso(n.updatedAt), daysSinceAccess: days });
    }
  }
  decayAlerts.sort((a, b) => b.daysSinceAccess - a.daysSinceAccess);
  const decayAlertsTop = decayAlerts.slice(0, 5);

  const strategyReviews: {
    strategyId: string;
    name: string;
    lastUpdated: string;
    daysSinceUpdate: number;
  }[] = [];
  for (const s of strategies) {
    if (s.status !== "active") continue;
    const days = Math.floor((now - s.updatedAt) / DAY_MS);
    if (days >= 30) {
      strategyReviews.push({ strategyId: s.id, name: s.title, lastUpdated: toIso(s.updatedAt), daysSinceUpdate: days });
    }
  }
  strategyReviews.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);

  // —— 项目进度（active 项目，聚合任务统计 + 剩余天数）——
    const projectsOut = projects
      .filter((p) => p.status === "active")
      .map((p) => {
        const owned = tasks.filter((t) => t.projectId === p.id);
        const completed = owned.filter((t) => t.status === "done").length;
        const progress = owned.length ? Math.round((completed / owned.length) * 100) : 0;
        const daysRemaining = p.dueDate ? daysUntil(p.dueDate) : null;
        return {
          id: p.id,
          name: p.name,
          color: p.color,
          totalTasks: owned.length,
          completedTasks: completed,
          progress,
          daysRemaining,
        };
      });
    projectsOut.sort((a, b) => {
      const aDue = a.daysRemaining ?? Infinity;
      const bDue = b.daysRemaining ?? Infinity;
      return aDue - bDue;
    });

  // —— P1 今日助理：可解释优先级简报（在旧字段之外增量返回，兼容既有前端）——
  const brief = buildTodayBrief({
    tasks: tasks as Parameters<typeof buildTodayBrief>[0]["tasks"],
    plans: plans.map((p) => ({ id: p.id, status: p.status, createdAt: p.createdAt, projectId: p.projectId ?? null, contentPreview: p.rawContent.slice(0, 40) })),
    inbox: inbox.map((i) => ({ id: i.id, status: i.status, createdAt: i.createdAt, rawContent: i.rawContent })),
    projects: projects.map((p) => ({ id: p.id, name: p.name, status: p.status, dueDate: p.dueDate, createdAt: p.createdAt })),
    now,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  return NextResponse.json({
    today: localDateStr(now),
    tasks: {
      overdue,
      dueToday,
      dueThisWeek,
      total: { overdue: overdue.length, today: dueToday.length, week: dueThisWeek.length },
    },
    reviews: { dueToday: dueReviews, total: reviews.length },
    inbox: { pending: inbox.filter((i) => i.status === "pending").length },
    insights: {
      weekSummary: {
        newNotes: newNotes.length,
        completedTasks,
        newStrategies,
        topCategory,
        topTags,
      },
      decayAlerts: decayAlertsTop,
      strategyReviews: strategyReviews.slice(0, 5),
    },
    projects: projectsOut,
    brief,
  });
}