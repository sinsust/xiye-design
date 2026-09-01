/**
 * 表格会话持久化（L2）—— Serverless 跨实例/冷启动下的兜底存储。
 *
 * session-cache.ts 的进程内 Map 作为 L1 热缓存（同实例零延迟）；
 * 本模块作为 L2，把整条 CacheEntry 经 gzip + base64 存入 Supabase
 * （brain_table_sessions 表）。
 *
 * 认证：用 service_role 客户端直写，绕过项目默认开启的 RLS，确保写入路径
 * 在 Serverless 多实例下稳定生效（不依赖 RLS 开关 / SQL 重跑是否到位）。
 * 防串读由应用层 userId 校验兜底（loadRemote 比对 entry.userId），
 * 随机 tableId 不可枚举，他人无法读取。
 *
 * 优雅降级：若未配置 Supabase（本地无 env / 表未建 / 网络异常），
 * 全部函数静默退化为「内存-only」并仅告警一次，不影响本地开发。
 */

import { gzipSync, gunzipSync } from "node:zlib";
import { createServerSupabaseService } from "@/lib/supabase/server";
import { type CacheEntry, TTL_MS } from "./session-cache";

const TABLE = "brain_table_sessions";
let warned = false;

function warnOnce(msg: string): void {
  if (!warned) {
    console.warn(`[session-cache] Supabase 持久化不可用，降级为内存缓存：${msg}`);
    warned = true;
  }
}

/**
 * L2 是否可用（只读 env，避免触发 required() 抛错）。
 *
 * 必须检查 SUPABASE_SERVICE_ROLE_KEY —— 本模块走 createServerSupabaseService()
 * 用 service_role 绕过 RLS。若只检查 ANON_KEY，则在「配了 anon 但漏配
 * service_role」的部署（例如 Vercel 只填了 NEXT_PUBLIC_* 变量）里会误判为可用，
 * 随后请求被 RLS 拒（42501）→ 落入 catch → 静默降级内存，
 * 跨实例 410 根因无法闭环且几乎无法排查。
 * 因此此处凭据检查必须与实际使用的凭据严格一致，并在缺失时明确告警。
 */
function pgEnabled(): boolean {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    warnOnce("缺少 NEXT_PUBLIC_SUPABASE_URL");
    return false;
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    warnOnce(
      "缺少 SUPABASE_SERVICE_ROLE_KEY —— L2 需 service_role 绕过 RLS，" +
        "请在部署环境（Vercel → Settings → Environment Variables）补上该变量",
    );
    return false;
  }
  return true;
}

/** 写入/更新一条会话（upsert，按 id 冲突覆盖） */
export async function saveRemote(entry: CacheEntry): Promise<void> {
  if (!pgEnabled()) return;
  try {
    const supabase = createServerSupabaseService();
    const payload = gzipSync(Buffer.from(JSON.stringify(entry))).toString("base64");
    const { error } = await supabase
      .from(TABLE)
      .upsert(
        {
          id: entry.id,
          user_id: entry.userId,
          payload,
          expires_at: entry.createdAt + TTL_MS,
          created_at: entry.createdAt,
        },
        { onConflict: "id" },
      );
    if (error) throw error;
  } catch (e) {
    warnOnce((e as Error).message);
  }
}

/** 读取一条会话；过期则删除并返回 null；非本人/不存在返回 null */
export async function loadRemote(id: string, userId: string): Promise<CacheEntry | null> {
  if (!pgEnabled()) return null;
  try {
    const supabase = createServerSupabaseService();
    const { data, error } = await supabase
      .from(TABLE)
      .select("payload, expires_at")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    if ((data.expires_at as number) < Date.now()) {
      await supabase.from(TABLE).delete().eq("id", id);
      return null;
    }
    const buf = Buffer.from(data.payload as string, "base64");
    const entry = JSON.parse(gunzipSync(buf).toString("utf8")) as CacheEntry;
    if (entry.userId !== userId) return null; // 双重保险（应用层 userId 校验兜底）
    return entry;
  } catch (e) {
    warnOnce((e as Error).message);
    return null;
  }
}

/** 删除一条会话 */
export async function deleteRemote(id: string): Promise<void> {
  if (!pgEnabled()) return;
  try {
    const supabase = createServerSupabaseService();
    await supabase.from(TABLE).delete().eq("id", id);
  } catch {
    /* 忽略：删除失败不影响主流程 */
  }
}
