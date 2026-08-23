import { NextRequest, NextResponse } from "next/server";
import { db, projects } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  data: z.unknown(),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(eq(projects.userId, user.sub))
    .orderBy(desc(projects.updatedAt));
  return NextResponse.json({ projects: rows });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const id = crypto.randomUUID();
  const now = Date.now();
  const [row] = await db
    .insert(projects)
    .values({
      id,
      userId: user.sub,
      name: parsed.data.name,
      data: JSON.stringify(parsed.data.data),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return NextResponse.json({ project: row }, { status: 201 });
}
