import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  listBrainNotes,
  insertBrainNote,
  insertBrainStrategies,
  insertBrainTasks,
  insertBrainReview,
} from "@/lib/brain-db";
import { organizeNote } from "@/lib/brain-organizer";
import { embed, buildListableText } from "@/lib/embedding";

export const runtime = "nodejs";

const DAY_MS = 86400_000;

// POST /api/brain/import/batch
// body: { items: [{ title?, content }] }（≤10 篇）
// 逐篇跑完整整理管线（organize → 落库 → 策略 → 任务 → 初始复习 → 向量），
// 单篇失败不影响其余；返回每篇结果供前端展示。
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const raw = Array.isArray(body?.items) ? body.items : [];
    const items = raw
      .map((it: unknown) => {
        const o = (it ?? {}) as Record<string, unknown>;
        const content = typeof o.content === "string" ? o.content.trim() : "";
        const title = typeof o.title === "string" ? o.title.trim() : "";
        return content ? { content, title } : null;
      })
      .filter((x: { content: string; title: string } | null): x is { content: string; title: string } => x !== null)
      .slice(0, 10);
    if (!items.length) return NextResponse.json({ error: "empty_items" }, { status: 400 });

    const existing = await listBrainNotes(user.sub);
    const results: {
      title: string;
      ok: boolean;
      error?: string;
      note?: unknown;
    }[] = [];

    for (const it of items) {
      try {
        const organized = await organizeNote(it.content, existing);
        const noteContent = organized.rewritten || it.content;

        const vec = await embed(
          buildListableText({
            title: organized.title || it.title,
            content: noteContent,
            summary: organized.summary ?? "",
            tags: organized.tags ?? [],
          }),
        );

        const note = await insertBrainNote(user.sub, {
          source: "text",
          content: noteContent,
          title: organized.title || it.title || "未命名批量导入",
          category: organized.category || "随手记",
          summary: organized.summary ?? "",
          tags: organized.tags ?? [],
          related: organized.related ?? [],
          isSnippet: organized.isSnippet === true,
          language: organized.language || null,
          codeContent: organized.codeContent || null,
          embedding: vec ? JSON.stringify(vec) : null,
          struct: JSON.stringify(organized).slice(0, 20000),
        });
        if (!note) throw new Error("insert failed");

        // 策略 → 任务（按 strategyIndex 关联）→ 初始复习（SM-2）
        let created: { id: string }[] = [];
        try {
          const strats = (organized.strategies ?? []).slice(0, 8);
          if (strats.length) {
            created = await insertBrainStrategies(
              user.sub,
              strats.map((s) => ({
                noteId: note.id,
                title: s.title.slice(0, 200),
                description: s.description ?? "",
              })),
            );
          }
        } catch (err) {
          console.error("[batch-import] strategies failed:", err);
        }
        try {
          const tasks = (organized.actionItems ?? [])
            .slice(0, 12)
            .map((t) => ({
              noteId: note.id,
              title: t.text.slice(0, 40),
              dueDate: t.dueDate ?? null,
              priority: (t.priority === "high" || t.priority === "low" ? t.priority : "medium") as
                | "high"
                | "medium"
                | "low",
              strategyId:
                typeof t.strategyIndex === "number" &&
                t.strategyIndex >= 0 &&
                t.strategyIndex < created.length
                  ? created[t.strategyIndex].id
                  : null,
            }));
          if (tasks.length) await insertBrainTasks(user.sub, tasks);
        } catch (err) {
          console.error("[batch-import] tasks failed:", err);
        }
        try {
          await insertBrainReview(user.sub, {
            noteId: note.id,
            nextReviewAt: new Date(Date.now() + DAY_MS).toISOString(),
            interval: 1,
            easeFactor: 2.5,
            reviewCount: 0,
          });
        } catch (err) {
          console.error("[batch-import] review failed:", err);
        }

        results.push({ title: note.title, ok: true, note });
      } catch (err) {
        console.error("[batch-import] item failed:", err);
        results.push({
          title: it.title || it.content.slice(0, 30),
          ok: false,
          error: "整理或入库失败",
        });
      }
    }

    return NextResponse.json({ results, total: items.length, okCount: results.filter((r) => r.ok).length });
  } catch (err) {
    console.error("brain batch import failed:", err);
    return NextResponse.json({ error: "batch_import_failed" }, { status: 500 });
  }
}
