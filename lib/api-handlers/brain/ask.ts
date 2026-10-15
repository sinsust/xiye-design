import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listBrainNotes } from "@/lib/brain-db";
import { brainRetrieve, buildBrainContext, type BrainRagHit } from "@/lib/brain-rag";
import { embeddingEnabled } from "@/lib/embedding";
import { getImaConfig } from "@/lib/ima-config";
import { listConnectors } from "@/lib/connectors/registry";
import { logBrainNoteAccess } from "@/lib/brain-reminder";
import { resolveLLM } from "@/lib/llm/resolve";
import { MODEL_NOT_CONFIGURED_MESSAGE } from "@/lib/llm/chat";
import { recordUsageFromModel } from "@/lib/llm/usage";
// 来源细分与标签下放到纯逻辑模块：前后端共用一份定义，且可脱离请求上下文验证
import { localSourceOf, sourceMention, type AskSource } from "@/lib/brain-ask-source";

export const runtime = "nodejs";

export type AskMode = "local" | "ima" | "mixed";
export type { AskSource };

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("connector_timeout")), ms)),
  ]);
}

// POST /api/brain/ask
// body: { question; mode?: "local"|"ima"|"mixed" }
// 用「当前用户的私有笔记 + 已绑定 ima」做 RAG。mode 控制检索范围：
//   local → 仅本地笔记；ima → 仅 ima；mixed（默认）→ 本地 + ima 合并。
// 返回 { answer, sources }，每条引用标注来源。
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    if (!question) return NextResponse.json({ error: "question_required" }, { status: 400 });
    const mode: AskMode =
      body?.mode === "local" || body?.mode === "ima" ? body.mode : "mixed";

    const useLocal = mode !== "ima";
    const useIma = mode !== "local";

    const notes = useLocal ? await listBrainNotes(user.sub) : [];
    const imaCfg = useIma ? await getImaConfig(user.email) : null;

    if (!notes.length && !imaCfg) {
      return NextResponse.json({
        answer:
          "你的第二大脑还是空的。先在上方「随手记」里扔几段内容（会议纪要、学习笔记、想法……），整理入库后我就能基于你的笔记来回答；或在「个人中心」绑定腾讯 ima，直接调用你自己的 ima 资料。",
        sources: [],
      });
    }

    // 本地检索（brainRetrieve 默认语义检索，向量缺失自动降级关键词）
    const semanticCapable = embeddingEnabled();
    const localHits: BrainRagHit[] = useLocal ? await brainRetrieve(notes, question, 4) : [];
    // 被提问引用 → 记访问流水，重置知识衰减计时
    for (const h of localHits) await logBrainNoteAccess(h.id, "rag_reference");

    // 外部连接器统一入口：遍历 registry 中已注册的读连接器（当前为 ima），失败静默降级。
    // 凭据按连接器 id 在下方解析表登记；将来接入 Obsidian / 本地文件连接器时，只需在此加一行。
    const connectorCreds: Record<string, unknown> = {};
    if (useIma && imaCfg) connectorCreds.ima = imaCfg;

    let connectorContext = "";
    const connectorSources: AskSource[] = [];
    for (const conn of listConnectors()) {
      if (!conn.read) continue;
      const creds = connectorCreds[conn.id];
      if (!creds) continue;
      try {
        const r = await withTimeout(conn.read({ question }, creds), 8000);
        connectorContext += r.context;
        connectorSources.push(...(r.sources as AskSource[]));
      } catch (err) {
        console.error(`[brain ask] connector ${conn.id} enrich failed:`, err);
      }
    }

    // 合并来源标注：本地命中按溯源细分为 随手记 / Obsidian / ima 同步，连接器贡献为 ima 实时
    const noteById = new Map(notes.map((n) => [n.id, n]));
    const localSources: AskSource[] = localHits.map((h) => {
      const { source, sourceName } = localSourceOf(noteById.get(h.id));
      return { noteId: h.id, title: h.title, source, sourceName, relevance: h.relevance };
    });
    const sources: AskSource[] = [...localSources, ...connectorSources];

    const model = await resolveLLM(user.sub, "brain-ask");
    if (!model) {
      return NextResponse.json({ error: "model_not_configured", message: MODEL_NOT_CONFIGURED_MESSAGE }, { status: 412 });
    }

    if (!sources.length) {
      return NextResponse.json({
        answer:
          "我在" +
          (useLocal ? "你的笔记" : "") +
          (useLocal && useIma ? "和" : "") +
          (useIma ? "ima 知识库" : "") +
          "里都没找到与这个问题直接相关的内容（只检索你自己的资料）。可以换种问法，或先把相关资料扔进「随手记」/ 导入 ima。",
        sources: [],
      });
    }

    const localRagContext = buildBrainContext(localHits) + connectorContext;

    // P2-1：把「LLM 生成总结」与「本地检索」解耦。
    // 本地命中在上一步已经算出，因此模型超时/异常时不应整体返回 500 ——
    // 那会让用户连已检索到的来源都看不到。这里降级为「只给来源 + 明确提示」，
    // 并置 degraded 标记，绝不把降级结果伪装成模型结论。
    try {
      const startedAt = Date.now();
      const llmRes = await fetch(`${model.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(model.apiKey ? { Authorization: `Bearer ${model.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: model.model,
          temperature: 0.4,
          stream: true,
          stream_options: { include_usage: true },
          messages: [
            {
              role: "system",
              content:
                "你是用户的『第二大脑』问答助手，只根据下方提供的个人资料（含本地随手记、已同步的 Obsidian 笔记、ima 知识库）回答。回答要基于事实，简洁、有条理；资料里没有的信息要明确说『资料里没有』，不要编造。可以适当指出与问题相关的其他资料。",
            },
            { role: "user", content: `用户问题：${question}\n${localRagContext}` },
          ],
        }),
        // 由 30s 收敛到 15s：总结性回答超过 15s 对「3 秒找回」的心智已无意义，
        // 更快降级 = 更快给用户可用结果。
        signal: AbortSignal.timeout(15000),
      });
      if (!llmRes.ok) throw new Error(`brain_ask_${llmRes.status}`);
      if (!llmRes.body) throw new Error("brain_ask_no_body");

      // P2-1 流式：先发 meta（来源）事件，再逐 delta 转发 answer。
      // 首字节通常数百毫秒内到达 → 满足「首字节<1s、可见即所得」（完整答案仍受模型速度限制）。
      const encoder = new TextEncoder();
      let usage: { usage?: unknown } | null = null;
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const send = (event: string, data: unknown) =>
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          send("meta", { sources, semantic: semanticCapable });
          const reader = llmRes.body!.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });
              let idx: number;
              while ((idx = buf.indexOf("\n\n")) !== -1) {
                const chunk = buf.slice(0, idx);
                buf = buf.slice(idx + 2);
                const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"));
                if (!dataLine) continue;
                const payload = dataLine.slice(5).trim();
                if (!payload || payload === "[DONE]") continue;
                try {
                  const json = JSON.parse(payload);
                  if (json.usage) usage = json;
                  const delta: string | undefined = json.choices?.[0]?.delta?.content;
                  if (delta) send("delta", { text: delta });
                } catch {
                  /* 跳过不完整/畸形 chunk */
                }
              }
            }
          } catch (err) {
            console.error("brain ask stream failed:", err instanceof Error ? err.message : err);
            send("error", { degraded: true, message: "生成中断，已显示已检索到的来源" });
          } finally {
            if (usage?.usage) recordUsageFromModel(model, usage as object, startedAt, "brain-ask");
            controller.close();
          }
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    } catch (err) {
      console.error("brain ask llm degraded:", err instanceof Error ? err.message : err);
      return NextResponse.json({
        answer: sources.length
          ? "我已经从你的资料里找到以下内容，但本次未能生成总结（模型超时或不可用）。你可以先查看下方来源，或稍后重试。"
          : "本次没能检索到相关内容，也没能生成回答（模型超时或不可用）。请稍后重试，或换个说法再问。",
        sources,
        semantic: semanticCapable,
        degraded: true,
      });
    }
  } catch (err) {
    console.error("brain ask failed:", err);
    return NextResponse.json({ error: "ask_failed" }, { status: 500 });
  }
}