/**
 * 飞书多维表格 —— REST 客户端封装
 *
 * 封装飞书开放平台鉴权与 bitable 数据读取：
 *  - 应用凭证（FEISHU_APP_ID / FEISHU_APP_SECRET）读取与缺失校验；
 *  - OAuth 授权码换 user_access_token / refresh_token；
 *  - 用 user_access_token 列出数据表 / 字段元数据 / 分页拉全量记录。
 *
 * 不依赖任何用户私有 key 即可 tsc；运行时缺失 env 或接口失败时抛清晰错误。
 * 底层使用全局 fetch（Node 18+ 自带），控制面走 https://open.feishu.cn/open-apis。
 */

import type {
  FeishuAppConfig,
  FeishuFieldMeta,
  FeishuListFieldsResponse,
  FeishuListRecordsResponse,
  FeishuOAuthTokenResponse,
  FeishuRecord,
} from "./types";

const FEISHU_BASE = "https://open.feishu.cn/open-apis";

/** 飞书接口业务错误（code !== 0）。 */
export class FeishuApiError extends Error {
  code: number;
  constructor(code: number, msg: string) {
    super(`[feishu] code=${code} ${msg}`);
    this.name = "FeishuApiError";
    this.code = code;
  }
}

/** 读取飞书应用配置；缺失任一必需 env 时抛清晰错误（key 由用户后续补充）。 */
export function getFeishuAppConfig(): FeishuAppConfig {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  const redirectUri = process.env.FEISHU_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri) {
    const missing: string[] = [];
    if (!appId) missing.push("FEISHU_APP_ID");
    if (!appSecret) missing.push("FEISHU_APP_SECRET");
    if (!redirectUri) missing.push("FEISHU_REDIRECT_URI");
    throw new Error(
      `[feishu] 未配置飞书应用凭证：${missing.join(", ")}。请在 .env 中补充飞书自建应用的 App ID / App Secret / 回调地址后再使用。`,
    );
  }
  return { appId, appSecret, redirectUri };
}

interface TokenBundle {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope?: string;
}

/** 飞书 OAuth：用授权码换取 user_access_token + refresh_token。 */
export async function exchangeCodeForToken(code: string): Promise<TokenBundle> {
  const { appId, appSecret, redirectUri } = getFeishuAppConfig();
  const res = await fetch(`${FEISHU_BASE}/authen/v1/oidc/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
    }),
  });
  const data = (await res.json()) as FeishuOAuthTokenResponse;
  if (data.code !== 0 || !data.access_token) {
    throw new FeishuApiError(data.code ?? -1, data.msg || data.error_description || "换取 user_access_token 失败");
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in ?? 0,
    scope: data.scope,
  };
}

/** 飞书 OAuth：用 refresh_token 刷新 user_access_token（refresh_token 可能轮换）。 */
export async function refreshUserAccessToken(refreshToken: string): Promise<TokenBundle> {
  const { appId, appSecret } = getFeishuAppConfig();
  const res = await fetch(`${FEISHU_BASE}/authen/v1/oidc/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: appId,
      client_secret: appSecret,
    }),
  });
  const data = (await res.json()) as FeishuOAuthTokenResponse;
  if (data.code !== 0 || !data.access_token) {
    throw new FeishuApiError(data.code ?? -1, data.msg || data.error_description || "刷新 user_access_token 失败");
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresIn: data.expires_in ?? 0,
    scope: data.scope,
  };
}

/** 构造飞书 OAuth 授权页 URL（authorize handler 调用）。 */
export function buildAuthorizeUrl(state: string): string {
  const { appId, redirectUri } = getFeishuAppConfig();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
    scope: "bitable:app:readonly bitable:app",
  });
  return `${FEISHU_BASE}/authen/v1/authorize?${params.toString()}`;
}

/** 列出某多维表格应用下的所有数据表（app_token 即多维表格 URL 中的 app token）。 */
export async function listTables(
  appToken: string,
  userAccessToken: string,
): Promise<Array<{ tableId: string; name: string }>> {
  const res = await fetch(`${FEISHU_BASE}/bitable/v1/apps/${appToken}/tables`, {
    headers: { Authorization: `Bearer ${userAccessToken}` },
  });
  const data = (await res.json()) as {
    code: number;
    msg: string;
    data?: { items?: Array<{ table_id: string; name: string }> };
  };
  if (data.code !== 0) throw new FeishuApiError(data.code, data.msg || "列出数据表失败");
  return (data.data?.items ?? []).map((t) => ({ tableId: t.table_id, name: t.name }));
}

/** 列出某数据表的字段元数据。 */
export async function listFields(
  appToken: string,
  tableId: string,
  userAccessToken: string,
): Promise<FeishuFieldMeta[]> {
  const res = await fetch(
    `${FEISHU_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
    { headers: { Authorization: `Bearer ${userAccessToken}` } },
  );
  const data = (await res.json()) as FeishuListFieldsResponse;
  if (data.code !== 0) throw new FeishuApiError(data.code, data.msg || "列出字段失败");
  return data.data?.items ?? [];
}

/**
 * 分页拉全量记录（page_size=500 + page_token 游标）。
 * 飞书单次最多返回 500 条，自动翻页直到 has_more=false。
 */
export async function listRecords(
  appToken: string,
  tableId: string,
  userAccessToken: string,
): Promise<FeishuRecord[]> {
  const all: FeishuRecord[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`${FEISHU_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records`);
    url.searchParams.set("page_size", "500");
    if (pageToken) url.searchParams.set("page_token", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${userAccessToken}` },
    });
    const data = (await res.json()) as FeishuListRecordsResponse;
    if (data.code !== 0) throw new FeishuApiError(data.code, data.msg || "拉取记录失败");
    const items = data.data?.items ?? [];
    all.push(...items);
    pageToken = data.data?.has_more ? data.data.page_token : undefined;
  } while (pageToken);
  return all;
}
