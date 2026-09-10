// 腾讯 ima 知识库 OpenAPI 客户端（只读检索 + 取原文 + 写适配，决策 8 双向）。
//
// 端点与认证头均取自 ima 官方 OpenAPI（社区 ima-mcp-server 源码反推确认，非猜测）：
//   - Base:        https://ima.qq.com
//   - 知识库前缀:   openapi/wiki/v1   （所有请求 POST + JSON body）
//   - 笔记前缀:     openapi/note/v1
//   - 认证头:       ima-openapi-clientid / ima-openapi-apikey
//   - 响应结构:     { code, msg, data }，code===0 成功
//
// 定位：读（listKnowledgeBases / searchKnowledge / getMediaInfo / listKnowledgeBaseDocs）
// 用于「把用户自己的 ima 资料拉进来」；写（createImaNote / appendImaNote）为决策 8 的双向能力。
// 写端点契约未在本仓库锁定：不可用/无权限一律抛 ImaApiError，由调用方标记 degraded，绝不伪装成功。

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
  // 实测 ima 返回 kb_id / kb_name；映射后统一为 id / name 供上层使用
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
  url?: string; // 网页 / 文件类返回可访问 URL（由 url_info.url 提升而来）
  media_type?: number; // 1=PDF 3=Word 6=微信文章 9=图片 11=笔记 99=文件夹
  url_info?: { url?: string; headers?: Record<string, string> }; // 实测返回结构
  notebook_ext_info?: { notebook_id?: string };
  [k: string]: unknown;
}

/** 写入结果：仅透传 id / note_id / url 等落点引用字段，其余透传。 */
export interface ImaWriteResult {
  id?: string;
  note_id?: string;
  url?: string;
  [k: string]: unknown;
}

