import { NextRequest, NextResponse } from "next/server";
import { db, privateData, privateDataAudit } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** 校验归属：不存在 404，非本人 403 */
async function ownedOrFail(id: string, userId: string) {
  const [row] = await db
    .select({ uid: privateData.userId })
    .from(privateData)
    .where(eq(privateData.id, id))
    .limit(1);
  if (!row) return { status: 404 as const };
  if (row.uid !== userId) return { status: 403 as const };
  return { status: 200 as const };
}

// GET /api/private-data/[id] → 返回完整密文（含 salt/iv/ciphertext），供客户端解密
export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const owned = await ownedOrFail(id, user.sub);
  if (owned.status !== 200)
    return NextResponse.json(
      { error: owned.status === 404 ? "not_found" : "forbidden" },
      { status: owned.status },
    );
  const [row] = await db.select().from(privateData).where(eq(privateData.id, id)).limit(1);
  return NextResponse.json({ item: row });
}

// PUT /api/private-data/[id]
// body: { name?, hint?, tags?, salt?, iv?, ciphertext? } —— 至少传字段
export async function PUT(req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const owned = await ownedOrFail(id, user.sub);
  if (owned.status !== 200)
    return NextResponse.json(
      { error: owned.status === 404 ? "not_found" : "forbidden" },
      { status: owned.status },
    );
  try {
    const json = await req.json().catch(() => null);
    const parsed = z
      .object({
        name: z.string().min(1).max(120).optional(),
        hint: z.string().max(300).optional(),
        tags: z.array(z.string().max(40)).max(20).optional(),
        salt: z.string().min(8).optional(),
        iv: z.string().min(8).optional(),
        ciphertext: z.string().min(8).optional(),
      })
      .safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

    const d = parsed.data;
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (d.name !== undefined) patch.name = d.name.trim();
    if (d.hint !== undefined) patch.hint = d.hint.trim();
    if (d.tags !== undefined) patch.tags = JSON.stringify(d.tags);
    if (d.salt !== undefined) patch.salt = d.salt;
    if (d.iv !== undefined) patch.iv = d.iv;
    if (d.ciphertext !== undefined) patch.ciphertext = d.ciphertext;

    const [row] = await db.update(privateData).set(patch).where(eq(privateData.id, id)).returning();
    return NextResponse.json({ item: row });
  } catch (err) {
    console.error("private-data update failed:", err);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}

// DELETE /api/private-data/[id]
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const owned = await ownedOrFail(id, user.sub);
  if (owned.status !== 200)
    return NextResponse.json(
      { error: owned.status === 404 ? "not_found" : "forbidden" },
      { status: owned.status },
    );
  // 先取去敏元数据（name/type）便于删除审计，再落审计、删数据（决策 20）
  const [row] = await db
    .select({ name: privateData.name, type: privateData.type })
    .from(privateData)
    .where(eq(privateData.id, id))
    .limit(1);
  await db.insert(privateDataAudit).values({
    id: crypto.randomUUID(),
    userId: user.sub,
    privateDataId: id,
    action: "delete",
    detail: JSON.stringify({
      name: row?.name ?? "",
      type: row?.type ?? "",
      deletedAt: Date.now(),
    }),
    createdAt: Date.now(),
  });
  await db.delete(privateData).where(eq(privateData.id, id));
  return NextResponse.json({ ok: true });
}
