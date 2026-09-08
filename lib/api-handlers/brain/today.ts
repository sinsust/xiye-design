// M3 今日空间聚合端点：拉齐「最近记录 + 最新周摘」。
// 注：间隔复习功能已移除，不再组装 todayReviews。
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  listBrainNoteMetas,
  listBrainNotesByIds,
  listBrainWeeklyReviews,
} from "@/lib/brain-db";

export const runtime = "nodejs";

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
  recentNotes: RecentNoteMeta[]; // 最近 10 条，含可展开详情所需正文/struct
  weeklySummary: { weekLabel: string; periodEnd: number; summary: string; updatedAt: number } | null;
}

// GET /api/brain/today → 今日空间聚合
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const metas = await listBrainNoteMetas(user.sub);
    const weekly = await listBrainWeeklyReviews(user.sub);

    // 最近记录：最近 10 条（仅这 10 条携带正文/struct，供点击详情）
    const recent = metas.slice(0, 10);
    const recentIds = new Set(recent.map((n) => n.id));
    const fullNotes = recentIds.size
      ? await listBrainNotesByIds(user.sub, [...recentIds])
      : [];
    const fullMap = new Map(fullNotes.map((n) => [n.id, n]));

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

    // 最新周摘（已保存里取最近一份；无则 null）
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

    return NextResponse.json<TodayResponse>({ recentNotes, weeklySummary });
  } catch (err) {
    console.error("[brain/today] failed:", err);
    return NextResponse.json({ error: "today_failed" }, { status: 500 });
  }
}
