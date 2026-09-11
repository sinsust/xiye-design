import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listBrainNotes } from "@/lib/brain-db";
import { brainRetrieve, buildBrainContext, type BrainRagHit } from "@/lib/brain-rag";
import { embeddingEnabled } from "@/lib/embedding";
import { getImaConfig } from "@/lib/ima-config";
import { listConnectors } from "@/lib/connectors/registry";
import { logBrainNoteAccess } from "@/lib/brain-reminder";
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

    const apiKey = process.env.LLM_MODEL_API_KEY;
    const baseUrl = process.env.LLM_MODEL_BASE_URL;
    const model = process.env.LLM_MODEL_MODEL_ID;

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

    if (!(apiKey && baseUrl && model)) {
      return NextResponse.json({
        answer: `找到了 ${sources.length} 条相关记录，但当前未配置 LLM 无法生成回答。相关片段如下：\n\n${sources
          .map((s) => `• ${s.title}（${sourceMention(s)}）`)
          .join("\n")}`,
        sources,
        semantic: semanticCapable,
      });
    }

    const localRagContext = buildBrainContext(localHits) + connectorContext;
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "你是用户的『第二大脑』问答助手，只根据下方提供的个人资料（含本地随手记、已同步的 Obsidian 笔记、ima 知识库）回答。回答要基于事实，简洁、有条理；资料里没有的信息要明确说『资料里没有』，不要编造。可以适当指出与问题相关的其他资料。",
          },
          { role: "user", content: `用户问题：${question}\n${localRagContext}` },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`brain_ask_${res.status}`);
    const data = await res.json();
    const answer: string = data?.choices?.[0]?.message?.content ?? "";
    if (!answer) throw new Error("brain_ask_empty");
    return NextResponse.json({ answer, sources, semantic: semanticCapable });
  } catch (err) {
    console.error("brain ask failed:", err);
    return NextResponse.json({ error: "ask_failed" }, { status: 500 });
  }
}