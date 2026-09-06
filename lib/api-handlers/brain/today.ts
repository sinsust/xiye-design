// M3 今日空间聚合端点：一次拉齐「今日复习 + 最近记录 + 最新周摘」。
// 对应会话决策：两套复习收敛为今日卡片；数据库无新增表，仅复用既有查询。
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listPendingBrainReviews, listBrainNotes, listBrainWeeklyReviews } from "@/lib/brain-db";
import { listDueLearningReviews } from "@/lib/brain-learning-review";

export const runtime = "nodejs";

export interface TodayCard {
  kind: "sm2" | "learning";
  reviewId: string;
  noteId: string;
  noteTitle: string;
  noteCategory: string;
  nextTs: number;
}

export interface RecentNoteMeta {
  id: string;
  title: string;
  category: string;
  tags: string[];
  source: string;
  summary: string;
  createdAt: number;
}

export interface TodayResponse {
  todayReviews: TodayCard[]; // 合并到期复习，≤5，按下一次时间升序
  recentNotes: RecentNoteMeta[]; // 最近 10 条笔记元数据（不含正文/struct）
  weeklySummary: { weekLabel: string; periodEnd: number; summary: string; updatedAt: number } | null;
}

// GET /api/brain/today → 今日空间聚合
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    const [pending, learning, notes, weekly] = await Promise.all([
      listPendingBrainReviews(user.sub),
      listDueLearningReviews(user.sub, now),
      listBrainNotes(user.sub),
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
      });
    }
    // 回填标题/分类（避免 two 处重复查询 noteMap，这里统一补）
    const noteMap = new Map(notes.map((n) => [n.id, n]));
    for (const c of cards) {
      const n = noteMap.get(c.noteId);
      if (n) {
        c.noteTitle = n.title || "(无标题)";
        c.noteCategory = n.category || "";
      } else {
        c.noteTitle = c.noteTitle === "…" ? "(笔记已删除)" : c.noteTitle;
      }
    }
    cards.sort((a, b) => a.nextTs - b.nextTs);
    const todayReviews = cards.slice(0, 5);

    // 2. 最近记录：最近 10 条元数据
    const recentNotes: RecentNoteMeta[] = notes
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 10)
      .map((n) => ({
        id: n.id,
        title: n.title,
        category: n.category,
        tags: n.tags ?? [],
        source: n.source,
        summary: n.summary ?? "",
        createdAt: n.createdAt,
      }));

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