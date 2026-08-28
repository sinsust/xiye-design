import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db, userPreferences } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const runtime = "nodejs";

// custom 是 Record<presetId, PaletteOverride>，覆盖值字段为 string 或 string[]
const paletteField = z.union([z.string(), z.array(z.string())]);
const overrideObject = z.record(z.string(), paletteField);

const putSchema = z.object({
  theme: z.enum(["light", "dark"]).optional(),
  activeStyleId: z.string().max(200).optional(),
  custom: z.record(z.string(), overrideObject).nullable().optional(),
});

function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const rows = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, user.sub))
    .limit(1);
  const row = rows[0];
  return NextResponse.json({
    preference: row
      ? {
          theme: row.theme,
          activeStyleId: row.activeStyleId,
          custom: safeParseJson(row.custom, {}),
        }
      : null,
  });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const json = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const now = Date.now();
  const existing = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, user.sub))
    .limit(1);

  if (existing[0]) {
    const cur = existing[0];
    await db
      .update(userPreferences)
      .set({
        theme: parsed.data.theme ?? cur.theme,
        activeStyleId: parsed.data.activeStyleId ?? cur.activeStyleId,
        custom:
          parsed.data.custom !== undefined
            ? JSON.stringify(parsed.data.custom)
            : cur.custom,
        updatedAt: now,
      })
      .where(eq(userPreferences.userId, user.sub));
  } else {
    await db.insert(userPreferences).values({
      userId: user.sub,
      theme: parsed.data.theme ?? "light",
      activeStyleId: parsed.data.activeStyleId ?? "aw-brutalist",
      custom: JSON.stringify(parsed.data.custom ?? {}),
      updatedAt: now,
    });
  }

  return NextResponse.json({ ok: true });
}