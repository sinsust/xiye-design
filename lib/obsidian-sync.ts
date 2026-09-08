import fs from "node:fs";
import path from "node:path";
import { db, userObsidianConfig, brainNotes } from "@/lib/db";
import { eq } from "drizzle-orm";
import { noteToMarkdown, fileNameForNote } from "@/lib/obsidian-md";
import type { BrainNote } from "@/lib/brain-db";

// xiye → Obsidian 写回 + 删除。Obsidian → xiye 监听见 lib/obsidian-watch.ts（批 4）。
// 循环防护：xiye 写 .md 前把绝对路径加入 syncingPaths，watch 端忽略该路径的变更事件。

export const syncingPaths = new Set<string>();

async function getConfig(userId: string) {
  const rows = await db
    .select()
    .from(userObsidianConfig)
    .where(eq(userObsidianConfig.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

async function writeOne(note: BrainNote): Promise<void> {
  if (!note.userId) return;
  const cfg = await getConfig(note.userId);
  if (!cfg || !cfg.enabled || !cfg.vaultPath) return;

  const vault = cfg.vaultPath;
  const rel = note.obsidianRelPath || "";
  const dir = rel ? path.join(vault, rel) : vault;
  const fileName = fileNameForNote(note);
  const abs = path.join(dir, fileName);

  fs.mkdirSync(dir, { recursive: true });
  syncingPaths.add(abs);
  try {
    fs.writeFileSync(abs, noteToMarkdown(note), "utf8");
  } catch (e) {
    console.error("[obsidian] write failed:", e);
    return;
  } finally {
    // 延迟移除，确保本轮 watch 事件被忽略（防回写死循环）
    setTimeout(() => syncingPaths.delete(abs), 1500);
  }

  const nowIso = new Date().toISOString();
  await db
    .update(brainNotes)
    .set({
      obsidianVault: vault,
      obsidianRelPath: rel,
      obsidianNoteId: fileName.replace(/\.md$/, ""),
      obsidianSyncedAt: nowIso,
    })
    .where(eq(brainNotes.id, note.id));
}

async function removeOne(note: BrainNote): Promise<void> {
  if (!note.obsidianVault || !note.obsidianNoteId) return;
  const abs = path.join(note.obsidianVault, note.obsidianRelPath || "", `${note.obsidianNoteId}.md`);
  syncingPaths.add(abs);
  try {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (e) {
    console.error("[obsidian] remove failed:", e);
  } finally {
    setTimeout(() => syncingPaths.delete(abs), 1500);
  }
}

/** 笔记创建后调用（fire-and-forget） */
export function onNoteInserted(note: BrainNote): void {
  void writeOne(note).catch((e) => console.error("[obsidian] insert sync failed:", e));
}

/** 笔记更新后调用（fire-and-forget） */
export function onNoteUpdated(note: BrainNote): void {
  void writeOne(note).catch((e) => console.error("[obsidian] update sync failed:", e));
}

/** 笔记删除前调用（传入删除前查到的完整 note，含 obsidian 溯源列） */
export function onNoteDeleted(note: BrainNote): void {
  void removeOne(note).catch((e) => console.error("[obsidian] delete sync failed:", e));
}
