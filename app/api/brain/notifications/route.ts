// P4 站内通知中心 API。
//  GET  → 扫描最新提醒并入队，返回活跃通知 + 未读计数 + 免打扰状态（中心始终完整可追溯）
//  POST  → 通知动作（read / unread / defer / snooze / done / ignore），严格按 userId 隔离
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  getNotificationCenter,
  applyNotificationAction,
  applyNotificationBatch,
  type NotificationAction,
} from "@/lib/brain-notification";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const at = Number(req.nextUrl.searchParams.get("at") || Date.now()) || Date.now();
    const data = await getNotificationCenter(user.sub, at);
    return NextResponse.json(data);
  } catch (err) {
    console.error("notifications get failed:", err);
    return NextResponse.json({ error: "notifications_failed" }, { status: 500 });
  }
}

function isAction(v: unknown): v is NotificationAction {
  return ["read", "unread", "defer", "snooze", "done", "ignore"].includes(v as string);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = (await req.json().catch(() => null)) ?? {};
    const action = body.action;
    if (!isAction(action)) {
      return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }
    const days =
      typeof body.days === "number" && body.days > 0 ? Math.round(body.days) : 1;

    // 批量：ids 数组
    if (Array.isArray(body.ids) && body.ids.length) {
      const ids = body.ids.filter((v: unknown): v is string => typeof v === "string");
      const updated = await applyNotificationBatch(user.sub, ids, action, { days });
      return NextResponse.json({ updated });
    }

    // 单条：id
    if (typeof body.id !== "string" || !body.id) {
      return NextResponse.json({ error: "invalid_id" }, { status: 400 });
    }
    const updated = await applyNotificationAction(user.sub, body.id, action, { days });
    if (!updated) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ notification: updated });
  } catch (err) {
    console.error("notifications action failed:", err);
    return NextResponse.json({ error: "action_failed" }, { status: 500 });
  }
}