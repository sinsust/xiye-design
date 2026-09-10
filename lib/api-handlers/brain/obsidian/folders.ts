import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db, userObsidianConfig } from "@/lib/db";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

// GET /api/brain/obsidian/folders
// 列出 vault 下已有的子文件夹（排除 .obsidian 等隐藏目录），
// 供「分类 → 文件夹」映射编辑器做下拉/自动补全，避免手输路径拼错。
const SKIP = new Set([".obsidian", ".git", ".trash", "node_modules", ".xiye"]);

function walk(root: string, rel: string, out: string[], depth: number): void {
  if (depth > 3) return;
  const abs = rel ? path.join(root, rel) : root;
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith(".") || SKIP.has(e.name)) continue;
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    out.push(childRel);
    walk(root, childRel, out, depth + 1);
  }
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(userObsidianConfig)
    .where(eq(userObsidianConfig.userId, user.sub))
    .limit(1);
  const vault = rows[0]?.vaultPath?.trim();
  if (!vault) return NextResponse.json({ folders: [] as string[] });

  const out: string[] = [];
  walk(vault, "", out, 0);
  return NextResponse.json({ folders: out.sort((a, b) => a.localeCompare(b, "zh-CN")) });
}
