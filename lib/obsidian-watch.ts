import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { db, userObsidianConfig } from "@/lib/db";
import { eq } from "drizzle-orm";
import { markdownToNote, fileNameForNote } from "@/lib/obsidian-md";
import { syncingPaths } from "@/lib/obsidian-sync";
import {
  getBrainNote,
  insertBrainNote,
  updateBrainNote,
  findBrainNoteByObsidianNoteId,
} from "@/lib/brain-db";
import type { BrainNote } from "@/lib/brain-db";

// Obsidian → xiye 监听（单例 watcher + 防抖 + 去重落库）。
// 循环防护：syncingPaths 由 obsidian-sync 写回时填充，watch 忽略这些路径的变更事件。

const watchers: fs.FSWatcher[] = [];
const debounceMap = new Map<string, NodeJS.Timeout>();

function hashRel(rel: string): string {
  return createHash("sha1").update(rel).digest("hex").slice(0, 12);
}

export function stopObsidianWatch(): void {
  for (const w of watchers) {
    try {
      w.close();
    } catch {
      /* ignore */
    }
  }
  watchers.length = 0;
  for (const t of debounceMap.values()) clearTimeout(t);
  debounceMap.clear();
}

export async function startObsidianWatch(): Promise<{ ok: boolean; error?: string; watching: number }> {
  stopObsidianWatch();
  const cfgs = await db
    .select()
    .from(userObsidianConfig)
    .where(eq(userObsidianConfig.enabled, 1));
  let watching = 0;
  for (const cfg of cfgs) {
    if (!cfg.vaultPath) continue;
    try {
      fs.accessSync(cfg.vaultPath, fs.constants.R_OK);
      const w = fs.watch(cfg.vaultPath, { recursive: true }, (_event, filename) => {
        if (!filename || !filename.endsWith(".md")) return;
        const abs = path.join(cfg.vaultPath, filename);
        if (syncingPaths.has(abs)) return;
        scheduleProcess(abs, cfg.userId, cfg.vaultPath);
      });
      watchers.push(w);
      watching++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[obsidian-watch] watch failed:", cfg.vaultPath, msg);
      return { ok: false, error: `无法监听 "${cfg.vaultPath}": ${msg}`, watching: 0 };
    }
  }
  return { ok: true, watching };
}

function scheduleProcess(abs: string, userId: string, vaultDir: string): void {
  const prev = debounceMap.get(abs);
  if (prev) clearTimeout(prev);
  debounceMap.set(
    abs,
    setTimeout(() => {
      debounceMap.delete(abs);
      void processFile(abs, userId, vaultDir).catch((e) =>
        console.error("[obsidian-watch] process failed:", abs, e),
      );
    }, 300),
  );
}

/** 文件名对齐：若当前 .md 文件名非 xiye 预期（如纯 Obsidian 新建文件），重命名为预期名，避免孤儿文件 */
async function alignFileName(note: BrainNote, abs: string, vaultDir: string): Promise<void> {
  const expected = fileNameForNote(note);
  if (path.basename(abs) === expected) return;
  const expectedAbs = path.join(vaultDir, expected);
  syncingPaths.add(expectedAbs);
  try {
    if (fs.existsSync(expectedAbs)) fs.unlinkSync(expectedAbs);
    fs.renameSync(abs, expectedAbs);
  } catch (e) {
    console.error("[obsidian-watch] align failed:", abs, e);
  } finally {
    setTimeout(() => syncingPaths.delete(expectedAbs), 1500);
  }
}

async function processFile(abs: string, userId: string, vaultDir: string): Promise<BrainNote | null> {
  let raw: string;
  try {
    raw = fs.readFileSync(abs, "utf8");
  } catch {
    return null;
  }
  const meta = markdownToNote(raw);
  const rel = path.relative(vaultDir, abs);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(abs);
  } catch {
    return null;
  }

  let targetId: string | null = meta.obsidianNoteId || null;
  let existing: BrainNote | null = targetId ? await findBrainNoteByObsidianNoteId(userId, targetId) : null;

  if (!existing && !targetId) {
    // 纯 Obsidian 文件（无 xiye 渊源）：用相对路径派生稳定 id
    targetId = `ob-${hashRel(rel)}`;
    existing = await getBrainNote(userId, targetId);
  }

  if (existing) {
    // 冲突：最后写入优先（.md mtime vs xiye updatedAt）
    if (stat.mtimeMs <= existing.updatedAt) return existing;
    await updateBrainNote(userId, existing.id, {
      title: meta.title || existing.title,
      content: meta.content,
      category: meta.category || existing.category,
      tags: meta.tags,
      related: meta.related,
      struct: meta.struct,
    });
    const updated = await getBrainNote(userId, existing.id);
    if (updated) await alignFileName(updated, abs, vaultDir);
    return updated;
  }

  const inserted = await insertBrainNote(userId, {
    id: targetId ?? undefined,
    source: "obsidian",
    title: meta.title || "未命名笔记",
    content: meta.content,
    category: meta.category,
    tags: meta.tags,
    related: meta.related,
    struct: meta.struct,
  });
  if (inserted) await alignFileName(inserted, abs, vaultDir);
  return inserted;
}

function collectMd(dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) collectMd(p, out);
    else if (e.name.endsWith(".md")) out.push(p);
  }
}

/** 手动全量同步：扫描所有启用 vault 的 .md 并入库（供前端「立即同步」按钮触发） */
export async function manualSyncAll(): Promise<{ processed: number }> {
  const cfgs = await db
    .select()
    .from(userObsidianConfig)
    .where(eq(userObsidianConfig.enabled, 1));
  let processed = 0;
  for (const cfg of cfgs) {
    if (!cfg.vaultPath) continue;
    const files: string[] = [];
    collectMd(cfg.vaultPath, files);
    for (const f of files) {
      if (syncingPaths.has(f)) continue;
      await processFile(f, cfg.userId, cfg.vaultPath);
      processed++;
    }
    await db
      .update(userObsidianConfig)
      .set({ lastSyncedAt: new Date().toISOString() })
      .where(eq(userObsidianConfig.userId, cfg.userId));
  }
  return { processed };
}
