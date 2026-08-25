import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { markAllRemindersRead, listTodayReminderLogs, unreadCount } from "@/lib/brain-reminder";

export const runtime = "nodejs";

// POST /api/brain/reminders/read  → 全部标记已读，返回剩余未读数
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await markAllRemindersRead(user.sub);
  const logs = await listTodayReminderLogs(user.sub);
  return NextResponse.json({ ok: true, unread: unreadCount(logs) });
}