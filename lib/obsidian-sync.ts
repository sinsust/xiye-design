import fs from "node:fs";
import path from "node:path";
import { db, userObsidianConfig, brainNotes } from "@/lib/db";
import { eq } from "drizzle-orm";
import { noteToMarkdown, resolveFileNameForNote } from "@/lib/obsidian-md";
import type { BrainNote } from "@/lib/brain-db";

// xiye → Obsidian 写回 + 删除。Obsidian → xiye 监听见 lib/obsidian-watch.ts（批 4）。
// 循环防护：xiye 写 .md 前把绝对路径加入 syncingPaths，watch 端忽略该路径的变更事件。
// syncingPaths 挂 globalThis：dev HMR 重载本模块时新旧实例必须共享同一份，
// 否则 watcher（旧实例）看不到 writeOne（新实例）的保护标记，循环防护失效。

const gSync = globalThis as typeof globalThis & {
  __xiyeObsidianSyncing?: Set<string>;
};

export const syncingPaths: Set<string> = (gSync.__xiyeObsidianSyncing ??= new Set());

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
  const fileName = resolveFileNameForNote(dir, note);
  const abs = path.join(dir, fileName);
  const stem = fileName.replace(/\.md$/, "");

  // 旧命名迁移：上次同步用的是「标题-短id.md」旧格式文件名，重命名到新名后再全量重写为精简格式。
  // 旧文件不清理会变成孤儿（DB 已指向新名）。
  const legacyStem = note.obsidianNoteId || "";
  if (legacyStem && legacyStem !== stem) {
    const legacyAbs = path.join(dir, `${legacyStem}.md`);
    if (fs.existsSync(legacyAbs)) {
      syncingPaths.add(legacyAbs);
      try {
        fs.renameSync(legacyAbs, abs);
      } catch (e) {
        console.error("[obsidian] legacy rename failed:", legacyAbs, e);
      } finally {
        setTimeout(() => syncingPaths.delete(legacyAbs), 1500);
      }
    }
  }

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
      obsidianNoteId: stem,
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
