import fs from "node:fs";
import path from "node:path";
import { db, userObsidianConfig, brainNotes } from "@/lib/db";
import { eq } from "drizzle-orm";
import { noteToMarkdown, resolveFileNameForNote } from "@/lib/obsidian-md";
import { listBrainNotes } from "@/lib/brain-db";
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

type ObsidianCfg = Awaited<ReturnType<typeof getConfig>>;

/** 解析分类 → 子目录映射（容错：坏 JSON 视作未配置） */
function parseFolderMap(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as unknown;
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) out[k.trim()] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

/** 安全子目录：去掉绝对路径/盘符/.. 等越界写法，只保留相对安全段 */
function sanitizeRelDir(input: string): string {
  const cleaned = input
    .replace(/\\/g, "/")
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s && s !== "." && s !== "..")
    // Windows 文件名非法字符
    .map((s) => s.replace(/[<>:"|?*]/g, ""))
    .filter(Boolean)
    .join("/");
  // 防绝对路径（/foo 或 C:/foo）与盘符
  return cleaned.replace(/^[a-zA-Z]:/, "").replace(/^\/+/, "");
}

/**
 * 决定一条笔记应落在 vault 的哪个子目录（相对 vault 根）。
 * 优先级：
 *  ① 来源目录 —— 从 Obsidian 导入的笔记，尊重用户在 Obsidian 里手动整理的位置（拖动后自动记忆）
 *  ② 分类映射 —— category 命中映射表（大小写/空格不敏感）
 *  ③ 默认目录 —— cfg.defaultFolder（如 "xiye"）
 *  ④ vault 根
 */
export function resolveTargetFolder(note: BrainNote, cfg: ObsidianCfg): string {
  if (note.obsidianRelPath && note.obsidianRelPath.trim()) {
    return sanitizeRelDir(note.obsidianRelPath);
  }
  const map = parseFolderMap(cfg?.categoryFolderMap);
  const cat = (note.category || "").trim();
  if (cat) {
    const hit = map[cat] ?? map[Object.keys(map).find((k) => k.toLowerCase() === cat.toLowerCase()) ?? ""];
    if (hit) return sanitizeRelDir(hit);
  }
  return sanitizeRelDir(cfg?.defaultFolder || "");
}

async function writeOne(note: BrainNote, cfgOverride?: ObsidianCfg): Promise<void> {
  if (!note.userId) return;
  const cfg = cfgOverride !== undefined ? cfgOverride : await getConfig(note.userId);
  if (!cfg || !cfg.enabled || !cfg.vaultPath) return;

  const vault = cfg.vaultPath;
  const rel = resolveTargetFolder(note, cfg);
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

export interface ExportResult {
  ok: boolean;
  error?: string;
  exported: number;
  skipped: number;
  failed: number;
  byFolder: Record<string, number>;
}

/**
 * 批量导出「从未同步过」的笔记到 vault。
 * 已在 vault 里的（obsidianVault/obsidianNoteId 非空）一律跳过——
 * 避免覆盖用户在 Obsidian 侧的手动修改。
 */
export async function exportUnsyncedNotes(userId: string): Promise<ExportResult> {
  const empty: ExportResult = { ok: false, exported: 0, skipped: 0, failed: 0, byFolder: {} };
  const cfg = await getConfig(userId);
  if (!cfg || !cfg.enabled || !cfg.vaultPath) {
    return { ...empty, error: "尚未启用 Obsidian 同步或未配置 vault 路径" };
  }
  try {
    fs.accessSync(cfg.vaultPath, fs.constants.W_OK);
  } catch {
    return { ...empty, error: `无法写入 vault 目录：${cfg.vaultPath}` };
  }

  const notes = await listBrainNotes(userId);
  const pending = notes.filter((n) => !n.obsidianVault && !n.obsidianNoteId);
  const byFolder: Record<string, number> = {};
  let exported = 0;
  let failed = 0;

  for (const note of pending) {
    try {
      const folder = resolveTargetFolder(note, cfg) || "（vault 根目录）";
      await writeOne(note, cfg);
      byFolder[folder] = (byFolder[folder] ?? 0) + 1;
      exported++;
    } catch (e) {
      failed++;
      console.error("[obsidian] export failed:", note.id, e);
    }
  }

  return { ok: true, exported, skipped: notes.length - pending.length, failed, byFolder };
}
