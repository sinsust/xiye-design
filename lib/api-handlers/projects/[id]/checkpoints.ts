import { NextRequest, NextResponse } from "next/server";
import { db, projects, projectCheckpoints } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

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
    .from(projectCheckpoints)
    .where(eq(projectCheckpoints.projectId, id))
    .orderBy(desc(projectCheckpoints.createdAt));
  return NextResponse.json({ checkpoints: rows });
}

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
      data: z.unknown(),
      label: z.string().max(120).optional(),
    })
    .safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const [row] = await db
    .insert(projectCheckpoints)
    .values({
      id: crypto.randomUUID(),
      projectId: id,
      userId: user.sub,
      data: JSON.stringify(parsed.data.data),
      label: parsed.data.label ?? "",
      createdAt: Date.now(),
    })
    .returning();
  return NextResponse.json({ checkpoint: row }, { status: 201 });
}
