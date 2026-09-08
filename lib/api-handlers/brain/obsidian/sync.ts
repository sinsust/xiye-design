import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db, userObsidianConfig } from "@/lib/db";
import { eq } from "drizzle-orm";
import { startObsidianWatch, manualSyncAll } from "@/lib/obsidian-watch";

export const runtime = "nodejs";

// POST /api/brain/obsidian/sync —— 手动全量同步：确保 watcher 运行并扫描 vault 入库
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 先检查 vault 路径是否可用
  const cfgs = await db.select().from(userObsidianConfig).where(eq(userObsidianConfig.userId, user.sub)).limit(1);
  const cfg = cfgs[0];
  if (cfg?.vaultPath) {
    try {
      fs.accessSync(cfg.vaultPath, fs.constants.R_OK);
    } catch {
      return NextResponse.json({ ok: false, error: "vault_not_found", detail: `无法访问 vault 目录：${cfg.vaultPath}，请确认路径正确且存在` }, { status: 400 });
    }
  }

  const watchResult = await startObsidianWatch();
  const { processed } = await manualSyncAll();
  return NextResponse.json({ ok: true, processed, watching: watchResult.watching });
}
