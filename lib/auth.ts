import { cache } from "react";
import { ensureLocalUser, profileEmail, resolveProfileId } from "@/lib/local-scope";

// 会话用户形状保持不变（{sub, email}），上层所有依赖 getSessionUser 的接口零改动。
export interface SessionUser {
  sub: string;
  email: string;
}

/**
 * 解析当前「本地档案」并伪装成会话用户。
 *
 * 形态 C（桌面应用）下不再有登录体系，因此本函数恒返回一个用户（不再为 null）：
 * 打开即可用，未显式切换档案时落在默认档案上。
 *
 * sub 即业务主键 users.id —— 所有业务表按它分区，
 * 所以「切换档案」= 切换一整套数据，而所有既有 handler 无需任何改动。
 *
 * 性能：React.cache 包裹——同一请求/渲染内多次调用只解析一次。
 */
export const getSessionUser = cache(
  async function getSessionUser(): Promise<SessionUser | null> {
    const id = await resolveProfileId();
    // public 模式验签失败（middleware 已先行拦截，双保险）：无身份即无会话
    if (!id) return null;
    await ensureLocalUser(id);
    return { sub: id, email: profileEmail(id) };
  },
);