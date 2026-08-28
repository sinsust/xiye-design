import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkReminders, listTodayReminderLogs, unreadCount } from "@/lib/brain-reminder";

export const runtime = "nodejs";

// GET /api/brain/reminders
// 返回当前用户今日应触发的提醒 + 未读角标计数 + 免打扰状态。
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { reminders, inQuietHours, today } = await checkReminders(user.sub);
  const logs = await listTodayReminderLogs(user.sub);
  return NextResponse.json({
    reminders,
    total: reminders.length,
    unread: unreadCount(logs),
    inQuietHours,
    today,
  });
}