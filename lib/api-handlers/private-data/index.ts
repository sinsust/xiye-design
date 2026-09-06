import { NextRequest, NextResponse } from "next/server";
import { db, privateData } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

const TYPES = ["card", "account", "key", "identity", "contract", "other"] as const;
type PrivateType = (typeof TYPES)[number];

function isType(v: unknown): v is PrivateType {
  return typeof v === "string" && (TYPES as readonly string[]).includes(v);
}

// GET /api/private-data → 当前用户全部私人资料（仅元数据，不含密文）
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await db
    .select({
      id: privateData.id,
      type: privateData.type,
      name: privateData.name,
      hint: privateData.hint,
      tags: privateData.tags,
      createdAt: privateData.createdAt,
      updatedAt: privateData.updatedAt,
    })
    .from(privateData)
    .where(eq(privateData.userId, user.sub))
    .orderBy(desc(privateData.updatedAt));
  return NextResponse.json({ items: rows });
}

// POST /api/private-data
// body: { type, name, hint?, tags?, salt, iv, ciphertext }
// 密文由客户端 WebCrypto 用解锁口令加密后上传，服务端只存密文，口令永不经过服务端。
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const json = await req.json().catch(() => null);
    const parsed = z
      .object({
        type: z.string(),
        name: z.string().min(1).max(120),
        hint: z.string().max(300).optional(),
        tags: z.array(z.string().max(40)).max(20).optional(),
        salt: z.string().min(8),
        iv: z.string().min(8),
        ciphertext: z.string().min(8),
      })
      .safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }
    const d = parsed.data;
    if (!isType(d.type)) return NextResponse.json({ error: "invalid_type" }, { status: 400 });

    const now = Date.now();
    const [row] = await db
      .insert(privateData)
      .values({
        id: crypto.randomUUID(),
        userId: user.sub,
        type: d.type,
        name: d.name.trim(),
        hint: d.hint?.trim() ?? "",
        tags: JSON.stringify(d.tags ?? []),
        salt: d.salt,
        iv: d.iv,
        ciphertext: d.ciphertext,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return NextResponse.json({ item: row }, { status: 201 });
  } catch (err) {
    console.error("private-data create failed:", err);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
