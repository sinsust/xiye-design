import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { z } from "zod";
import { getSettings, saveSettings, getModelById } from "@/lib/llm/config-store";
import { isFeatureKey } from "@/lib/llm/features";

export const runtime = "nodejs";

// GET /api/ai/models/settings —— 当前生效模型 + 功能级分配
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const settings = await getSettings(user.sub);
  return NextResponse.json({ settings });
}

const putSchema = z.object({
  activeModelId: z.string().max(200).nullable().optional(),
  featureMap: z.record(z.string(), z.string()).optional(),
});

// PUT /api/ai/models/settings —— 设当前生效模型 / 功能级指定模型
// 校验：模型必须存在；功能 key 必须合法；未指定的功能跟随「当前生效」
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

  if (parsed.data.activeModelId) {
    const m = await getModelById(user.sub, parsed.data.activeModelId);
    if (!m) {
      return NextResponse.json({ error: "model_not_found" }, { status: 400 });
    }
  }

  let featureMap: Record<string, string> | undefined;
  if (parsed.data.featureMap !== undefined) {
    featureMap = {};
    for (const [key, modelId] of Object.entries(parsed.data.featureMap)) {
      if (!isFeatureKey(key)) continue;
      if (!modelId) continue;
      const m = await getModelById(user.sub, modelId);
      if (!m) {
        return NextResponse.json({ error: "model_not_found", feature: key }, { status: 400 });
      }
      featureMap[key] = modelId;
    }
  }

  await saveSettings(user.sub, {
    activeModelId: parsed.data.activeModelId,
    featureMap,
  });
  const settings = await getSettings(user.sub);
  return NextResponse.json({ ok: true, settings });
}