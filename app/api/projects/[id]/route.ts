import { NextRequest, NextResponse } from "next/server";
import { db, projects } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

type Owned = "not_found" | "forbidden" | (typeof projects.$inferSelect);

async function ownedProject(id: string, userId: string): Promise<Owned> {
  const [row] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  if (!row) return "not_found";
  if (row.userId !== userId) return "forbidden";
  return row;
}

function forbidden(res: Owned) {
  if (res === "not_found")
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const row = await ownedProject(id, user.sub);
  if (typeof row === "string") return forbidden(row);
  return NextResponse.json({ project: row });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const row = await ownedProject(id, user.sub);
  if (typeof row === "string") return forbidden(row);

  const updateSchema = z.object({
    name: z.string().min(1).max(120).optional(),
    data: z.unknown().optional(),
  });
  const json = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const patch: Partial<typeof projects.$inferInsert> = { updatedAt: Date.now() };
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.data !== undefined)
    patch.data = JSON.stringify(parsed.data.data);

  const [updated] = await db
    .update(projects)
    .set(patch)
    .where(eq(projects.id, id))
    .returning();
  return NextResponse.json({ project: updated });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const row = await ownedProject(id, user.sub);
  if (typeof row === "string") return forbidden(row);
  await db.delete(projects).where(eq(projects.id, id));
  return NextResponse.json({ ok: true });
}
