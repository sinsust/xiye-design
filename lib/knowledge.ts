import fs from "node:fs";
import path from "node:path";
import { KNOWLEDGE_TYPE_META, type KnowledgeEntry } from "./knowledge-types";
import { listCloudKnowledge } from "./knowledge-db";

const VAULT_ROOT = path.join(process.cwd(), "knowledge", "categories");

// 轻量 frontmatter 解析：本仓库条目的 frontmatter 均为「key: 标量」或
// 「key: [a, b]」单行格式，无需引入 js-yaml 这类依赖即可覆盖。
export function parseFrontmatter(raw: string): Record<string, unknown> | null {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return null;
  const data: Record<string, unknown> = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2].trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      const inner = val.slice(1, -1).trim();
      data[key] = inner.length
        ? inner
            .split(",")
            .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        : [];
    } else {
      data[key] = val.replace(/^["']|["']$/g, "");
    }
  }
  return data;
}

function extractBody(raw: string): string {
  const match = raw.match(/^---\s*\n[\s\S]*?\n---\s*\n?([\s\S]*)$/);
  return (match ? match[1] : raw).trim();
}

/**
 * 扫描 knowledge/categories 下所有 .md，解析 frontmatter 为结构化条目。
 * 仅服务端调用（依赖 node:fs / process.cwd）。
 */
function scanRoot(root: string): KnowledgeEntry[] {
  const entries: KnowledgeEntry[] = [];
  for (const meta of KNOWLEDGE_TYPE_META) {
    const dir = path.join(root, meta.folder);
    if (!fs.existsSync(dir)) continue;

    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md") && f !== "index.md");

    for (const file of files) {
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      const fm = parseFrontmatter(raw);
      if (!fm) continue;

      entries.push({
        slug: file.replace(/\.md$/, ""),
        type: meta.id,
        name: String(fm.name ?? file),
        summary: String(fm.summary ?? ""),
        useCase: fm.useCase ? String(fm.useCase) : undefined,
        stack: Array.isArray(fm.stack) ? fm.stack.map(String) : undefined,
        related: Array.isArray(fm.related)
          ? fm.related.map(String)
          : undefined,
        tags: Array.isArray(fm.tags) ? fm.tags.map(String) : undefined,
        status: fm.status ? String(fm.status) : undefined,
        updated: fm.updated ? String(fm.updated) : undefined,
        userAdded: fm.userAdded === true || fm.userAdded === "true" ? true : undefined,
        repoUrl: fm.repoUrl ? String(fm.repoUrl) : undefined,
        source: fm.source ? String(fm.source) : undefined,
        // 本地绝对路径：方便用户一键复制，给到 AI 工具或本地编辑
        localPath: path.join(root, meta.folder, file),
        body: extractBody(raw),
      });
    }
  }
  return entries;
}

export function getKnowledgeEntries(): KnowledgeEntry[] {
  // 仅内置 categories（仓库只读条目）。用户贡献统一进云端共享库，见 loadKnowledgeEntries。
  return scanRoot(VAULT_ROOT);
}

/**
 * 完整加载知识库 = 内置文件条目 + 云端共享条目（含贡献人邮箱）。
 * 异步：云端条目来自 DB（sqlite 本地 / Postgres 线上）。仅服务端调用。
 */
export async function loadKnowledgeEntries(): Promise<KnowledgeEntry[]> {
  return [...getKnowledgeEntries(), ...(await listCloudKnowledge())];
}
