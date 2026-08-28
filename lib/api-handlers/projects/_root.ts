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

// 从项目快照解析轻量摘要：类型（流程草稿 / 搭建工作区）+ 产品名（供列表展示，避免回传整份 data）
function projectSummary(raw: unknown): {
  kind: "flow" | "builder";
  productName?: string;
} {
  if (typeof raw !== "string") return { kind: "builder" };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const d =
      parsed.flow && !parsed.skeleton
        ? (parsed.flow as Record<string, unknown>)
        : parsed;
    const isFlow = Boolean(d.intentNarrative || d.productBrief || d.currentStep != null);
    const pb = d.productBrief as { name?: string } | undefined;
    const pi = d.projectInfo as { projectName?: string } | undefined;
    const narr = d.intentNarrative as { vision?: string } | undefined;
    const productName = pb?.name || pi?.projectName || narr?.vision?.slice(0, 24) || undefined;
    return { kind: isFlow ? "flow" : "builder", productName };
  } catch {
    return { kind: "builder" };
  }
}

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
      data: projects.data,
    })
    .from(projects)
    .where(eq(projects.userId, user.sub))
    .orderBy(desc(projects.updatedAt));
  const items = rows.map(
    (r: { id: string; name: string; createdAt: number; updatedAt: number; data: string }) => {
    const s = projectSummary(r.data);
    return {
      id: r.id,
      name: r.name,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      kind: s.kind,
      productName: s.productName,
    };
  });
  return NextResponse.json({ projects: items });
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
