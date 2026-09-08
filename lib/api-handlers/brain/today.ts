// M3 今日空间聚合端点：一次拉齐「今日复习 + 最近记录 + 最新周摘」。
// 对应会话决策：两套复习收敛为今日卡片；数据库无新增表，仅复用既有查询。
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  listPendingBrainReviews,
  listBrainNoteMetas,
  listBrainNotesByIds,
  listBrainWeeklyReviews,
} from "@/lib/brain-db";
import { listDueLearningReviews } from "@/lib/brain-learning-review";

export const runtime = "nodejs";

export interface TodayCard {
  kind: "sm2" | "learning";
  reviewId: string;
  noteId: string;
  noteTitle: string;
  noteCategory: string;
  nextTs: number;
  // 复习卡片内容预览：让用户「复习的是啥」一目了然（M3 体验修复）
  noteSummary: string; // 结构化摘要（优先）
  noteContentPreview: string; // 正文截断 200 字（兜底）
}

export interface RecentNoteMeta {
  id: string;
  title: string;
  category: string;
  tags: string[];
  source: string;
  summary: string;
  // M4 修复：原文与结构化整理结果一并透出，详情弹层才能看到当初输入（不再只有摘要）
  content: string;
  struct: string | null;
  createdAt: number;
}

export interface TodayResponse {
  todayReviews: TodayCard[]; // 合并到期复习，≤5，按下一次时间升序
  recentNotes: RecentNoteMeta[]; // 最近 10 条，含可展开详情所需正文/struct
  weeklySummary: { weekLabel: string; periodEnd: number; summary: string; updatedAt: number } | null;
}

// GET /api/brain/today → 今日空间聚合
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    const [pending, learning, metas, weekly] = await Promise.all([
      listPendingBrainReviews(user.sub),
      listDueLearningReviews(user.sub, now),
      listBrainNoteMetas(user.sub),
      listBrainWeeklyReviews(user.sub),
    ]);

    // 1. 今日复习：合并 SM-2 到期 + 学习到期，按下一次时间升序取 ≤5
    const cards: TodayCard[] = [];
    for (const r of pending) {
      if (r.nextReviewAt <= nowIso) {
        cards.push({
          kind: "sm2",
          reviewId: r.id,
          noteId: r.noteId,
          noteTitle: "…",
          noteCategory: "",
          nextTs: Math.max(Date.parse(r.nextReviewAt) || now, 0),
          noteSummary: "",
          noteContentPreview: "",
        });
      }
    }
    for (const r of learning) {
      if (!r.noteId) continue;
      cards.push({
        kind: "learning",
        reviewId: r.id ?? r.noteId,
        noteId: r.noteId,
          noteTitle: (r as { noteTitle?: string }).noteTitle ?? "…",
          noteCategory: "",
          nextTs: Number(r.nextReviewAt) || now,
          noteSummary: "",
          noteContentPreview: "",
        });
    }
    // 只在最近 10 条 + 待复习卡片涉及的笔记上取正文，避免每次打开今日空间都整表搬运全文。
    const metaIds = new Set(metas.map((n) => n.id));
    const neededIds = new Set<string>();
    for (const c of cards) if (metaIds.has(c.noteId)) neededIds.add(c.noteId);
    const recent = metas.slice(0, 10);
    for (const n of recent) neededIds.add(n.id);
    const fullNotes = await listBrainNotesByIds(user.sub, [...neededIds]);
    const metaMap = new Map(metas.map((n) => [n.id, n]));
    const fullMap = new Map(fullNotes.map((n) => [n.id, n]));

    // 回填标题/分类 + 内容预览（同一处补齐，不再重复查询 noteMap）
    const preview = (s: string | null | undefined, max = 200) => {
      const t = (s ?? "").replace(/\s+/g, " ").trim();
      return t.length > max ? t.slice(0, max) + "…" : t;
    };
    for (const c of cards) {
      const m = metaMap.get(c.noteId);
      const full = fullMap.get(c.noteId);
      if (m) {
        c.noteTitle = m.title || "(无标题)";
        c.noteCategory = m.category || "";
        c.noteSummary = preview(full?.summary || m.summary, 160);
        c.noteContentPreview = preview(full?.content, 200);
      } else {
        c.noteTitle = c.noteTitle === "…" ? "(笔记已删除)" : c.noteTitle;
      }
    }
    cards.sort((a, b) => a.nextTs - b.nextTs);
    const todayReviews = cards.slice(0, 5);

    // 2. 最近记录：最近 10 条（仅这 10 条携带正文/struct，供点击详情）
    const recentNotes: RecentNoteMeta[] = recent.map((n) => {
      const full = fullMap.get(n.id);
      return {
        id: n.id,
        title: n.title,
        category: n.category,
        tags: n.tags ?? [],
        source: n.source,
        summary: n.summary ?? "",
        content: full?.content ?? n.summary,
        struct: full?.struct ?? null,
        createdAt: n.createdAt,
      };
    });

    // 3. 最新周摘（已保存里取最近一份；无则 null）
    let weeklySummary: TodayResponse["weeklySummary"] = null;
    if (weekly.length) {
      const latest = weekly.slice().sort((a, b) => (b.periodEnd ?? 0) - (a.periodEnd ?? 0))[0];
      weeklySummary = {
        weekLabel: latest.weekLabel,
        periodEnd: latest.periodEnd,
        summary: latest.summary ?? "",
        updatedAt: latest.updatedAt,
      };
    }

    return NextResponse.json<TodayResponse>({ todayReviews, recentNotes, weeklySummary });
  } catch (err) {
    console.error("[brain/today] failed:", err);
    return NextResponse.json({ error: "today_failed" }, { status: 500 });
  }
}
