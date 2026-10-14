import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { z } from "zod";
import { updateModel, deleteModel, isModelInUse, listModels } from "@/lib/llm/config-store";

export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  provider: z.string().min(1).max(50).optional(),
  baseUrl: z.string().trim().min(1).max(500).optional(),
  model: z.string().trim().min(1).max(200).optional(),
  // undefined=保持不变；null/""=清空；非空=加密存储
  apiKey: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

// PATCH /api/ai/models/[id] —— 编辑模型
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const ok = await updateModel(user.sub, id, parsed.data);
  if (!ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // 回读一次（走对外视图，不含明文 Key）
  const all = await listModels(user.sub);
  const model = all.find((m) => m.id === id) ?? null;
  return NextResponse.json({ ok: true, model });
}

// DELETE /api/ai/models/[id] —— 删除模型（正在使用（当前生效/功能指定）需先切换）
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (await isModelInUse(user.sub, id)) {
    return NextResponse.json({ error: "model_in_use" }, { status: 409 });
  }
  const ok = await deleteModel(user.sub, id);
  if (!ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}