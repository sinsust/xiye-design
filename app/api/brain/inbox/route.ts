import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  insertBrainInboxItems,
  listBrainInboxItems,
  listBrainNotes,
  type BrainInboxItem,
  type BrainInboxIntent,
  type NewBrainInboxItem,
} from "@/lib/brain-db";
import { organizeNote, deriveIntentFromOrganizedNote, type IntentVerdict } from "@/lib/brain-organizer";

export const runtime = "nodejs";

type InboxPreview = {
  id?: string;
  rawContent: string;
  intent: BrainInboxIntent | null;
  confidence: number;
  suggestedTitle?: string;
  suggestedCategory?: string;
  suggestedTags?: string[];
};

function todayStart(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// POST /api/brain/inbox
// body: { items: [{ rawContent }] }
// 批量输入 + 智能路由：对每条跑一次完整 AI 整理（organizeNote），据结果判定 intent 与建议，
// 写入 brain_inbox_items（status=pending）作为预览缓冲——**尚未落库为正式笔记**。
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const items = Array.isArray(body?.items) ? body.items : [];
    // 关联建议基于用户已有笔记
    const existing = await listBrainNotes(user.sub).catch(() => []);
    const previews: InboxPreview[] = [];
    const toInsert: NewBrainInboxItem[] = [];

    for (const it of items) {
      const raw = typeof it?.rawContent === "string" ? it.rawContent.trim() : "";
      if (!raw) continue;
      try {
        const organized = await organizeNote(raw, existing);
        const verdict: IntentVerdict = deriveIntentFromOrganizedNote(raw, organized);
        const intent = verdict.intent;
        const preview: InboxPreview = {
          rawContent: raw,
          intent,
          confidence: verdict.confidence,
          suggestedTitle: organized.title || raw.slice(0, 50),
          suggestedCategory: organized.category || "未分类",
          suggestedTags: organized.tags ?? [],
        };
        // 先预览后落库 → 写入收件箱(不含 id，写入后回填)
        previews.push(preview);
        toInsert.push({
          rawContent: raw,
          intent,
          suggestedTitle: organized.title,
          suggestedCategory: organized.category,
          suggestedTags: organized.tags ?? [],
          organized: JSON.stringify(organized).slice(0, 20000),
        });
      } catch (err) {
        console.error("[inbox] organize failed:", err);
        // 单条失败降级：仍进入收件箱，标注 unknown，方便用户手动处理
        previews.push({ rawContent: raw, intent: "unknown", confidence: 0 });
        toInsert.push({ rawContent: raw, intent: "unknown" });
      }
    }

    const inserted = toInsert.length ? await insertBrainInboxItems(user.sub, toInsert) : [];
    // 回填真实 id
    const byRaw = new Map(inserted.map((i) => [i.rawContent, i]));
    const finalPreviews = previews.map((p, idx) => {
      const real = idx < inserted.length ? inserted[idx].id : byRaw.get(p.rawContent)?.id;
      return { ...p, id: real ?? undefined };
    });

    const all = await listBrainInboxItems(user.sub).catch(() => []);
    return NextResponse.json({
      items: finalPreviews,
      inserted: inserted.length,
      stats: inboxStats(all),
    });
  } catch (err) {
    console.error("[inbox] POST failed:", err);
    return NextResponse.json({ error: "inbox_failed", detail: String(err) }, { status: 500 });
  }
}

function inboxStats(items: BrainInboxItem[]) {
  const start = todayStart();
  return {
    pending: items.filter((i) => i.status === "pending").length,
    processedToday: items.filter(
      (i) => i.status === "processed" && i.processedAt != null && i.processedAt >= start,
    ).length,
    total: items.length,
  };
}

// GET /api/brain/inbox
// 待处理条目列表 + 统计（含今日已处理、总量）。
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const all = await listBrainInboxItems(user.sub).catch(() => []);
  const pending = all.filter((i) => i.status === "pending");
  return NextResponse.json({ items: pending, stats: inboxStats(all) });
}