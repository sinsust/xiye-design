import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import {
  generateCopyOverride,
  generateCopyWithLLM,
  type CopyContext,
} from "@/lib/copy-generator";

export const runtime = "nodejs";

// POST /api/ai/copy
// body: { projectName?; projectType?; narrative? }
// 200  → ContentOverride（根据项目 PRD/特征生成的全站文案覆盖）
// 文案生成默认使用 LLM_MODEL_*（Qwen），不走 DeepSeek；未配置或调用失败时回退本地启发式
export async function POST(req: NextRequest) {
  if (!rateLimit(`ai:${getClientIp(req)}`, 30, 60_000)) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { "Content-Type": "application/json" } });
  }
  try {
    const body = await req.json().catch(() => null);
    const ctx: CopyContext = {
      projectName: typeof body?.projectName === "string" ? body.projectName : null,
      projectType: typeof body?.projectType === "string" ? body.projectType : null,
      narrative: body?.narrative && typeof body.narrative === "object" ? body.narrative : null,
    };

    const baseUrl = process.env.LLM_MODEL_BASE_URL;
    const model = process.env.LLM_MODEL_MODEL_ID;
    const apiKey = process.env.LLM_MODEL_API_KEY;
    if (baseUrl && model && apiKey) {
      try {
        const override = await generateCopyWithLLM(ctx, apiKey, baseUrl, model);
        return NextResponse.json(override);
      } catch {
        // Qwen 失败 → 回退启发式
      }
    }
    return NextResponse.json(generateCopyOverride(ctx));
  } catch {
    return NextResponse.json({ error: "copy_failed" }, { status: 502 });
  }
}