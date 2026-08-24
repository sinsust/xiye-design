"use client";

// 共享的「保存草稿 / 保存项目」逻辑，供 FlowLeaveGuard 与 FlowFooter 复用。
import { useFlowStore } from "@/lib/store/flow-store";

/**
 * 把当前 flow 状态存为「我的项目」里的一个草稿/项目。
 *
 * - 未登录：返回 { ok:false, reason:"login" }，由调用方决定（提示登录或放弃）。
 * - 已登录：有 savedProjectId 则 PUT 更新，否则 POST 新建并回填 id。
 *
 * @param opts.name 优先传入的名称；缺省用 projectInfo.projectName 或「未命名项目」。
 */
export async function saveFlowDraft(opts?: {
  name?: string;
}): Promise<{ ok: true; id: string } | { ok: false; reason: "login" | "failed" }> {
  const me = await fetch("/api/auth/me");
  if (!me.ok) return { ok: false, reason: "login" };

  const st = useFlowStore.getState();
  const snap = st.captureFlowSnapshot();
  const name =
    opts?.name?.trim() ||
    st.projectInfo?.projectName?.trim() ||
    "未命名项目";
  const existing = st.savedProjectId;

  try {
    const res = existing
      ? await fetch(`/api/projects/${existing}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, data: snap }),
        })
      : await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, data: snap }),
        });
    if (!res.ok) return { ok: false, reason: "failed" };
    const j = await res.json();
    const id = String(j?.project?.id ?? existing ?? "");
    if (!existing && id) st.setSavedProjectId(id);
    return { ok: true, id };
  } catch {
    return { ok: false, reason: "failed" };
  }
}