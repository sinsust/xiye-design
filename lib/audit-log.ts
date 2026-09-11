/**
 * 全局操作审计日志（商用合规基建，PRD §8）。
 *
 * 覆盖：认证（登录/注册/改密/重置/登出）、第三方凭证绑定与解绑、
 * AI 端点调用流水。
 *
 * 三条设计铁律：
 * 1. **永不阻断业务** —— 写入失败只告警，不抛错、不改主流程返回值。
 *    审计是旁路设施，它挂了不该让用户用不了产品。
 * 2. **只写去敏元数据** —— detail 里严禁落明文机密（口令、API Key、笔记正文）。
 *    只写类型、条数、操作名这类元数据。
 * 3. **注销后留痕** —— audit_logs.user_id 可空且不设级联删除，
 *    用户注销不会连带删掉审计记录（否则失去合规意义）。
 */
import { db, auditLogs } from "@/lib/db";
import { genId } from "@/lib/id";
import { getClientIp } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

/** 审计动作枚举：新增动作在此登记，避免各处硬编码字符串拼写漂移。 */
export const AUDIT_ACTION = {
  // —— 认证 ——
  LOGIN_SUCCESS: "login_success",
  LOGIN_FAILED: "login_failed",
  REGISTER: "register",
  LOGOUT: "logout",
  PASSWORD_RESET_REQUEST: "password_reset_request",
  PASSWORD_UPDATE: "password_update",
  // —— 第三方凭证 ——
  CREDENTIAL_BIND: "credential_bind",
  CREDENTIAL_UNBIND: "credential_unbind",
  // —— AI ——
  AI_CALL: "ai_call",
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

export interface AuditEntry {
  /** 用户 ID；登录失败等未识别场景可为空（仍需留痕以便发现撞库） */
  userId?: string | null;
  action: AuditAction | string;
  /** 目标类型：project / note / credential / private_data ... */
  targetType?: string | null;
  targetId?: string | null;
  /** 去敏元数据（JSON 对象），严禁落明文机密 */
  detail?: Record<string, unknown> | null;
  ip?: string | null;
}

/** 写入超时上限：审计是旁路，绝不能因 DB 慢查询占死请求/连接。 */
const AUDIT_WRITE_TIMEOUT_MS = 3_000;

/**
 * 写一条审计日志。失败静默（仅 warn），不影响调用方。
 * 可 await（需要确保写入完成时），也可 `void logAudit(...)` 发射后不管。
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const write = db.insert(auditLogs).values({
      id: genId("aud"),
      userId: entry.userId ?? null,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      detail: entry.detail ? JSON.stringify(entry.detail) : null,
      ip: entry.ip ?? null,
      createdAt: Date.now(),
    });
    await Promise.race([
      write,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("audit_write_timeout")), AUDIT_WRITE_TIMEOUT_MS),
      ),
    ]);
  } catch (err) {
    console.warn("[audit] write failed (non-fatal):", (err as Error)?.message);
  }
}

/**
 * 从请求里提取 IP 后写审计。**fire-and-forget** 用法：`void logAuditReq(req, {...})`。
 * 用在不需要等待写入完成的请求链路上（绝大多数场景）。
 */
export function logAuditReq(req: NextRequest, entry: Omit<AuditEntry, "ip">): void {
  void logAudit({ ...entry, ip: getClientIp(req) });
}

/**
 * 邮箱掩码：保留首末字符与域名，中间打码（如 `a***e@gmail.com`）。
 * 认证类审计需要「能追溯到是谁」才有排查价值，但不应落完整邮箱明文。
 */
export function maskEmail(email?: string | null): string | undefined {
  if (!email) return undefined;
  const at = email.indexOf("@");
  if (at <= 0) return undefined;
  const name = email.slice(0, at);
  const domain = email.slice(at);
  if (name.length <= 2) return `${name.slice(0, 1)}*${domain}`;
  return `${name.slice(0, 1)}${"*".repeat(name.length - 2)}${name.slice(-1)}${domain}`;
}
