import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/auth";

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

/**
 * 写/生成类 API 门禁。
 *
 * 形态 C（桌面应用）下不再有登录体系，本地档案恒存在：
 * 本函数恒返回 { user, res: null }，所有调用方（保存项目、AI 生成/改写等）
 * 的既有分支逻辑（if (res) return res）自动退化为永不触发，
 * 业务代码零改动。
 */
export async function requireUser(): Promise<
  { user: SessionUser; res: null } | { user: null; res: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) return { user: null, res: unauthorizedResponse() };
  return { user, res: null };
}