import { NextRequest, NextResponse } from "next/server";
import { db, agentSettings } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

// 允许自定义的角色（与 app/workflow/agents.ts 的 AgentId 一致）
const ROLES = ["moderator", "pm", "architect", "designer", "guard"] as const;

const itemSchema = z.object({
  role: z.enum(ROLES),
  name: z.string().trim().min(1).max(30),
  avatarUrl: z.union([z.string().trim().min(1).max(50000), z.null()]).optional(),
});
const putSchema = z.object({
  agents: z.array(itemSchema).max(8),
  // 当前选中的风格 id（与 lib/agent-styles.ts 的 AgentStyleId 对齐）
  styleId: z.string().trim().min(1).max(20).optional(),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const rows = await db
    .select({
      role: agentSettings.role,
      name: agentSettings.name,
      avatarUrl: agentSettings.avatarUrl,
      styleId: agentSettings.styleId,
    })
    .from(agentSettings)
    .where(eq(agentSettings.userId, user.sub));
  return NextResponse.json({ agents: rows });
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
  const styleId = parsed.data.styleId ?? null;
  await Promise.all(
    parsed.data.agents.map((item) =>
      db
        .insert(agentSettings)
        .values({
          userId: user.sub,
          role: item.role,
          name: item.name,
          avatarUrl: item.avatarUrl ?? null,
          styleId,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [agentSettings.userId, agentSettings.role],
          set: {
            name: item.name,
            avatarUrl: item.avatarUrl ?? null,
            styleId,
            updatedAt: now,
          },
        }),
    ),
  );
  return NextResponse.json({ ok: true });
}