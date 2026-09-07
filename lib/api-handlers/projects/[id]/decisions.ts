import { NextRequest, NextResponse } from "next/server";
import { db, projects, decisionLedger } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import type { DecisionLedgerRow } from "@/lib/db/schema";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const DECISION_STATUS = z.enum(["accepted", "rejected", "hypothesis"]);

/** 校验项目归属：不存在返回 404，非本人返回 403 */
async function ownedProjectOrFail(id: string, userId: string) {
  const [row] = await db
    .select({ uid: projects.userId })
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  if (!row) return { status: 404 as const };
  if (row.uid !== userId) return { status: 403 as const };
  return { status: 200 as const };
}

// GET /api/projects/[id]/decisions → 该项目的决策台账列表（按创建时间倒序）
export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const owned = await ownedProjectOrFail(id, user.sub);
  if (owned.status !== 200)
    return NextResponse.json(
      { error: owned.status === 404 ? "not_found" : "forbidden" },
      { status: owned.status },
    );
  const rows = await db
    .select()
    .from(decisionLedger)
    .where(eq(decisionLedger.projectId, id))
    .orderBy(desc(decisionLedger.createdAt));
  return NextResponse.json({ decisions: rows });
}

// POST /api/projects/[id]/decisions → 新建决策；body { title, detail?, status?, reason? }
// status 省略时默认 hypothesis（待验证）。title 在同一项目内唯一，重复 title 按「转态」更新。
export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const owned = await ownedProjectOrFail(id, user.sub);
  if (owned.status !== 200)
    return NextResponse.json(
      { error: owned.status === 404 ? "not_found" : "forbidden" },
      { status: owned.status },
    );

  const json = await req.json().catch(() => null);
  const parsed = z
    .object({
      title: z.string().trim().min(1).max(160),
      detail: z.string().max(2000).optional(),
      status: DECISION_STATUS.optional(),
      reason: z.string().max(2000).optional(),
    })
    .safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const { title } = parsed.data;
  const detail = parsed.data.detail ?? "";
  const status = parsed.data.status ?? "hypothesis";
  const reason = parsed.data.status ? (parsed.data.reason ?? "") : "";

  // 按标题判断是否已存在（决策台账以 title 为唯一业务键；存在则转态/更新，不存在则新建）
  const existingRows = (await db
    .select()
    .from(decisionLedger)
    .where(eq(decisionLedger.projectId, id))
    .limit(100)) as DecisionLedgerRow[];
  const hit = existingRows
    .filter((r) => r.title === title)
    .sort((a, b) => a.createdAt - b.createdAt)[0];

  if (hit) {
    const [row] = await db
      .update(decisionLedger)
      .set({
        detail: detail || hit.detail,
        status,
        reason: reason || hit.reason,
        updatedAt: Date.now(),
      })
      .where(eq(decisionLedger.id, hit.id))
      .returning();
    return NextResponse.json({ decision: row });
  }

  const [row] = await db
    .insert(decisionLedger)
    .values({
      id: crypto.randomUUID(),
      projectId: id,
      userId: user.sub,
      title,
      detail,
      status,
      reason,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    .returning();
  return NextResponse.json({ decision: row }, { status: 201 });
}