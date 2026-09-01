// 本地向量检索（零成本方案）：
// 用 @xenova/transformers + Xenova/all-MiniLM-L6-v2（384 维）在 Node.js 本地做语义向量。
// 首次调用自动下载模型（~80MB，缓存到可写目录），之后纯离线，数据不出本机、0 元 API 费用。
//
// 设计要点：
// - 单例加载 pipeline，避免多次重复加载模型；
// - embed() 内部动态 import + try/catch：模型不可用（下载失败/环境不支持/被显式禁用）时返回 null，
//   调用方据此降级为关键词匹配，绝不阻断主流程。
// - Serverless（如 Vercel）下模型下载可能超时或只读 FS 失败：通过 EMBEDDING_ENABLED 关闭语义检索，
//   并把缓存目录指向 /tmp；降级时统一 warn 一次，避免「静默降级无感知」。
//   注：要让 Serverless 真正跑语义检索，需把模型 baked-in 进部署包（TRANSFORMERS_CACHE_DIR 指向打包内模型），
//   否则冷启动仍会尝试联网下载 80MB 模型（可能触发函数超时）。

import type { Pipeline } from "@xenova/transformers";

let embedderPromise: Promise<Pipeline> | null = null;

// 是否启用语义向量（默认开启）。Serverless 等无法稳定加载本地模型、或想省去 80MB 模型下载的环境，
// 可设置 EMBEDDING_ENABLED=false，避免每次冷启动都尝试下载模型导致请求超时。
const EMBEDDING_ENABLED = !/^(false|0|no|off)$/i.test(
  process.env.EMBEDDING_ENABLED ?? "true",
);

let warnedDisabled = false;
function warnEmbeddingDisabled(reason: string) {
  if (warnedDisabled) return;
  warnedDisabled = true;
  console.warn(
    `[embedding] 语义向量不可用（${reason}）—— 检索已降级为关键词匹配。` +
      ` 若需语义检索，请在部署环境配置 EMBEDDING_ENABLED=true 并将模型 baked-in（TRANSFORMERS_CACHE_DIR 指向打包内模型）。`,
  );
}

/** 语义向量能力是否开启（供 RAG / 前端判断检索模式，避免静默降级无感知） */
export function embeddingEnabled(): boolean {
  return EMBEDDING_ENABLED;
}

/**
 * 生成文本向量（384 维归一化 float 数组）。模型加载/推理失败或禁用时返回 null，调用方降级。
 */
export async function embed(text: string): Promise<number[] | null> {
  if (!text?.trim()) return null;
  if (!EMBEDDING_ENABLED) {
    warnEmbeddingDisabled("EMBEDDING_ENABLED=false");
    return null;
  }
  try {
    if (!embedderPromise) {
      embedderPromise = (async () => {
        const { pipeline, env } = await import("@xenova/transformers");
        // 缓存目录：优先用环境变量；Vercel 等只读 FS 用 /tmp（可写），否则用库默认（用户目录）
        if (process.env.TRANSFORMERS_CACHE_DIR) {
          env.cacheDir = process.env.TRANSFORMERS_CACHE_DIR;
        } else if (process.env.VERCEL) {
          env.cacheDir = "/tmp/transformers-cache";
        }
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
    warnEmbeddingDisabled("模型加载/推理失败");
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
