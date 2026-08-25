import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { addBrainTaskComment, listBrainTaskComments, getBrainTaskById } from "@/lib/brain-db";

export const runtime = "nodejs";

// GET /api/brain/tasks/:id/comments
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const comments = await listBrainTaskComments(user.sub, id);
  return NextResponse.json({ comments });
}

// POST /api/brain/tasks/:id/comments  body: { content }
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim().slice(0, 2000) : "";
  if (!content) return NextResponse.json({ error: "content_required" }, { status: 400 });
  const existing = await getBrainTaskById(user.sub, id);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const comment = await addBrainTaskComment(user.sub, id, content);
  if (!comment) return NextResponse.json({ error: "create_failed" }, { status: 500 });
  return NextResponse.json({ comment });
}