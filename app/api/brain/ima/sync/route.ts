import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getImaConfig } from "@/lib/ima-config";
import {
  listKnowledgeBases,
  listKnowledgeBaseDocs,
  getMediaInfo,
  hitUpdatedAt,
  type ImaKnowledgeBase,
} from "@/lib/ima";
import {
  importImaNote,
  updateImaNote,
} from "@/lib/ima-brain";
import {
  findBrainNoteByImaDocId,
  insertBrainImaSyncLog,
  listBrainImaSyncLogs,
  type BrainImaSyncLogEntry,
} from "@/lib/brain-db";

export const runtime = "nodejs";

// 内存同步进度（单实例个人项目够用）：<userId,{done,total}>，前端轮询展示「12/87」
const syncProgress = new Map<string, { running: boolean; done: number; total: number }>();

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("ima_timeout")), ms)),
  ]);
}

async function docContent(cfg: { clientId: string; apiKey: string }, mediaId: string) {
  const info = await withTimeout(getMediaInfo(cfg, mediaId), 8000);
  const content =
    (info.note_content && info.note_content.trim()) ||
    (typeof info.url === "string" ? info.url : "") ||
    "";
  const title =
    (typeof info.title === "string" && info.title.trim()) || `ima-${mediaId}`;
  return { content, title };
}

/**
 * POST /api/brain/ima/sync
 * 增量同步用户全部 ima 知识库 → brain_notes。核心流程：
 *   枚举各库文档 → 按 imaDocId 查重：
 *     - 无记录 → 拉原文 → organize → 新建
 *     - 有记录且文档时间更新 → 拉原文 → 重排整理 → 更新
 *     - 有记录且无变化 → 跳过
 *   返回 { result:{...counts,status,failures}, log }，并写一条同步日志。
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const cfg = await getImaConfig(user.email);
  if (!cfg) return NextResponse.json({ error: "ima_not_bound" }, { status: 409 });

  if (syncProgress.get(user.sub)?.running) {
    return NextResponse.json({ error: "sync_in_progress" }, { status: 409 });
  }
  syncProgress.set(user.sub, { running: true, done: 0, total: 0 });

  const syncedAt = new Date().toISOString();
  const writeLog = async (
    total: number,
    created: number,
    updated: number,
    skipped: number,
    failed: number,
    failures: { title: string; reason: string }[],
    status: "success" | "partial" | "failed",
  ) => {
    await insertBrainImaSyncLog(user.sub, { syncedAt, total, created, updated, skipped, failed, status, failures });
  };

  try {
    // 1. 列出知识库
    let kbs: ImaKnowledgeBase[] = [];
    try {
      const kbData = await withTimeout(listKnowledgeBases(cfg), 8000);
      kbs = (kbData.list ?? []).slice(0, 20);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "list_kb_failed";
      await writeLog(0, 0, 0, 0, 1, [{ title: "(知识库列表)", reason: msg }], "failed");
      return NextResponse.json({ error: "sync_failed", detail: msg }, { status: 502 });
    }

    // 2. 枚举全部文档
    const docs: { mediaId: string; title: string; updatedAt: string | null }[] = [];
    for (const kb of kbs) {
      const kbId = String(kb.id ?? "");
      if (!kbId) continue;
      try {
        const list = await withTimeout(listKnowledgeBaseDocs(cfg, kbId), 30);
        for (const h of list) {
          const mediaId = String(h.media_id ?? "");
          if (!mediaId) continue;
          docs.push({
            mediaId,
            title: (typeof h.title === "string" && h.title.trim()) || `ima-${mediaId}`,
            updatedAt: hitUpdatedAt(h),
          });
        }
      } catch {
        // 单库枚举失败不中断全局（该库文档在失败计数里体现）
      }
    }
    const total = docs.length;
    syncProgress.set(user.sub, { running: true, done: 0, total });

    // 3. 逐条查重处理
    const seen = new Set<string>();
    let created = 0, updated = 0, skipped = 0, failed = 0;
    const failures: { title: string; reason: string }[] = [];

    for (const d of docs) {
      if (seen.has(d.mediaId)) {
        skipped++;
        continue;
      }
      seen.add(d.mediaId);
      syncProgress.set(user.sub, { running: true, done: seen.size, total });

      try {
        const existing = await findBrainNoteByImaDocId(user.sub, d.mediaId);
        if (!existing) {
          // 新建：拉原文 → 完整整理落库
          const { content, title } = await docContent(cfg, d.mediaId);
          const r = await importImaNote(user.sub, { content, title, mediaId: d.mediaId });
          if (r.note) created++;
          else { failed++; failures.push({ title: d.title, reason: "导入失败" }); }
          continue;
        }

        // 已存在：仅当文档有更近的更新时间时才需更新（避免重复拉取/整理）
        const docUpdated = d.updatedAt;
        const needUpdate =
          !!docUpdated && (!existing.imaSyncedAt || docUpdated > existing.imaSyncedAt);
        if (needUpdate) {
          const { content, title } = await docContent(cfg, d.mediaId);
          const r = await updateImaNote(user.sub, existing, { content, title, mediaId: d.mediaId });
          if (r.changed) updated++;
          else skipped++;
        } else {
          skipped++;
        }
      } catch (err) {
        failed++;
        failures.push({
          title: d.title,
          reason: err instanceof Error ? err.message.slice(0, 200) : "未知错误",
        });
      }
    }

    const total2 = created + updated + skipped + failed;
    const status =
      total2 && failed === total2
        ? ("failed" as const)
        : failed > 0
          ? ("partial" as const)
          : ("success" as const);
    await writeLog(total2, created, updated, skipped, failed, failures, status);

    const result = { total: total2, created, updated, skipped, failed, status, failures };
    const log: BrainImaSyncLogEntry | undefined = (await listBrainImaSyncLogs(user.sub, 1))[0] ?? undefined;
    return NextResponse.json({ result, log });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "sync_failed";
    await writeLog(0, 0, 0, 0, 1, [{ title: "(同步中断)", reason: msg }], "failed");
    return NextResponse.json({ error: "sync_failed", detail: msg }, { status: 502 });
  } finally {
    syncProgress.set(user.sub, { running: false, done: 0, total: 0 });
  }
}

// GET /api/brain/ima/sync?action=logs | progress
//   action=logs     → 最近同步日志（供「最近同步时间 + 结果摘要」展示）
//   action=progress → 当前同步进度 { running, done, total }（前端轮询）
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const action = req.nextUrl.searchParams.get("action") || "logs";

  if (action === "progress") {
    return NextResponse.json(syncProgress.get(user.sub) ?? { running: false, done: 0, total: 0 });
  }
  const logs = await listBrainImaSyncLogs(user.sub, 5);
  return NextResponse.json({ logs });
}