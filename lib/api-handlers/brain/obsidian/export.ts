import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { exportUnsyncedNotes } from "@/lib/obsidian-sync";

export const runtime = "nodejs";

// POST /api/brain/obsidian/export
// 批量导出「从未同步过」的笔记到 vault；已在 vault 的跳过，不覆盖用户在 Obsidian 侧的修改。
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const result = await exportUnsyncedNotes(user.sub);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: "export_failed", detail: result.error }, { status: 400 });
    }
    return NextResponse.json({ ...result, ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: "export_failed", detail: msg }, { status: 500 });
  }
}
