import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { db, userObsidianConfig } from "@/lib/db";
import { eq } from "drizzle-orm";
import { markdownToNote, resolveFileNameForNote } from "@/lib/obsidian-md";
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

// 单例状态挂 globalThis：dev 模式 HMR 会反复求值本模块，
// 若用模块级变量，旧 watcher 的引用会丢失（无法 close）造成句柄泄漏与重复监听。
const g = globalThis as typeof globalThis & {
  __xiyeObsidianWatch?: {
    watchers: fs.FSWatcher[];
    debounce: Map<string, NodeJS.Timeout>;
    pollTimer: NodeJS.Timeout | null;
    lastMtime: Map<string, number>;
    /** 处理实现（间接层）：dev HMR 后模块重新求值会覆盖它，
     *  使旧 fs.watch 回调也走最新代码，避免「改了代码没生效」。 */
    handler: ((abs: string, userId: string, vaultDir: string) => Promise<unknown>) | null;
  };
};

function state() {
  if (!g.__xiyeObsidianWatch) {
    g.__xiyeObsidianWatch = {
      watchers: [],
      debounce: new Map(),
      pollTimer: null,
      lastMtime: new Map(),
      handler: null,
    };
  }
  return g.__xiyeObsidianWatch;
}

// 模块顶层即刷新 handler（不能只在 startObsidianWatch 里刷新）：
// dev HMR 重求值本模块时，存活的旧 watcher 必须立即切换到新处理逻辑，
// 否则旧闭包会按旧格式处理新格式文件，产生重复笔记/错误重命名。
state().handler = (abs, userId, vaultDir) => processFile(abs, userId, vaultDir);

function hashRel(rel: string): string {
  return createHash("sha1").update(rel).digest("hex").slice(0, 12);
}

export function stopObsidianWatch(): void {
  const s = state();
  for (const w of s.watchers) {
    try {
      w.close();
    } catch {
      /* ignore */
    }
  }
  s.watchers.length = 0;
  for (const t of s.debounce.values()) clearTimeout(t);
  s.debounce.clear();
  if (s.pollTimer) {
    clearInterval(s.pollTimer);
    s.pollTimer = null;
  }
  s.lastMtime.clear();
}

export async function startObsidianWatch(): Promise<{ ok: boolean; error?: string; watching: number }> {
  stopObsidianWatch();
  // 每次启动都把处理实现刷新到单例上，保证回调始终指向当前模块版本。
  state().handler = (abs, userId, vaultDir) => processFile(abs, userId, vaultDir);
  const cfgs = await db
    .select()
    .from(userObsidianConfig)
    .where(eq(userObsidianConfig.enabled, 1));
  let watching = 0;
  const errors: string[] = [];
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
      state().watchers.push(w);
      watching++;
    } catch (e) {
      // 改 continue：多 vault 配置下任一失败不应中断其余，也不应丢弃已建立的 watcher。
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[obsidian-watch] watch failed:", cfg.vaultPath, msg);
      errors.push(`无法监听 "${cfg.vaultPath}": ${msg}`);
    }
  }
  if (watching > 0) startPolling();
  return errors.length
    ? { ok: watching > 0, error: errors.join("; "), watching }
    : { ok: true, watching };
}

// Windows 下 fs.watch(recursive:true) 对深层子目录/部分编辑器原子写入会漏报，
// 用低频轮询兜底：只处理 mtime 相对上次快照发生变化的文件。
const POLL_MS = Math.max(10_000, Number(process.env.OBSIDIAN_POLL_MS ?? 60_000));

function startPolling(): void {
  const s = state();
  if (s.pollTimer) return;
  s.pollTimer = setInterval(() => {
    void pollTick().catch((e) => console.error("[obsidian-watch] poll failed:", e));
  }, POLL_MS);
  // 不 unref：轮询是本模块的存活职责，进程退出时由 stopObsidianWatch 清理。
}

async function pollTick(): Promise<void> {
  const cfgs = await db
    .select()
    .from(userObsidianConfig)
    .where(eq(userObsidianConfig.enabled, 1));
  const s = state();
  const seen = new Set<string>();
  for (const cfg of cfgs) {
    if (!cfg.vaultPath) continue;
    const files: string[] = [];
    collectMd(cfg.vaultPath, files);
    for (const abs of files) {
      seen.add(abs);
      let mtime: number;
      try {
        mtime = fs.statSync(abs).mtimeMs;
      } catch {
        continue;
      }
      const prev = s.lastMtime.get(abs);
      s.lastMtime.set(abs, mtime);
      // 首次快照只记录不处理，避免启动时把整个 vault 当变更全量重放。
      if (prev === undefined || mtime <= prev) continue;
      if (syncingPaths.has(abs)) continue;
      scheduleProcess(abs, cfg.userId, cfg.vaultPath);
    }
  }
  // 清理已删除文件的快照，避免 Map 无限增长
  for (const k of s.lastMtime.keys()) if (!seen.has(k)) s.lastMtime.delete(k);
}

function scheduleProcess(abs: string, userId: string, vaultDir: string): void {
  const s = state();
  const prev = s.debounce.get(abs);
  if (prev) clearTimeout(prev);
  s.debounce.set(
    abs,
    setTimeout(() => {
      s.debounce.delete(abs);
      const fn = s.handler ?? ((a: string, u: string, v: string) => processFile(a, u, v));
      void fn(abs, userId, vaultDir).catch((e) =>
        console.error("[obsidian-watch] process failed:", abs, e),
      );
    }, 300),
  );
}

