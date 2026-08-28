import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  getReminderSettings,
  updateReminderSettings,
  REMINDER_TYPES,
  type ReminderType,
} from "@/lib/brain-reminder";

export const runtime = "nodejs";

function isType(v: unknown): v is ReminderType {
  return typeof v === "string" && (REMINDER_TYPES as readonly string[]).includes(v);
}

// GET /api/brain/reminder-settings → 提醒设置（各类型开关 + 免打扰时段）
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const settings = await getReminderSettings(user.sub);
  return NextResponse.json(settings);
}

// PUT /api/brain/reminder-settings
// body: { rules?: {type,enabled}[]; quietHoursStart?; quietHoursEnd? }
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const patch: {
      rules?: { type: ReminderType; enabled: boolean }[];
      quietHoursStart?: string;
      quietHoursEnd?: string;
    } = {};
    if (Array.isArray(body?.rules)) {
      const rules = body.rules.filter((r: unknown) => r && isType((r as { type?: unknown }).type));
      if (rules.length) {
        patch.rules = rules.map((r: { type: ReminderType; enabled: unknown }) => ({
          type: r.type,
          enabled: r.enabled === true || r.enabled === 1,
        }));
      }
    }
    const hhmm = (v: unknown) => (typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v) ? v : undefined);
    const start = hhmm(body?.quietHoursStart);
    const end = hhmm(body?.quietHoursEnd);
    if (start) patch.quietHoursStart = start;
    if (end) patch.quietHoursEnd = end;

    const settings = await updateReminderSettings(user.sub, patch);
    return NextResponse.json(settings);
  } catch (err) {
    console.error("[reminder] update settings failed:", err);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}