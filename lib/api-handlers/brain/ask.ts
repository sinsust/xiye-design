import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listBrainNotes } from "@/lib/brain-db";
import { brainRetrieve, buildBrainContext, type BrainRagHit } from "@/lib/brain-rag";
import { getImaConfig } from "@/lib/ima-config";
import { listKnowledgeBases, searchKnowledge, getMediaInfo } from "@/lib/ima";
import { logBrainNoteAccess } from "@/lib/brain-reminder";

export const runtime = "nodejs";

export type AskMode = "local" | "ima" | "mixed";

// 引用来源标注：每条被引用的资料都标注来自本地还是 ima（含知识库名）
export interface AskSource {
  noteId: string;
  title: string;
  source: "local" | "ima";
  sourceName?: string;
  relevance?: number;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("ima_timeout")), ms)),
  ]);
}

/**
 * 实时检索用户 ima 知识库并取原文。返回 ima 上下文 + 带来源标注的引用。
 * 防御式：任一步失败都静默跳过/降级，问答回退到本地。
 */
async function enrichWithIma(
  question: string,
  creds: { clientId: string; apiKey: string },
): Promise<{ context: string; sources: AskSource[] }> {
  const kbData = await withTimeout(listKnowledgeBases(creds), 8000);
  const kbs = (kbData.list ?? []).slice(0, 3);
  if (!kbs.length) return { context: "", sources: [] };

  // 每个知识库分别检索，并记住所属知识库名
  const perKb = await Promise.all(
    kbs.map(async (kb: any) => {
      const kbId = String(kb.id ?? kb.knowledge_base_id ?? "");
      const kbName = typeof kb.name === "string" && kb.name.trim() ? kb.name : "";
      if (!kbId) return [];
      try {
        const q = await withTimeout(searchKnowledge(creds, kbId, question), 8000);
        return (q.list ?? [])
          .map((h: any) => ({ h, kbName }))
          .filter((x: any) => x.h?.media_id)
          .slice(0, 2);
      } catch {
        return [];
      }
    }),
  );
  const top = perKb.flat().slice(0, 3);
  if (!top.length) return { context: "", sources: [] };

  const result = await Promise.all(
    top.map(async ({ h, kbName }: { h: any; kbName: string }) => {
      try {
        const mediaId = String(h.media_id);
        const info = await withTimeout(getMediaInfo(creds, mediaId), 8000);
        const text =
          (info.note_content && info.note_content.trim()) ||
          (typeof info.url === "string" ? info.url : "") ||
          "";
        if (!text) return null;
        // 尽力从命中提取相关度（ima 不同版本字段不一致，取不到则省略）
        let relevance: number | undefined;
        const rawRel = h.relevance ?? h.score;
        if (typeof rawRel === "number") relevance = Math.max(0, Math.min(1, rawRel));
        return {
          noteId: `ima-${mediaId}`,
          title: String(h.title ?? h.name ?? "(无标题)"),
          source: "ima" as const,
          sourceName: kbName || undefined,
          relevance,
          text,
        };
      } catch {
        return null;
      }
    }),
  );
  const valid = result.filter(Boolean) as Array<AskSource & { text: string }>;
  if (!valid.length) return { context: "", sources: [] };

  const context = `\n\n【你的 ima 知识库（实时检索到的个人资料）】
${valid.map((c) => `### ${c.title}\n${c.text}`).join("\n\n")}`;
  const sources: AskSource[] = valid.map(({ text: _t, ...rest }) => rest);
  return { context, sources };
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
    const localHits: BrainRagHit[] = useLocal ? await brainRetrieve(notes, question, 4) : [];
    // 被提问引用 → 记访问流水，重置知识衰减计时
    for (const h of localHits) await logBrainNoteAccess(h.id, "rag_reference");

    // ima 实时检索（失败静默跳过）
    let imaContext = "";
    let imaSources: AskSource[] = [];
    if (useIma && imaCfg) {
      try {
        const r = await enrichWithIma(question, imaCfg);
        imaContext = r.context;
        imaSources = r.sources;
      } catch (err) {
        console.error("[brain ask] ima enrich failed:", err);
      }
    }

    // 合并来源标注：本地 + ima
    const localSources: AskSource[] = localHits.map((h) => ({
      noteId: h.id,
      title: h.title,
      source: "local",
      relevance: h.relevance,
    }));
    const sources: AskSource[] = [...localSources, ...imaSources];

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
          .map((s) => `• ${s.title}（${s.source === "ima" ? "来自 ima" + (s.sourceName ? " · " + s.sourceName : "") : "本地笔记"}）`)
          .join("\n")}`,
        sources,
      });
    }

    const localRagContext = buildBrainContext(localHits) + imaContext;
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
              "你是用户的『第二大脑』问答助手，只根据下方提供的个人笔记与 ima 资料回答。回答要基于事实，简洁、有条理；资料里没有的信息要明确说『资料里没有』，不要编造。可以适当指出与问题相关的其他资料。",
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
    return NextResponse.json({ answer, sources });
  } catch (err) {
    console.error("brain ask failed:", err);
    return NextResponse.json({ error: "ask_failed" }, { status: 500 });
  }
}