export interface ImaCreateNoteInput {
  content: string;
  title?: string;
  kbId?: string; // 目标知识库 id（notebook_id）；缺省为默认收藏夹
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

/**
 * 归一化知识库条目：实测 ima 返回 kb_id / kb_name（另有接口返回 id / name），
 * 统一映射为 id / name，避免上层各处写 ?? 兼容链。
 */
function normalizeKb(raw: Record<string, unknown>): ImaKnowledgeBase {
  return {
    ...raw,
    id: String(
      raw?.kb_id ?? raw?.id ?? raw?.knowledge_base_id ?? raw?.knowledgeBaseId ?? "",
    ),
    name: String(
      raw?.kb_name ?? raw?.name ?? raw?.knowledge_base_name ?? "未命名知识库",
    ),
  };
}

/** 列表字段兜底：实测响应为 info_list（部分接口为 knowledge_list / list）。 */
function pickList(data: Record<string, unknown>, ...keys: string[]): unknown[] {
  for (const k of keys) {
    const v = data?.[k];
    if (Array.isArray(v)) return v;
  }
  return [];
}

/** 列出当前账号下知识库（query 传空返回全部，含订阅库）。 */
export async function listKnowledgeBases(
  creds: ImaCredentials,
  query = "",
  cursor = "",
  limit = 20,
): Promise<{ list?: ImaKnowledgeBase[]; cursor?: string }> {
  const data = await imaRequest<Record<string, unknown>>(
    "search_knowledge_base",
    { query, cursor, limit },
    creds,
  );
  const list = pickList(data, "info_list", "list", "searched_knowledge_base_infos").map(
    (k) => normalizeKb(k as Record<string, unknown>),
  );
  return { list, cursor: String(data?.next_cursor ?? "") };
}

/** 在指定知识库内按关键词搜索内容（核心检索接口）。 */
export async function searchKnowledge(
  creds: ImaCredentials,
  knowledgeBaseId: string,
  query: string,
  cursor = "",
): Promise<{ list?: ImaSearchHit[]; cursor?: string }> {
  const data = await imaRequest<Record<string, unknown>>(
    "search_knowledge",
    { query, knowledge_base_id: knowledgeBaseId, cursor },
    creds,
  );
  const list = pickList(data, "info_list", "list") as ImaSearchHit[];
  return { list, cursor: String(data?.next_cursor ?? "") };
}

/**
 * 枚举某知识库内的全部文档（增量同步用）。
 *
 * 实测结论（2026-09-09 用真实凭证验证）：
 * - 不能用 search_knowledge 枚举：即使传了正确的 knowledge_base_id，
 *   query 为空或任意关键词都返回 `{ info_list: [] }`，永远拿不到文档；
 *   不传 knowledge_base_id 则直接报 220004「invalid knowledge_base_id」。
 * - 正确接口是 `get_knowledge_list`：传 knowledge_base_id + cursor + limit，
 *   返回 data.knowledge_list[]（每项含 media_id / title / media_type / parent_folder_id），
 *   分页靠 is_end + next_cursor。
 * - media_type：1=PDF 3=Word 6=微信文章 9=图片 11=笔记 99=文件夹。
 * 这里跳过文件夹（99），文件夹递归留给后续需要时再做。
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
    const data = await imaRequest<Record<string, unknown>>(
      "get_knowledge_list",
      { knowledge_base_id: knowledgeBaseId, cursor, limit: 50 },
      creds,
    );
    const list = pickList(data, "knowledge_list", "info_list", "list");
    for (const raw of list) {
      const h = raw as Record<string, unknown>;
      const id = String(h?.media_id ?? "");
      if (!id || seen.has(id)) continue;
      // 文件夹不入库（本身无正文），避免把目录当笔记导入
      if (Number(h?.media_type ?? 0) === 99) continue;
      seen.add(id);
      out.push(h as ImaSearchHit);
    }
    if (data?.is_end === true) break;
    const next = String(data?.next_cursor ?? "");
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
  // 实测：可访问地址在 data.url_info.url（不是顶层 url），提升为 info.url 供调用方统一读取
  const nestedUrl = info?.url_info?.url;
  if (typeof nestedUrl === "string" && !info.url) info.url = nestedUrl;
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

/**
 * 在 ima 创建一篇新笔记（决策 8 双向写）。
 *
 * 实测修正（2026-09-09 真实凭证验证）：官方笔记模块的写接口是 `import_doc`
 * （不是之前反推的 add_note），参数为 content + content_format（固定 1=Markdown），
 * 返回 `data.note_id`。kbId 属于知识库维度，「写入知识库」需走
 * create_media → COS 上传 → add_knowledge 三步，此处不做（先保证写笔记可用）。
 * 端点不可用/无权限会抛 ImaApiError，由调用方标记 degraded。
 */
export async function createImaNote(
  creds: ImaCredentials,
  input: ImaCreateNoteInput,
): Promise<ImaWriteResult> {
  // 实测：ima 以正文首行标题作为笔记名；title 参数亦一并传（兼容后续服务端支持）
  const head = input.title?.trim();
  const content = head && !input.content.trimStart().startsWith("#")
    ? `# ${head}\n\n${input.content}`
    : input.content;
  return imaRequest<ImaWriteResult>(
    "import_doc",
    {
      content,
      content_format: 1,
      ...(head ? { title: head } : {}),
    },
    creds,
    NOTE_PREFIX,
  );
}

/**
 * 向既有 ima 笔记追加正文（决策 8 双向写）。
 *
 * 实测修正（2026-09-09）：官方为 `append_doc`（不是 update_note），
 * 参数 note_id + content + content_format（固定 1=Markdown）。
 */
export async function appendImaNote(
  creds: ImaCredentials,
  noteId: string,
  content: string,
): Promise<ImaWriteResult> {
  return imaRequest<ImaWriteResult>(
    "append_doc",
    { note_id: noteId, content, content_format: 1 },
    creds,
    NOTE_PREFIX,
  );
}

/**
 * 从写接口响应里取出 ima 笔记 id。
 * 实测（2026-09-09）：import_doc / append_doc 均返回 `data.note_id`（不是 id），
 * 早期代码读 `id` 会拿到 undefined，导致写回成功却存不下定位 id、无法二次追加。
 */
export function imaWriteNoteId(res: ImaWriteResult | null | undefined): string | null {
  const raw = (res as Record<string, unknown> | null | undefined)?.note_id;
  const alt = (res as Record<string, unknown> | null | undefined)?.id;
  const v = typeof raw === "string" && raw.trim() ? raw : typeof alt === "string" ? alt : "";
  return v ? String(v) : null;
}