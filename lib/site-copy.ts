// 一次性 AI 文案生成：封装对 /api/ai/copy 的请求，供 builder 与 build-stage 复用（消除双实现）。
import type { ContentOverride } from "@/lib/content-resolver";
import type { IntentNarrative } from "@/lib/ai-intent";

export interface SiteCopyInput {
  projectName: string | null;
  projectType: string | null;
  narrative: IntentNarrative | null;
}

export async function fetchSiteCopyOverride(input: SiteCopyInput): Promise<ContentOverride> {
  const res = await fetch("/api/ai/copy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`copy_${res.status}`);
  return res.json();
}
