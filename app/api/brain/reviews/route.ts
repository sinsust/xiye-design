import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  listPendingBrainReviews,
  listBrainNotes,
  completeBrainReview,
  skipBrainReview,
  type BrainReview,
} from "@/lib/brain-db";

export const runtime = "nodejs";

interface DueReview extends Omit<BrainReview, "userId"> {
  noteTitle: string;
  noteCategory: string;
}

export interface ReviewsResponse {
  // 已到期、待复习的笔记列表
  due: DueReview[];
  // 未来最近一条待复习记录（供"下次复习"提示）；无则 null
  next: { noteTitle: string; nextReviewAt: string } | null;
}

// GET /api/brain/reviews  → 返回到期待复习的笔记 + 最近一次未来复习
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [pending, notes] = await Promise.all([
    listPendingBrainReviews(user.sub),
    listBrainNotes(user.sub),
  ]);
  const noteMap = new Map(notes.map((n) => [n.id, n]));
  const nowIso = new Date().toISOString();

  const due: DueReview[] = [];
  let next: { noteTitle: string; nextReviewAt: string } | null = null;
  for (const r of pending) {
    const n = noteMap.get(r.noteId);
    const base = {
      id: r.id,
      noteId: r.noteId,
      nextReviewAt: r.nextReviewAt,
      interval: r.interval,
      easeFactor: r.easeFactor,
      status: r.status,
      reviewCount: r.reviewCount,
      createdAt: r.createdAt,
      noteTitle: n?.title || "(笔记已删除)",
      noteCategory: n?.category || "",
    };
    if (r.nextReviewAt <= nowIso) {
      due.push(base);
    } else if (!next) {
      next = { noteTitle: base.noteTitle, nextReviewAt: r.nextReviewAt };
    }
  }
  due.sort((a, b) => a.nextReviewAt.localeCompare(b.nextReviewAt));

  return NextResponse.json<ReviewsResponse>({ due, next });
}

// POST /api/brain/reviews?id=<id>&action=complete|skip
// complete → 标记已复习、SM-2 重排期、归档 done 任务；skip → 顺延到明天
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const id = req.nextUrl.searchParams.get("id");
    const action = req.nextUrl.searchParams.get("action") || "complete";
    if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

    const updated =
      action === "skip"
        ? await skipBrainReview(user.sub, id)
        : await completeBrainReview(user.sub, id);
    if (!updated) return NextResponse.json({ error: "not_found_or_finished" }, { status: 404 });

    return NextResponse.json({ review: updated });
  } catch (err) {
    console.error("brain review update failed:", err);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}