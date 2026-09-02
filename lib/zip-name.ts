// zip 条目名清洗：防止路径穿越（../../etc/passwd）与绝对/盘符路径写入。
// 前端 buildZip 与服务端 makeZip 共用同一套规则，避免两处实现漂移。

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/**
 * 把任意条目名规范为安全的相对路径：
 * - 反斜杠归一为斜杠
 * - 去掉控制字符
 * - 逐段丢弃为空 / "." / ".." 的段
 * - 拒绝盘符（C:）与 UNC 前缀
 * - 空结果回退为 "_"
 */
export function sanitizeZipEntryName(name: string): string {
  const cleaned = String(name ?? "")
    .replace(/\\/g, "/")
    .replace(CONTROL_CHARS, "");

  const keptDotSlash = cleaned.split("/").filter((seg) => {
    const s = seg.trim();
    return s.length > 0 && s !== "." && s !== "..";
  });

  const joined = keptDotSlash.join("/");
  // 盘符（C:）、UNC（//server/share）在拆分过滤后可能残留于首段
  if (/^[a-zA-Z]:/.test(joined)) return "_";
  const safe = joined.length > 0 ? joined : "_";
  return safe;
}
