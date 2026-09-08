import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db, userObsidianConfig } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { startObsidianWatch, stopObsidianWatch } from "@/lib/obsidian-watch";

export const runtime = "nodejs";

// GET/PUT /api/brain/obsidian/config
// vaultPath：本地 Obsidian vault 绝对路径；enabled：双向同步总开关。
const putSchema = z.object({
  vaultPath: z.string().max(2000).optional(),
  enabled: z.boolean().optional(),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(userObsidianConfig)
    .where(eq(userObsidianConfig.userId, user.sub))
    .limit(1);
  const row = rows[0];
  return NextResponse.json({
    config: row
      ? {
          vaultPath: row.vaultPath,
          enabled: !!row.enabled,
          lastSyncedAt: row.lastSyncedAt ?? null,
        }
      : { vaultPath: "", enabled: false, lastSyncedAt: null },
  });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const now = Date.now();
  const existing = await db
    .select()
    .from(userObsidianConfig)
    .where(eq(userObsidianConfig.userId, user.sub))
    .limit(1);

  const vaultPath = parsed.data.vaultPath ?? existing[0]?.vaultPath ?? "";
  const enabled =
    parsed.data.enabled !== undefined ? (parsed.data.enabled ? 1 : 0) : existing[0]?.enabled ?? 0;

  // 路径诊断：若用户提供了新路径，校验存在性与类型
  if (parsed.data.vaultPath !== undefined && vaultPath.trim()) {
    let diag: string | null = null;
    try {
      const s = fs.statSync(vaultPath.trim());
      if (!s.isDirectory()) diag = "路径存在但不是文件夹";
    } catch {
      diag = "目录不存在或无法访问（请确认路径拼写正确，Windows 用 D:\\xxx 格式）";
    }
    // 额外检查：Windows 下 .obsidian 文件夹是否存在（辅助判断是否为 Obsidian vault）
    if (!diag && !fs.existsSync(path.join(vaultPath.trim(), ".obsidian"))) {
      diag = null; /* 不强制要求 .obsidian，仅提示 */
    }
    if (diag) {
      return NextResponse.json({ ok: false, error: "vault_invalid", detail: diag }, { status: 400 });
    }
  }

  if (existing[0]) {
    await db
      .update(userObsidianConfig)
      .set({ vaultPath, enabled, updatedAt: now })
      .where(eq(userObsidianConfig.userId, user.sub));
  } else {
    await db.insert(userObsidianConfig).values({
      userId: user.sub,
      vaultPath,
      enabled,
      lastSyncedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }
  if (enabled === 1) {
    const watchResult = await startObsidianWatch();
    if (!watchResult.ok) {
      return NextResponse.json({ ok: false, error: "watch_failed", detail: watchResult.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, watching: watchResult.watching });
  } else {
    stopObsidianWatch();
    return NextResponse.json({ ok: true, watching: 0 });
  }
}
