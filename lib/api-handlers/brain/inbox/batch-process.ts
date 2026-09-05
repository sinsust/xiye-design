import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { processInboxItem, type InboxOverrides } from "@/lib/inbox-process";
import { safeDetail } from "@/lib/api-error";

export const runtime = "nodejs";

/** 单次批量处理条目上限（防巨量条目 DoS） */
const MAX_BATCH_ITEMS = 100;

// POST /api/brain/inbox/batch-process
// body: { items: [{ id; action: "confirm"|"edit"|"dismiss"; overrides? }] }
// 批量处理多条收件箱条目（一键全部确认 / 全部忽略）。单条失败不阻断其余。
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // 限流：同一用户每分钟最多 20 次批量处理（重操作，防刷）
  if (!await rateLimit(`inbox-batch:${user.sub}`, 20, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  try {
    const body = await req.json().catch(() => null);
    const items: { id?: string; action?: string; overrides?: InboxOverrides }[] = (
      Array.isArray(body?.items) ? body.items : []
    ).slice(0, MAX_BATCH_ITEMS);
    const results = [];
    let processed = 0;
    let dismissed = 0;
    let failed = 0;
    for (const it of items) {
      if (!it?.id) {
        failed++;
        continue;
      }
      try {
        const action = it.action === "dismiss" || it.action === "edit" ? it.action : "confirm";
        const r = await processInboxItem(user.sub, it.id, action, it.overrides ?? {});
        if (r.ok) {
          if (r.action === "dismissed") dismissed++;
          else processed++;
        } else {
          failed++;
        }
        results.push({ id: it.id, ok: r.ok, action: r.action, error: r.error });
      } catch (err) {
        failed++;
        results.push({ id: it.id, ok: false, error: safeDetail(err) });
      }
    }
    return NextResponse.json({ processed, dismissed, failed, total: items.length, results });
  } catch (err) {
    console.error("[inbox] batch process failed:", err);
    return NextResponse.json({ error: "batch_failed", detail: safeDetail(err) }, { status: 500 });
  }
}