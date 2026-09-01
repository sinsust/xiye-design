import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listBrainNotes } from "@/lib/brain-db";
import { generateWeeklyReport } from "@/lib/brain-report";

export const runtime = "nodejs";

// GET /api/brain/report → 基于当前用户个人笔记自动生成周报，返回 { report, source }
export async function GET(_req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const notes = await listBrainNotes(user.sub);
    const { report, source, aiUsed } = await generateWeeklyReport(notes, Date.now(), { userId: user.sub });
    return NextResponse.json({
      report,
      source: source.map((n) => ({ id: n.id, title: n.title, category: n.category, summary: n.summary })),
      aiUsed,
    });
  } catch (err) {
    console.error("brain report failed:", err);
    return NextResponse.json({ error: "report_failed" }, { status: 500 });
  }
}