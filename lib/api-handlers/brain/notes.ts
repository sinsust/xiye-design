import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  listBrainNotes,
  listBrainNotesPaginated,
  getBrainNote,
  insertBrainNote,
  updateBrainNote,
  deleteBrainNote,
  insertBrainTasks,
  insertBrainReview,
  insertStrategyTree,
  type BrainSource,
  type BrainTaskPriority,
} from "@/lib/brain-db";
import { embed, buildListableText } from "@/lib/embedding";
import { logBrainNoteAccess } from "@/lib/brain-reminder";

export const runtime = "nodejs";

const SOURCES: BrainSource[] = ["text", "file", "clip", "voice"];

function isSource(v: unknown): v is BrainSource {
  return typeof v === "string" && SOURCES.includes(v as BrainSource);
}
function cleanStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function cleanArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 20) : [];
}
function optStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** 生成笔记语义向量；失败返回 null（调用方不阻断，检索降级为关键词）。 */
async function embedOne(
  title: string,
  content: string,
  summary: string,
  tags: string[],
): Promise<number[] | null> {
  return embed(buildListableText({ title, content, summary, tags }));
}

// GET /api/brain/notes  → 当前用户私有笔记
// P2.1：支持 ?limit=&cursor= 服务端分页，返回 { notes, nextCursor, hasMore }；
// 不传 limit 时回退为全量返回（兼容其它仍依赖全量列表的调用方）。
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limitParam = req.nextUrl.searchParams.get("limit");
  const cursor = req.nextUrl.searchParams.get("cursor");
  if (limitParam) {
    const limit = Number(limitParam);
    if (!Number.isNaN(limit) && limit > 0) {
      const page = await listBrainNotesPaginated(user.sub, { limit, cursor });
      return NextResponse.json(page);
    }
  }
  const notes = await listBrainNotes(user.sub);
  return NextResponse.json({ notes });
}

// POST /api/brain/notes
// body: { content; title?; category?; summary?; tags?; related?; source?; decisions?; strategies?; actionItems? }
// 必填 content。整理字段可选：未传则存为 "仅原文"（待日后 AI 补整理），传了则一并落库。
// - decisions[]：会议决议，纯文本追加进 summary
// - strategies[]：AI 拆出的策略，落库到 brain_strategies
// - actionItems[]：任务，可带 strategyIndex 关联到 strategies 数组下标对应的策略
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const content = cleanStr(body?.content);
    if (!content) return NextResponse.json({ error: "content_required" }, { status: 400 });

    // 决议：[…] 以纯文本并入 summary 的扩展字段
    const summaryBase = cleanStr(body?.summary);
    const decisions: string[] = Array.isArray(body?.decisions)
      ? body.decisions.map(String).filter(Boolean).slice(0, 10)
      : [];
    const summary =
      summaryBase && decisions.length
        ? `${summaryBase}\n\n【会议决议】\n${decisions.map((d, i) => `${i + 1}. ${d}`).join("\n")}`
        : summaryBase || (decisions.length ? `【会议决议】\n${decisions.map((d, i) => `${i + 1}. ${d}`).join("\n")}` : "");

    const title = optStr(body?.title) || content.split("\n")[0].trim().slice(0, 30) || "未命名想法";
    const category = optStr(body?.category);
    const tags = cleanArr(body?.tags);

    // 本地语义向量：失败不阻断（返回 null 时检索自动降级为关键词匹配）
    const embedding = await embedOne(title, content, summary, tags);

    const note = await insertBrainNote(user.sub, {
      source: isSource(body?.source) ? body.source : "text",
      content,
      title,
      category,
      summary,
      tags,
      related: cleanArr(body?.related),
      // 代码片段：AI 识别为片段后单独存 codeContent / language，便于高亮与复制
      isSnippet: body?.isSnippet === true,
      language: typeof body?.language === "string" && body.language.trim() ? body.language.trim().toLowerCase() : null,
      codeContent:
        typeof body?.codeContent === "string" && body.codeContent.trim()
          ? body.codeContent
          : null,
      embedding: embedding ? JSON.stringify(embedding) : null,
      // AI 整理完整结构化结果（OrganizedNote），随笔记一并落库，刷新不丢
      struct: body?.struct ? JSON.stringify(body.struct).slice(0, 20000) : null,
    });

    // 策略：AI 拆出的策略落库，后续任务按 strategyIndex 关联。
    const strats = Array.isArray(body?.strategies)
      ? body.strategies
          .filter(
            (s: unknown) =>
              s && typeof (s as { title?: unknown }).title === "string" && String((s as { title: string }).title).trim(),
          )
          // 一篇笔记最多 2 条策略主题
          .slice(0, 2)
      : [];
    // 策略按「主题 → 子策略」两层落库；子策略 id 供任务精确挂接
    const tree = await insertStrategyTree(
      user.sub,
      note.id,
      strats.map((s: Record<string, unknown>) => ({
        title: String(s.title ?? "").trim().slice(0, 200),
        goal: typeof s.goal === "string" ? s.goal.trim().slice(0, 200) : "",
        rationale: typeof s.rationale === "string" ? s.rationale.trim().slice(0, 400) : "",
        subStrategies: Array.isArray(s.subStrategies)
          ? s.subStrategies
              .map((x: unknown) => {
                const so = (x ?? {}) as Record<string, unknown>;
                return {
                  title: String(so.title ?? "").trim().slice(0, 200),
                  description: typeof so.description === "string" ? so.description.trim() : "",
                };
              })
              .filter((x: { title: string }) => x.title)
          : [],
      })),
    );

    // 任务：有 actionItems 时一并落库（关联到刚创建的笔记，可按 strategyIndex 关联策略）
    if (Array.isArray(body?.actionItems) && body.actionItems.length && note?.id) {
      const tasks = body.actionItems
        .filter((t: unknown) => t && typeof (t as { text?: unknown }).text === "string")
        .slice(0, 12)
        .map(
          (t: {
            text: string;
            dueDate?: string | null;
            priority?: unknown;
            strategyIndex?: unknown;
            strategySubIndex?: unknown;
          }) => {
            const ti = typeof t.strategyIndex === "number" ? t.strategyIndex : -1;
            const si = typeof t.strategySubIndex === "number" ? t.strategySubIndex : -1;
            // 优先挂到子策略；只属于主题整体时挂主题
            const subId = ti >= 0 ? tree.subIds[ti]?.[si] ?? null : null;
            return {
              noteId: note.id,
              title: String(t.text).trim().slice(0, 40),
              dueDate:
                typeof t.dueDate === "string" && t.dueDate.trim() ? t.dueDate.trim().slice(0, 10) : null,
              priority: (t.priority === "high" || t.priority === "low" ? t.priority : "medium") as BrainTaskPriority,
              strategyId: ti >= 0 ? subId ?? tree.themeIds[ti] ?? null : null,
            };
          },
        )
        .filter((t: { title: string }) => t.title);
      if (tasks.length) await insertBrainTasks(user.sub, tasks);
    }

    // 间隔复习：落库后自动排一条 1 天后到期的待复习记录（遗忘曲线起点）
    if (note?.id) {
      await insertBrainReview(user.sub, {
        noteId: note.id,
        nextReviewAt: new Date(Date.now() + 86400_000).toISOString(),
        interval: 1,
        easeFactor: 2.5,
        reviewCount: 0,
      });
    }

    return NextResponse.json({
      note,
      strategies: tree.themeIds.filter(Boolean).length,
    });
  } catch (err) {
    console.error("brain note create failed:", err);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}

