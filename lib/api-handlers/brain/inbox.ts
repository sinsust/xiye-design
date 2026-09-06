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
import { applyOrganizedToNote } from "@/lib/inbox-process";
import { safeDetail } from "@/lib/api-error";

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
// body: { items: [{ rawContent }], autoApply?: boolean }
// 决策 15：默认 autoApply=true——对每条跑一次完整 AI 整理（organizeNote），即时落库为正式笔记
// （applyOrganizedToNote），不再停留在待确认缓冲；前端可撤销（DELETE /api/brain/notes）。
// autoApply=false 保留旧"先预览后落库"队列（高级工具内可选）。
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const items = Array.isArray(body?.items) ? body.items : [];
    const autoApply = body?.autoApply !== false; // 默认直接入库
    // 关联建议基于用户已有笔记
    const existing = await listBrainNotes(user.sub).catch(() => []);

    if (autoApply) {
      const applied: (InboxPreview & { id: string; noteId: string })[] = [];
      for (const it of items) {
        const raw = typeof it?.rawContent === "string" ? it.rawContent.trim() : "";
        if (!raw) continue;
        try {
          const organized = await organizeNote(raw, existing);
          const verdict: IntentVerdict = deriveIntentFromOrganizedNote(raw, organized);
          const res = await applyOrganizedToNote(user.sub, {
            rawContent: raw,
            title: organized.title || undefined,
            category: organized.category || undefined,
            tags: organized.tags ?? [],
            intent: verdict.intent,
            organized,
          });
          if (!res.ok || !res.noteId) {
            console.error("[inbox] auto-apply failed:", res.error);
            continue;
          }
          applied.push({
            id: res.noteId,
            noteId: res.noteId,
            rawContent: raw,
            intent: verdict.intent,
            confidence: verdict.confidence,
            suggestedTitle: organized.title || raw.slice(0, 50),
            suggestedCategory: organized.category || "未分类",
            suggestedTags: organized.tags ?? [],
          });
        } catch (err) {
          console.error("[inbox] organize failed:", err);
          // 降级：仍落一条原文笔记（决策 16 兜底，避免丢输入），不阻断
          const res = await applyOrganizedToNote(user.sub, { rawContent: raw, intent: "unknown" as BrainInboxIntent, organized: null }).catch(() => null);
          if (res?.noteId) {
            applied.push({ id: res.noteId, noteId: res.noteId, rawContent: raw, intent: "unknown", confidence: 0 });
          }
        }
      }
      const all = await listBrainInboxItems(user.sub).catch(() => []);
      return NextResponse.json({
        autoApply: true,
        items: applied,
        inserted: applied.length,
        stats: inboxStats(all),
      });
    }

    // 旧路径：预览缓冲（自动确认队列，高级工具内可选保留）
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
      autoApply: false,
      items: finalPreviews,
      inserted: inserted.length,
      stats: inboxStats(all),
    });
  } catch (err) {
    console.error("[inbox] POST failed:", err);
    return NextResponse.json({ error: "inbox_failed", detail: safeDetail(err) }, { status: 500 });
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
// P2-A：返回全部收件箱条目（含状态 / 处理计划 / 产出链路），便于前后台状态展示。
// 兼容旧字段：items（含全部状态）+ stats.pending / processedToday / total。
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const all = await listBrainInboxItems(user.sub).catch(() => []);
  return NextResponse.json({
    items: all,
    stats: inboxStats(all),
  });
}