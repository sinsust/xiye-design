// 服务端错误脱敏：错误详情回给前端前统一过一遍。
// 目的：避免 supabase 连接串、上游 token、堆栈绝对路径、用户可控文件名等内部信息外泄。

const MAX_DETAIL_LEN = 200;

const REDACT_RULES: [RegExp, string][] = [
  // Bearer / Basic 凭据
  [/(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 ***"],
  // key=value 形式的敏感字段
  [/\b(token|access_token|refresh_token|api_key|apikey|secret|password|passwd|pwd|client_secret|authorization)\b(\s*[=:]\s*)("?)[^\s,&"']+\3/gi, "$1$2***"],
  // 含凭据的连接串 / URL
  [/\b(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s"']+/gi, "$1://***"],
  [/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, "$1***@"],
  // supabase / 常见 SaaS 项目 URL
  [/\bhttps?:\/\/[a-z0-9-]+\.supabase\.(co|in)\b[^\s"']*/gi, "***"],
  // 绝对路径（Windows 与 Unix）
  [/[A-Za-z]:\\[^\s"']+/g, "***"],
  [/(?<![A-Za-z0-9])\/(?:Users|home|usr|var|opt|app|data)\/[^\s"']+/g, "***"],
  // at Foo (file:line) 堆栈行
  [/at\s+[^\n(]*\([^\n)]*\)/g, "at ***"],
];

/**
 * 把任意 throw 值转成可安全返回给前端的字符串：
 * - 非 Error（字符串/对象）统一降级为 fallback 或短 JSON
 * - 剥控制字符与换行（防日志/响应注入）
 * - 按规则 redact 凭据、连接串、绝对路径、堆栈
 * - 限长 200
 */
export function safeDetail(err: unknown, fallback = "内部错误"): string {
  let raw: string;
  if (err instanceof Error) {
    raw = err.message || fallback;
  } else if (typeof err === "string") {
    raw = err || fallback;
  } else if (err && typeof err === "object") {
    try {
      raw = JSON.stringify(err) || fallback;
    } catch {
      raw = fallback;
    }
  } else {
    raw = fallback;
  }

  let out = raw.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (!out) out = fallback;
  for (const [re, rep] of REDACT_RULES) out = out.replace(re, rep);
  if (out.length > MAX_DETAIL_LEN) out = `${out.slice(0, MAX_DETAIL_LEN)}…`;
  return out;
}

/**
 * 把保存/写入类异常收敛成「一句用户能读懂的话」，替代 drizzle 原始
 * "Failed query: insert into ... params: ..." 千字大报错直出 UI。
 * 完整错误仍由调用方 console.error 留在服务端日志。
 */
export function compactSaveError(err: unknown, fallback = "保存失败：数据库写入异常，请稍后重试"): string {
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!msg) return fallback;
  const col = msg.match(/column\s+"?([A-Za-z_][\w.]*)"?\s+does not exist/i);
  if (col) return `数据库缺列「${col[1]}」，需执行 schema 修复（重启服务可自动补列）`;
  const rel = msg.match(/relation\s+"([^"]+)"\s+does not exist/i);
  if (rel) return `数据表「${rel[1]}」不存在，需执行 schema 修复（重启服务可自动补表）`;
  if (/duplicate key|unique constraint/i.test(msg)) return "内容重复：已有相同记录，请勿重复提交";
  if (/violates foreign key/i.test(msg)) return "关联数据不存在（可能已被删除），请刷新后重试";
  if (/connect|ECONNREFUSED|ETIMEDOUT|timeout/i.test(msg)) return "数据库连接失败或超时，请稍后重试";
  const out = msg.replace(/[\r\n]+/g, " ").trim();
  return out.length > 120 ? `${out.slice(0, 120)}…` : out || fallback;
}