// PUT /api/brain/notes?id=<id>
// body: 欲更新的字段（title/content/category/summary/tags/related），未传字段保留原值
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
    const body = await req.json().catch(() => null);
    const patch: Record<string, unknown> = {};
    if (typeof body?.title === "string") patch.title = body.title.trim();
    if (typeof body?.content === "string") patch.content = body.content;
    if (typeof body?.category === "string") patch.category = body.category.trim();
    if (typeof body?.summary === "string") patch.summary = body.summary.trim();
    if (body?.tags !== undefined) patch.tags = cleanArr(body.tags);
    if (body?.related !== undefined) patch.related = cleanArr(body.related);
    if (body?.struct !== undefined) {
      patch.struct = typeof body.struct === "string" ? body.struct : JSON.stringify(body.struct);
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
    }

    // P2：标题/正文/摘要/标签任一变更 → 重算语义向量，避免检索向量陈旧（embed 失败不阻断）
    const needsEmbed =
      "title" in body || "content" in body || "summary" in body || "tags" in body;
    if (needsEmbed) {
      const prev = await getBrainNote(user.sub, id);
      if (prev) {
        const emb = await embedOne(
          typeof body?.title === "string" ? body.title.trim() : prev.title,
          typeof body?.content === "string" ? body.content : prev.content,
          typeof body?.summary === "string" ? body.summary.trim() : prev.summary,
          "tags" in body ? cleanArr(body.tags) : prev.tags ?? [],
        );
        if (emb) patch.embedding = JSON.stringify(emb);
      }
    }

    const note = await updateBrainNote(user.sub, id, patch);
    if (!note) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await logBrainNoteAccess(note.id, "edit");
    return NextResponse.json({ note });
  } catch (err) {
    console.error("brain note update failed:", err);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}

// DELETE /api/brain/notes?id=<id>
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  const ok = await deleteBrainNote(user.sub, id);
  if (!ok) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}