import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  hashPassword,
  signSession,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(100),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();
  const password = parsed.data.password;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: "email_taken" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.insert(users).values({ id, email, passwordHash, createdAt: now });

  const token = await signSession({ sub: id, email });
  const res = NextResponse.json({ user: { id, email } });
  res.cookies.set({ name: SESSION_COOKIE, value: token, ...sessionCookieOptions() });
  return res;
}
