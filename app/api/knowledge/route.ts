import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import {
  KNOWLEDGE_TYPE_META,
  type KnowledgeEntry,
  type KnowledgeType,
} from "@/lib/knowledge-types";
import { generateKnowledgeMeta } from "@/lib/knowledge-generator";
import { parseFrontmatter } from "@/lib/knowledge";

export const runtime = "nodejs";

// 内置知识库（只读，来自仓库）与用户自建知识库（可读写，隔离、可 gitignore）两个根。
const VAULT_ROOT = path.join(process.cwd(), "knowledge", "categories");
const USER_ROOT = path.join(process.cwd(), "knowledge", "user");

function isType(v: unknown): v is KnowledgeType {
  return typeof v === "string" && KNOWLEDGE_TYPE_META.some((m) => m.id === v);
}

function esc(v: string): string {
  // 保留冒号（URL/repo 地址必需），仅转义引号、逗号、换行（避免破坏 frontmatter / 列表）
  return v.replace(/["\n\r,]/g, " ").trim().slice(0, 120);
}

function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function asArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
}

/**
 * 解析某 type/slug 在 user/ 或 categories/ 下的合法文件路径。
 * 防路径穿越（startsWith(root+sep)）+ 存在校验。自建优先 user/，回退 categories/ 保底。
 */
function resolveEntryFile(type: string, slug: string): string | null {
  const folder = KNOWLEDGE_TYPE_META.find((m) => m.id === type)?.folder;
  if (!folder) return null;
  for (const root of [USER_ROOT, VAULT_ROOT]) {
    const file = path.resolve(root, folder, `${slug}.md`);
    if (file.startsWith(root + path.sep) && fs.existsSync(file)) return file;
  }
  return null;
}

interface FmInput {
  type: string;
  name: string;
  summary: string;
  useCase?: string;
  stack: string[];
  tags: string[];
  status?: string;
  updated: string;
  userAdded: boolean;
  repoUrl?: string;
  source?: string;
}

// 与仓库现有条目保持一致的「key: 标量 / [a,b]」单行 frontmatter 语法
function buildFrontmatter(f: FmInput): string {
  return [
    "---",
    `type: ${f.type}`,
    `name: ${esc(f.name)}`,
    `summary: ${esc(f.summary)}`,
    f.useCase ? `useCase: ${esc(f.useCase)}` : null,
    f.stack.length ? `stack: [${f.stack.map((s) => esc(s)).join(", ")}]` : null,
    f.tags.length ? `tags: [${f.tags.map((t) => esc(t)).join(", ")}]` : null,
    f.status ? `status: ${f.status}` : null,
    `updated: ${f.updated}`,
    `userAdded: ${f.userAdded}`,
    f.repoUrl ? `repoUrl: ${esc(f.repoUrl)}` : null,
    f.source ? `source: ${esc(f.source)}` : null,
    "---",
    "",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

// 轻量取正文（与 lib/knowledge.extractBody 同逻辑，route 内联避免额外导出）
function extractBody(raw: string): string {
  const m = raw.match(/^---\s*\n[\s\S]*?\n---\s*\n?([\s\S]*)$/);
  return (m ? m[1] : raw).trim();
}

// POST /api/knowledge
// body: { type; name; repoUrl?; source?; localPath?; body? }
// 自动用 Qwen 完善 summary/useCase/tags/stack，写入 knowledge/user/<folder>/<slug>.md，返回新条目。
export async function POST(req: NextRequest) {
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

    const metaInfo = KNOWLEDGE_TYPE_META.find((m) => m.id === type)!;
    const slug = `kg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const today = new Date().toISOString().slice(0, 10);

    const fm = buildFrontmatter({
      type,
      name,
      summary: meta.summary,
      useCase: meta.useCase,
      stack: meta.stack,
      tags: meta.tags,
      status: "active",
      updated: today,
      userAdded: true,
      repoUrl,
      source,
    });
    const mdBody = promptBody ? promptBody : `# ${name}\n`;
    const content = fm + mdBody + "\n";

    const dir = path.join(USER_ROOT, metaInfo.folder);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${slug}.md`);
    fs.writeFileSync(file, content, "utf8");

    const entry: KnowledgeEntry = {
      slug,
      type,
      name,
      summary: meta.summary,
      useCase: meta.useCase || undefined,
      stack: meta.stack.length ? meta.stack : undefined,
      related: undefined,
      tags: meta.tags.length ? meta.tags : undefined,
      status: "active",
      updated: today,
      userAdded: true,
      repoUrl: repoUrl || undefined,
      source: source || undefined,
      localPath: file,
      body: promptBody || `# ${name}`,
    };

    return NextResponse.json({ entry, source: "ok" });
  } catch (err) {
    console.error("knowledge create failed:", err);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}

// PUT /api/knowledge
// body: { type; slug; name?; repoUrl?; source?; localPath?; body?; summary?; useCase?; tags?; stack? }
// 仅允许编辑「用户自建」条目（frontmatter 含 userAdded: true），重写整篇 md（保留标记 + 更新 updated）。
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const type = body?.type;
    const slug = typeof body?.slug === "string" ? body.slug : "";
    if (!isType(type) || !slug) {
      return NextResponse.json({ error: "invalid_params" }, { status: 400 });
    }

    const file = resolveEntryFile(type, slug);
    if (!file) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const raw = fs.readFileSync(file, "utf8");
    if (!/userAdded:\s*true/.test(raw)) {
      return NextResponse.json({ error: "not_removable" }, { status: 403 });
    }

    // 取原 frontmatter，未显式传入的字段保留原值
    const prev = parseFrontmatter(raw) ?? {};
    const prevBody = extractBody(raw);
    const name = (typeof body?.name === "string" && body.name.trim()) ? body.name.trim() : asStr(prev.name);
    const repoUrl = typeof body?.repoUrl === "string" ? body.repoUrl.trim() : asStr(prev.repoUrl);
    const source = typeof body?.source === "string" ? body.source.trim() : asStr(prev.source);
    const promptBody = typeof body?.body === "string" ? body.body : prevBody;
    const summary = typeof body?.summary === "string" && body.summary.trim() ? body.summary.trim() : asStr(prev.summary);
    const useCase = typeof body?.useCase === "string" && body.useCase.trim() ? body.useCase.trim() : asStr(prev.useCase);
    const stack = Array.isArray(body?.stack) ? body.stack.map(String).filter(Boolean) : asArr(prev.stack);
    const tags = Array.isArray(body?.tags) ? body.tags.map(String).filter(Boolean) : asArr(prev.tags);
    const status = asStr(prev.status) || "active";
    const today = new Date().toISOString().slice(0, 10);

    const fm = buildFrontmatter({
      type,
      name,
      summary,
      useCase,
      stack,
      tags,
      status,
      updated: today,
      userAdded: true,
      repoUrl,
      source,
    });
    const mdBody = promptBody ? promptBody : `# ${name}\n`;
    fs.writeFileSync(file, fm + mdBody + "\n", "utf8");

    const entry: KnowledgeEntry = {
      slug,
      type,
      name,
      summary,
      useCase: useCase || undefined,
      stack: stack.length ? stack : undefined,
      related: undefined,
      tags: tags.length ? tags : undefined,
      status,
      updated: today,
      userAdded: true,
      repoUrl: repoUrl || undefined,
      source: source || undefined,
      localPath: file,
      body: promptBody || `# ${name}`,
    };

    return NextResponse.json({ entry, source: "ok" });
  } catch (err) {
    console.error("knowledge update failed:", err);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}

// DELETE /api/knowledge?type=<type>&slug=<slug>
// 仅允许删除「用户自建」条目（frontmatter 含 userAdded: true），并防御路径穿越。
export async function DELETE(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get("type");
    const slug = req.nextUrl.searchParams.get("slug");
    if (!isType(type) || !slug) {
      return NextResponse.json({ error: "invalid_params" }, { status: 400 });
    }

    const file = resolveEntryFile(type, slug);
    if (!file) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const raw = fs.readFileSync(file, "utf8");
    if (!/userAdded:\s*true/.test(raw)) {
      return NextResponse.json({ error: "not_removable" }, { status: 403 });
    }

    fs.unlinkSync(file);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("knowledge delete failed:", err);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}
