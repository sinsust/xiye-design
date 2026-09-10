// 腾讯 ima 连接器（决策 8/13/19）：read 复用既有只读能力，write 见阶段 B（ima.ts 写适配）。
// read 逻辑为原 lib/api-handlers/brain/ask.ts 的 enrichWithIma 收敛于此，行为保持一致。
import {
  listKnowledgeBases,
  searchKnowledge,
  getMediaInfo,
  createImaNote,
  appendImaNote,
  imaWriteNoteId,
  type ImaCredentials,
} from "@/lib/ima";
import { getImaConfig } from "@/lib/ima-config";
import type {
  Connector,
  ConnectorReadContext,
  ConnectorReadResult,
  ConnectorStatus,
  ConnectorWriteContext,
  ConnectorWriteResult,
} from "./types";

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("ima_timeout")), ms)),
  ]);
}

export class ImaConnector implements Connector {
  id = "ima";
  label = "腾讯 ima 知识库";
  caps = { read: true, write: true };

  status(creds?: unknown): Promise<ConnectorStatus> {
    // creds 为 {email?, clientId?, apiKey?}；缺省时推断：imaConfig 需要 email
    const email = (creds as { email?: string } | undefined)?.email;
    if (email) {
      return getImaConfig(email).then(
        (c) =>
          c
            ? { ok: true, available: true, label: "已绑定" }
            : { ok: false, available: false, message: "未绑定 ima 凭证" },
      );
    }
    return Promise.resolve({ ok: false, available: false, message: "缺少 email 无法校验" });
  }

  async read(ctx: ConnectorReadContext, creds?: unknown): Promise<ConnectorReadResult> {
    const question = ctx.question ?? "";
    if (!creds || !question) return { context: "", sources: [] };
    const c = creds as ImaCredentials;

    const kbData = await withTimeout(listKnowledgeBases(c), 8000);
    const kbs = (kbData.list ?? []).slice(0, 3);
    if (!kbs.length) return { context: "", sources: [] };

    const perKb = await Promise.all(
      kbs.map(async (kb: any) => {
        const kbId = String(kb.id ?? kb.knowledge_base_id ?? "");
        const kbName = typeof kb.name === "string" && kb.name.trim() ? kb.name : "";
        if (!kbId) return [];
        try {
          const q = await withTimeout(searchKnowledge(c, kbId, question), 8000);
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
          const info = await withTimeout(getMediaInfo(c, mediaId), 8000);
          const text =
            (info.note_content && info.note_content.trim()) ||
            (typeof info.url === "string" ? info.url : "") ||
            "";
          if (!text) return null;
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
    const valid = result.filter(Boolean) as Array<ConnectorReadResult["sources"][number] & { text: string }>;
    if (!valid.length) return { context: "", sources: [] };

    const context = `\n\n【你的 ima 知识库（实时检索到的个人资料）】
${valid.map((c) => `### ${c.title}\n${c.text}`).join("\n\n")}`;
    const sources: ConnectorReadResult["sources"] = valid.map(({ text: _t, ...rest }) => rest);
    return { context, sources };
  }

  async write(ctx: ConnectorWriteContext, creds?: unknown): Promise<ConnectorWriteResult> {
    const { action, kbId, title, content, noteId } = ctx;
    if (!content) return { ok: false, detail: "content_required" };
    if (!creds) return { ok: false, detail: "未绑定 ima 凭证" };
    const c = creds as ImaCredentials;
    try {
      const out = await (action === "append"
        ? appendImaNote(c, noteId ?? "", content)
        : createImaNote(c, { content, title, kbId }));
      // 实测返回 data.note_id；早期读 out.id 恒为 undefined，导致写回成功却存不下定位 id
      return { ok: true, noteId: imaWriteNoteId(out) ?? undefined, noteUrl: (out as any)?.url };
    } catch (err) {
      return { ok: false, degraded: true, detail: err instanceof Error ? err.message : "ima_write_failed" };
    }
  }
}