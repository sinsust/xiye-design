// M4 决策 8：IMA 双向写——把 xiye 第二大脑的内容写入用户的 ima 知识库。
// 能力经 Connector 抽象（lib/connectors/ima.ts → lib/ima.ts createImaNote/appendImaNote）。
//
// 两种用法：
//  A. 写回本地笔记（UI 主路径）：body { xiyeNoteId, force?: "create"|"append" }
//     - 该笔记已有 ima 笔记映射（brain_notes.ima_note_id）→ append_doc 追加
//     - 否则 → import_doc 新建，并把返回的 ima note_id 存回笔记，供下次追加定位
//  B. 直接写内容（底层契约，供内部调用）：body { action, content, title?, kbId?, noteId? }
//
// 防御设计：未绑定返回 409；合约/权限异常返回 502 + degraded 标记，绝不伪装成功。
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getImaConfig } from "@/lib/ima-config";
import { getConnector } from "@/lib/connectors/registry";
import { getBrainNote, updateBrainNote } from "@/lib/brain-db";
import type { BrainNote } from "@/lib/brain-db";

export const runtime = "nodejs";

const SOURCE_LABEL: Record<string, string> = {
  text: "xiye 随手记",
  obsidian: "Obsidian",
  ima: "ima",
  file: "文件导入",
};

/** 把一条笔记渲染成写入 ima 的 Markdown 正文（与 Obsidian 写回刻意区分：不带 frontmatter）。 */
export function composeImaMarkdown(note: BrainNote): string {
  const parts: string[] = [];
  const meta: string[] = [];
  if (note.category) meta.push(`分类：${note.category}`);
  if (note.tags.length) meta.push(`标签：${note.tags.map((t) => `#${t}`).join(" ")}`);
  meta.push(`来源：${SOURCE_LABEL[note.source] ?? "xiye"}`);
  parts.push(`# ${note.title || "未命名"}`);
  parts.push(`> ${meta.join(" · ")}`);
  if (note.summary?.trim()) parts.push(note.summary.trim());
  parts.push("---");
  parts.push(note.content?.trim() || "(无正文)");
  return parts.join("\n\n") + "\n";
}

async function writeRaw(
  user: { email: string },
  params: {
    action: "create" | "append";
    content: string;
    title?: string;
    kbId?: string;
    noteId?: string;
  },
) {
  let cfg;
  try {
    cfg = await getImaConfig(user.email);
  } catch {
    cfg = null;
  }
  if (!cfg) {
    return NextResponse.json({ error: "ima_not_configured" }, { status: 409 });
  }
  const conn = getConnector("ima");
  if (!conn?.write) {
    return NextResponse.json({ error: "ima_write_unavailable" }, { status: 500 });
  }
  try {
    const r = await conn.write(
      {
        action: params.action,
        kbId: params.kbId,
        title: params.title,
        content: params.content,
        noteId: params.noteId,
      },
      cfg,
    );
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, degraded: !!r.degraded, detail: r.detail ?? "ima_write_failed" },
        { status: 502 },
      );
    }
    return { ok: true as const, noteId: r.noteId };
  } catch (err) {
    console.error("[brain ima/write] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        degraded: true,
        detail: err instanceof Error ? err.message : "ima_write_failed",
      },
      { status: 502 },
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);

  // ---- B. 底层契约：直接写内容 ----
  if (!body?.xiyeNoteId) {
    const action = body?.action === "append" ? "append" : "create";
    const content = typeof body?.content === "string" ? (body.content as string).trim() : "";
    if (!content) return NextResponse.json({ error: "content_required" }, { status: 400 });
    if (action === "append" && !(typeof body?.noteId === "string" && body.noteId)) {
      return NextResponse.json({ error: "noteId_required_for_append" }, { status: 400 });
    }
    const r = await writeRaw(user, {
      action,
      content,
      title: typeof body?.title === "string" ? body.title : undefined,
      kbId: typeof body?.kbId === "string" ? body.kbId : undefined,
      noteId: typeof body?.noteId === "string" ? body.noteId : undefined,
    });
    return r instanceof NextResponse ? r : NextResponse.json({ ok: true, noteId: r.noteId });
  }

  // ---- A. 写回本地笔记 ----
  const noteId = String(body.xiyeNoteId);
  const note = await getBrainNote(user.sub, noteId);
  if (!note) return NextResponse.json({ error: "note_not_found" }, { status: 404 });

  const force = body?.force === "append" || body?.force === "create" ? body.force : undefined;
  const action = force ?? (note.imaNoteId ? "append" : "create");
  if (action === "append" && !note.imaNoteId) {
    return NextResponse.json({ error: "no_ima_note_mapping" }, { status: 400 });
  }

  const r = await writeRaw(user, {
    action,
    content: composeImaMarkdown(note),
    title: note.title || undefined,
    noteId: action === "append" ? (note.imaNoteId ?? undefined) : undefined,
  });
  if (r instanceof NextResponse) return r;

  // 新建成功 → 记下 ima 侧 note_id，下次同一条笔记走 append 而不是再造一篇
  if (action === "create" && r.noteId) {
    try {
      await updateBrainNote(user.sub, note.id, { imaNoteId: r.noteId });
    } catch (err) {
      console.error("[brain ima/write] persist ima_note_id failed:", err);
    }
  }
  return NextResponse.json({
    ok: true,
    action,
    noteId: r.noteId ?? (action === "append" ? note.imaNoteId : null),
    appended: action === "append",
  });
}
