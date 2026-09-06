import { NextRequest, NextResponse } from "next/server";
import { db, projects, projectCheckpoints } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; cid: string }> };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, cid } = await params;

  // 归属校验：checkpoint 属于 project，project 属于 user
  const [proj] = await db
    .select({ uid: projects.userId })
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  if (!proj) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (proj.uid !== user.sub)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await db
    .delete(projectCheckpoints)
    .where(and(eq(projectCheckpoints.id, cid), eq(projectCheckpoints.projectId, id)));
  return NextResponse.json({ ok: true });
}
