// 腾讯 ima 知识库 OpenAPI 客户端（只读检索 + 取原文，用于「导入通道」定位）。
//
// 端点与认证头均取自 ima 官方 OpenAPI（社区 ima-mcp-server 源码反推确认，非猜测）：
//   - Base:        https://ima.qq.com
//   - 知识库前缀:   openapi/wiki/v1   （所有请求 POST + JSON body）
//   - 笔记前缀:     openapi/note/v1
//   - 认证头:       ima-openapi-clientid / ima-openapi-apikey
//   - 响应结构:     { code, msg, data }，code===0 成功
//
// 本模块只负责「把用户自己的 ima 资料拉进来」，不做写回（定位：ima 只进不出）。

const BASE_URL = "https://ima.qq.com";
const WIKI_PREFIX = "openapi/wiki/v1";
const NOTE_PREFIX = "openapi/note/v1";

export interface ImaCredentials {
  clientId: string;
  apiKey: string;
}

export interface ImaKnowledgeBase {
  id: string;
  name: string;
  description?: string;
  // 其余字段透传
  [k: string]: unknown;
}

export interface ImaSearchHit {
  media_id?: string;
  title?: string;
  summary?: string;
  url?: string;
  // 文档更新时间（多种可能字段名，透传获取）
  updated_at?: string;
  update_time?: string;
  create_time?: string;
  modified_time?: string;
  last_modified?: string;
  [k: string]: unknown;
}

export interface ImaMediaInfo {
  media_id?: string;
  title?: string;
  note_content?: string; // 笔记类自动展开的正文（纯文本）
  url?: string; // 网页 / 文件类返回可访问 URL
  notebook_ext_info?: { notebook_id?: string };
  [k: string]: unknown;
}

export class ImaApiError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = "ImaApiError";
    this.code = code;
  }
}

async function imaRequest<T = unknown>(
  apiPath: string,
  body: Record<string, unknown>,
  creds: ImaCredentials,
  prefix: string = WIKI_PREFIX,
): Promise<T> {
  const url = `${BASE_URL}/${prefix}/${apiPath}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "ima-openapi-clientid": creds.clientId,
      "ima-openapi-apikey": creds.apiKey,
      "ima-openapi-ctx": "xiye_second_brain=1.0",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body || {}),
    cache: "no-store",
  });
  const text = await res.text();
  let parsed: { code?: number; msg?: string; data?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`[ima] 返回非 JSON（${res.status}）: ${text.slice(0, 200)}`);
  }
  if (parsed?.code !== 0) {
    throw new ImaApiError(parsed?.code ?? -1, parsed?.msg || "未知错误");
  }
  return (parsed.data ?? parsed) as T;
}

/** 列出当前账号下知识库（query 传空返回全部，含订阅库）。 */
export async function listKnowledgeBases(
  creds: ImaCredentials,
  query = "",
  cursor = "",
  limit = 20,
): Promise<{ list?: ImaKnowledgeBase[]; cursor?: string }> {
  return imaRequest(
    "search_knowledge_base",
    { query, cursor, limit },
    creds,
  );
}

/** 在指定知识库内按关键词搜索内容（核心检索接口）。 */
export async function searchKnowledge(
  creds: ImaCredentials,
  knowledgeBaseId: string,
  query: string,
  cursor = "",
): Promise<{ list?: ImaSearchHit[]; cursor?: string }> {
  return imaRequest(
    "search_knowledge",
    { query, knowledge_base_id: knowledgeBaseId, cursor },
    creds,
  );
}

/**
 * 枚举某知识库内的全部文档（增量同步用）。
 * ima search_knowledge 的 query 传空串会返回库内文档清单，分页拉全。
 * 返回非空 media_id / 标题的条目；跳过无标识的占位。
 */
export async function listKnowledgeBaseDocs(
  creds: ImaCredentials,
  knowledgeBaseId: string,
  maxPages = 20,
): Promise<ImaSearchHit[]> {
  const out: ImaSearchHit[] = [];
  const seen = new Set<string>();
  let cursor = "";
  for (let p = 0; p < maxPages; p++) {
    const data = await searchKnowledge(creds, knowledgeBaseId, "", cursor);
    const list = data.list ?? [];
    for (const h of list) {
      const id = String(h.media_id ?? "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(h);
    }
    const next = String(data.cursor ?? "");
    if (!next || next === cursor) break;
    cursor = next;
  }
  return out;
}

/** 从搜索命中条目的多种可能字段中提取"文档更新时间"（尽力而为，取不到返回 null）。 */
export function hitUpdatedAt(hit: ImaSearchHit): string | null {
  const cands = ["updated_at", "update_time", "modified_time", "last_modified", "create_time"];
  for (const c of cands) {
    const v = (hit as unknown as Record<string, unknown>)[c];
    if (typeof v === "string" && v.trim()) {
      // 数字时间戳 → 转 ISO
      const ts = Number(v);
      if (!Number.isNaN(ts) && ts > 1e9 && ts < 1e13) {
        return new Date(ts * (ts < 1e12 ? 1000 : 1)).toISOString();
      }
      return v.trim();
    }
  }
  return null;
}

/**
 * 获取知识库条目原文：
 * - 网页 / 微信文章 / 文件类 → 返回可访问 url
 * - 笔记类（media_id 以 note_ 开头）→ 自动再调 get_doc_content 拉取正文（note_content）
 */
export async function getMediaInfo(
  creds: ImaCredentials,
  mediaId: string,
): Promise<ImaMediaInfo> {
  const info = await imaRequest<ImaMediaInfo>(
    "get_media_info",
    { media_id: mediaId },
    creds,
  );
  const noteId = info?.notebook_ext_info?.notebook_id;
  if (noteId && !info.note_content) {
    try {
      const doc = await imaRequest<{ content?: string }>(
        "get_doc_content",
        { note_id: String(noteId), target_content_format: 0 },
        creds,
        NOTE_PREFIX,
      );
      info.note_content = doc?.content ?? "";
    } catch {
      // 笔记正文读取失败不致命，保留链接即可
    }
  }
  return info;
}
