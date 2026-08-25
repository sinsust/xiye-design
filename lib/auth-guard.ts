import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/auth";

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

/**
 * 写/生成类 API 登录门禁：未登录返回 401，需登录的功能（保存项目、AI 生成/改写等）统一用它。
 * 用法：const { res } = await requireUser(); if (res) return res;
 */
export async function requireUser(): Promise<
  { user: SessionUser; res: null } | { user: null; res: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) return { user: null, res: unauthorizedResponse() };
  return { user, res: null };
}