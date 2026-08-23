import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { SKILL_CATALOG } from "@/data/skill-catalog";

// 读取本地 skill 仓库中某个 skill 的 SKILL.md 原文，供知识库页面「查看」弹窗展示。
// 仅允许读取已在 SKILL_CATALOG 中登记、且位于仓库合法路径内的文件，防目录穿越。
export const runtime = "nodejs";

const SKILL_REPO_ROOT = "D:/workspace/skill";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "缺少 id" }, { status: 400 });
  }
  if (!SKILL_CATALOG.some((s) => s.id === id)) {
    return NextResponse.json(
      { ok: false, error: "未知 skill" },
      { status: 404 },
    );
  }

  const filePath = path.join(
    SKILL_REPO_ROOT,
    ".agents",
    "skills",
    id,
    "SKILL.md",
  );
  // 二次校验：解析后的真实路径必须仍在仓库根目录内。
  const realRoot = path.resolve(SKILL_REPO_ROOT);
  if (!path.resolve(filePath).startsWith(realRoot)) {
    return NextResponse.json({ ok: false, error: "非法路径" }, { status: 400 });
  }

  try {
    const content = await fs.readFile(filePath, "utf8");
    return NextResponse.json({ ok: true, content });
  } catch {
    return NextResponse.json(
      { ok: false, error: "文件读取失败" },
      { status: 404 },
    );
  }
}
