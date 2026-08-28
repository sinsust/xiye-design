import { NextRequest, NextResponse } from "next/server";
import {
  KNOWLEDGE_TYPE_META,
  type KnowledgeEntry,
  type KnowledgeType,
} from "@/lib/knowledge-types";
import { generateKnowledgeMeta } from "@/lib/knowledge-generator";
import { getSessionUser } from "@/lib/auth";
import { randomSuffix } from "@/lib/id";
import {
  getCloudKnowledge,
  insertCloudKnowledge,
  updateCloudKnowledge,
  deleteCloudKnowledge,
  type NewCloudKnowledge,
} from "@/lib/knowledge-db";

export const runtime = "nodejs";

// 用户上传的知识条目统一进云端共享库（DB），供所有用户使用，并记录贡献人邮箱。
// 与本地文件系统无关；内置 categories/ 只读条目见 lib/knowledge.ts。

function isType(v: unknown): v is KnowledgeType {
  return typeof v === "string" && KNOWLEDGE_TYPE_META.some((m) => m.id === v);
}

/** 仅贡献人本人可编辑 / 删除该云端共享条目 */
function isOwner(entry: KnowledgeEntry, email: string | undefined): boolean {
  return Boolean(email && entry.contributorEmail && entry.contributorEmail === email);
}

// POST /api/knowledge
// body: { type; name; repoUrl?; source?; localPath?; body? }
// 自动用 Qwen 完善 summary/useCase/tags/stack，写入云端共享 DB，返回新条目（带贡献人邮箱）。
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => null);

    const type = body?.type;
    if (!isType(type)) {
      return NextResponse.json({ error: "invalid_type" }, { status: 400 });
    }
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "name_required" }, { status: 400 });
    }
    const repoUrl = typeof body?.repoUrl === "string" ? body.repoUrl.trim() : "";
    const source = typeof body?.source === "string" ? body.source.trim() : "";
    const localPath = typeof body?.localPath === "string" ? body.localPath.trim() : "";
    const promptBody = typeof body?.body === "string" ? body.body.trim() : "";

    // AI 完善（服务端），失败自动回退启发式
    const meta = await generateKnowledgeMeta({
      type,
      name,
      body: promptBody,
      repoUrl,
      source,
      localPath,
    });

    const slug = `kg-${Date.now().toString(36)}-${randomSuffix()}`;
    const today = new Date().toISOString().slice(0, 10);

    const input: NewCloudKnowledge = {
      slug,
      type,
      name,
      summary: meta.summary,
      useCase: meta.useCase || undefined,
      stack: meta.stack.length ? meta.stack : undefined,
      tags: meta.tags.length ? meta.tags : undefined,
      status: "active",
      updated: today,
      repoUrl: repoUrl || undefined,
      source: source || undefined,
      contributorEmail: user.email,
      body: promptBody || `# ${name}`,
    };

    const entry = await insertCloudKnowledge(input);
    return NextResponse.json({ entry, source: "ok" });
  } catch (err) {
    console.error("knowledge create failed:", err);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}

// PUT /api/knowledge
// body: { type; slug; name?; repoUrl?; source?; localPath?; body?; summary?; useCase?; tags?; stack? }
// 仅允许贡献人本人编辑自己的云端共享条目，未显式传入的字段保留原值。
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => null);
    const type = body?.type;
    const slug = typeof body?.slug === "string" ? body.slug : "";
    if (!isType(type) || !slug) {
      return NextResponse.json({ error: "invalid_params" }, { status: 400 });
    }

    const prev = await getCloudKnowledge(slug);
    if (!prev) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (!isOwner(prev, user.email)) {
      return NextResponse.json({ error: "not_owner" }, { status: 403 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const entry = await updateCloudKnowledge(slug, {
      name: typeof body?.name === "string" && body.name.trim() ? body.name.trim() : undefined,
      repoUrl: typeof body?.repoUrl === "string" ? body.repoUrl.trim() : undefined,
      source: typeof body?.source === "string" ? body.source.trim() : undefined,
      body: typeof body?.body === "string" ? body.body : undefined,
      summary:
        typeof body?.summary === "string" && body.summary.trim()
          ? body.summary.trim()
          : undefined,
      useCase:
        typeof body?.useCase === "string" && body.useCase.trim()
          ? body.useCase.trim()
          : undefined,
      stack: Array.isArray(body?.stack) ? body.stack.map(String).filter(Boolean) : undefined,
      tags: Array.isArray(body?.tags) ? body.tags.map(String).filter(Boolean) : undefined,
      updated: today,
    });

    if (!entry) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ entry, source: "ok" });
  } catch (err) {
    console.error("knowledge update failed:", err);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}

// DELETE /api/knowledge?type=<type>&slug=<slug>
// 仅允许贡献人本人删除自己的云端共享条目。
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const type = req.nextUrl.searchParams.get("type");
    const slug = req.nextUrl.searchParams.get("slug");
    if (!isType(type) || !slug) {
      return NextResponse.json({ error: "invalid_params" }, { status: 400 });
    }

    const entry = await getCloudKnowledge(slug);
    if (!entry) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (!isOwner(entry, user.email)) {
      return NextResponse.json({ error: "not_owner" }, { status: 403 });
    }

    await deleteCloudKnowledge(slug);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("knowledge delete failed:", err);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}