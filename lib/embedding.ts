// 本地向量检索（零成本方案）：
// 用 @xenova/transformers + Xenova/all-MiniLM-L6-v2（384 维）在 Node.js 本地做语义向量。
// 首次调用自动下载模型（~80MB，缓存到用户目录），之后纯离线，数据不出本机、0 元 API 费用。
//
// 设计要点：
// - 单例加载 pipeline，避免多次重复加载模型；
// - embed() 内部动态 import + try/catch：模型不可用（下载失败/环境不支持）时返回 null，
//   调用方据此降级为关键词匹配，绝不阻断主流程。

import type { Pipeline } from "@xenova/transformers";

let embedderPromise: Promise<Pipeline> | null = null;

/**
 * 生成文本向量（384 维归一化 float 数组）。模型加载/推理失败返回 null，调用方降级。
 */
export async function embed(text: string): Promise<number[] | null> {
  if (!text?.trim()) return null;
  try {
    if (!embedderPromise) {
      embedderPromise = (async () => {
        const { pipeline } = await import("@xenova/transformers");
        return (await pipeline(
          "feature-extraction",
          "Xenova/all-MiniLM-L6-v2",
        )) as unknown as Pipeline;
      })();
    }
    const model = await embedderPromise;
    const output = await model(text, { pooling: "mean", normalize: true });
    // output.data 为 Float32Array（按行展平），单条文本即 384 维向量
    const data: any = (output as any).data ?? (output as any).tolist?.()[0];
    return Array.from(data) as number[];
  } catch (err) {
    // 首次失败也重置单例，下次可重试；并避免反复抛错拖垮主流程
    embedderPromise = null;
    console.error("[embedding] failed:", err);
    return null;
  }
}

/**
 * 归一化一条笔记为 embedding 输入文本：
 * title + content(前 500 字符) + summary + tags。
 */
export function buildListableText(note: {
  title?: string;
  content?: string;
  summary?: string;
  tags?: string[];
}): string {
  const title = note.title?.trim() ?? "";
  const content = (note.content ?? "").slice(0, 500);
  const summary = note.summary?.trim() ?? "";
  const tags = (note.tags ?? []).filter(Boolean).join(" ");
  return [title, content, summary, tags].filter(Boolean).join("\n");
}