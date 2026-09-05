import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { listBrainNotes, updateBrainNote } from "@/lib/brain-db";
import { embed, buildListableText } from "@/lib/embedding";

export const runtime = "nodejs";

// POST /api/brain/embedding/backfill
// body: { limit?: number }
// 为 embedding=null 的历史笔记批量补算向量（@xenova/transformers 本地模型，零 API 费用）。
// 每批默认 20 条（上限 50），返回进度供前端展示；剩余可再次调用。
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // 限流：同一用户每分钟最多 10 次向量补算（本地模型但逐条 embed，属重操作）
  if (!await rateLimit(`brain-backfill:${user.sub}`, 10, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  try {
    const body = await req.json().catch(() => null);
    const limit = Math.min(Math.max(typeof body?.limit === "number" ? body.limit : 20, 1), 50);

    const notes = await listBrainNotes(user.sub);
    const missing = notes.filter((n) => !n.embedding);
    const batch = missing.slice(0, limit);

    let processed = 0;
    let failed = 0;
    for (const n of batch) {
      try {
        const vec = await embed(
          buildListableText({ title: n.title, content: n.content, summary: n.summary, tags: n.tags }),
        );
        if (vec) {
          await updateBrainNote(user.sub, n.id, { embedding: JSON.stringify(vec) });
          processed++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    return NextResponse.json({
      processed,
      failed,
      totalMissing: missing.length,
      remaining: Math.max(0, missing.length - batch.length),
    });
  } catch (err) {
    console.error("embedding backfill failed:", err);
    return NextResponse.json({ error: "backfill_failed" }, { status: 500 });
  }
}
