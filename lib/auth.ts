import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";

// 生产环境必须显式配置 AUTH_SECRET；未配置时用进程内随机值兜底（session 重启失效，但绝不可被伪造）。
// 开发环境用固定 dev 值，方便本地调试。
const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ||
    (process.env.NODE_ENV === "production"
      ? randomBytes(32).toString("hex")
      : "dev-insecure-secret-change-me-in-prod"),
);

export const SESSION_COOKIE = "xiye_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 天

export interface SessionUser {
  sub: string;
  email: string;
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export async function signSession(payload: SessionUser): Promise<string> {
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET);
}

export async function verifySession(
  token: string,
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (typeof payload.sub === "string" && typeof payload.email === "string") {
      return { sub: payload.sub, email: payload.email };
    }
    return null;
  } catch {
    return null;
  }
}

/** 从请求 cookie 读取当前登录用户；未登录返回 null。仅在服务端调用。 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  };
}
