import { NextRequest, NextResponse } from "next/server";
import { db, privateDataAudit } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

// GET /api/private-data/audit?limit=&cursor= → 私有资料删除审计列表（当前用户）
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limit = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10) || 50, 1), 200);

  const rows = (await db
    .select()
    .from(privateDataAudit)
    .where(eq(privateDataAudit.userId, user.sub))
    .orderBy(desc(privateDataAudit.createdAt))
    .limit(limit)) as Array<{
    id: string;
    privateDataId: string | null;
    action: string;
    detail: string | null;
    createdAt: number;
  }>;

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      privateDataId: r.privateDataId,
      action: r.action,
      detail: r.detail ? safeParse(r.detail) : null,
      createdAt: r.createdAt,
    })),
  });
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}