/** 文件名对齐：若当前 .md 文件名非 xiye 预期（如纯 Obsidian 新建文件），重命名为预期名，避免孤儿文件。
 *  返回对齐后的最终绝对路径（未重命名则原样返回）。
 *  预期名经 resolveFileNameForNote 冲突解析：目标被占用时自动落到消歧名，不再删除既有文件。 */
async function alignFileName(note: BrainNote, abs: string, vaultDir: string): Promise<string> {
  const expected = resolveFileNameForNote(vaultDir, note);
  if (path.basename(abs) === expected) return abs;
  const expectedAbs = path.join(vaultDir, expected);
  syncingPaths.add(expectedAbs);
  try {
    fs.renameSync(abs, expectedAbs);
    return expectedAbs;
  } catch (e) {
    console.error("[obsidian-watch] align failed:", abs, e);
    return abs;
  } finally {
    setTimeout(() => syncingPaths.delete(expectedAbs), 1500);
  }
}

/** 相对目录（vault 根为 ""），供 obsidian-sync 拼回绝对路径 */
function relDirOf(vaultDir: string, abs: string): string {
  const d = path.dirname(path.relative(vaultDir, abs));
  return d === "." ? "" : d;
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
  // 双重查找：先按 obsidian_note_id 列查（规范路径），
  // 再按主键 id 兜底 —— xiye 写回时生成的 id 就是 noteId，
  // 而历史数据（obsidian_note_id 列为空）只能靠 id 命中，否则会误走 insert 撞主键。
  let existing: BrainNote | null = targetId
    ? ((await findBrainNoteByObsidianNoteId(userId, targetId)) ??
      (await getBrainNote(userId, targetId)))
    : null;

  if (!existing && !targetId) {
    // 纯 Obsidian 文件（无 xiye 渊源）：用相对路径派生稳定 id
    targetId = `ob-${hashRel(rel)}`;
    existing = await getBrainNote(userId, targetId);
  }

  const nowIso = new Date().toISOString();

  if (existing) {
    // 冲突：最后写入优先（.md mtime vs xiye updatedAt）
    if (stat.mtimeMs <= existing.updatedAt) return existing;
    const updated = await updateBrainNote(userId, existing.id, {
      // 新格式无 frontmatter title：以文件名为准（用户在 Obsidian 重命名 = 改标题）
      title: meta.title || path.basename(abs, ".md") || existing.title,
      content: meta.content,
      category: meta.category || existing.category,
      // 精简格式可能不写 tags/struct：空值不覆盖 xiye 侧已有数据
      tags: meta.tags.length ? meta.tags : (existing.tags ?? []),
      related: meta.related,
      struct: meta.struct || existing.struct,
      // 溯源字段：obsidian-sync 的更新/删除写回依赖 vault + noteId
      obsidianVault: vaultDir,
      obsidianRelPath: relDirOf(vaultDir, abs),
      obsidianNoteId: path.basename(abs, ".md"),
      obsidianSyncedAt: nowIso,
    });
    if (!updated) return null;
    const finalAbs = await alignFileName(updated, abs, vaultDir);
    const finalId = path.basename(finalAbs, ".md");
    // 对齐重命名后 noteId 已变（落库的是旧名），补一次更新保证删除时能定位到真实文件
    if (finalAbs !== abs && updated.obsidianNoteId !== finalId) {
      return await updateBrainNote(userId, updated.id, {
        obsidianVault: vaultDir,
        obsidianRelPath: relDirOf(vaultDir, finalAbs),
        obsidianNoteId: finalId,
        obsidianSyncedAt: nowIso,
      });
    }
    return updated;
  }

  const draft = {
    id: targetId ?? undefined,
    source: "obsidian" as const,
    // 纯 Obsidian 新文件无 title 元数据：用文件名（Obsidian 中文件名即标题）
    title: meta.title || path.basename(abs, ".md").replace(/-[0-9a-f]{6,12}$/i, "") || "未命名笔记",
    content: meta.content,
    category: meta.category,
    tags: meta.tags,
    related: meta.related,
    struct: meta.struct,
    obsidianVault: vaultDir,
    obsidianRelPath: relDirOf(vaultDir, abs),
    obsidianNoteId: path.basename(abs, ".md"),
    obsidianSyncedAt: nowIso,
  };
  let inserted: BrainNote | null;
  try {
    inserted = await insertBrainNote(userId, draft);
  } catch (e) {
    // 并发/历史数据竞争下可能撞主键：降级为更新既有记录，避免整条同步失败。
    const fallback = targetId ? await getBrainNote(userId, targetId) : null;
    if (!fallback) throw e;
    inserted = await updateBrainNote(userId, fallback.id, {
      title: draft.title,
      content: draft.content,
      category: draft.category,
      tags: draft.tags,
      related: draft.related,
      struct: draft.struct,
      obsidianVault: draft.obsidianVault,
      obsidianRelPath: draft.obsidianRelPath,
      obsidianNoteId: draft.obsidianNoteId,
      obsidianSyncedAt: draft.obsidianSyncedAt,
    });
  }
  if (inserted) {
    const finalAbs = await alignFileName(inserted, abs, vaultDir);
    const finalId = path.basename(finalAbs, ".md");
    if (finalAbs !== abs && inserted.obsidianNoteId !== finalId) {
      return await updateBrainNote(userId, inserted.id, {
        obsidianRelPath: relDirOf(vaultDir, finalAbs),
        obsidianNoteId: finalId,
      });
    }
  }
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
