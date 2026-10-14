import { Suspense } from "react";
import { redirect } from "next/navigation";
import { isPublicDeploy } from "@/lib/deploy-mode";
import { EnterForm } from "@/components/enter-form";

/**
 * /enter —— 邀请码门户（public 部署模式专用，server component）。
 *
 * local / 桌面模式（DEPLOY_MODE != public）下本页【不适用】：
 *   middleware 在 local 模式直接放行（不做任何拦截），门户只会对单机用户造成困惑
 *   （输入邀请码后 POST /api/enter 返回 404 not_public）。
 *   因此这里 redirect 到首页（不用 notFound()：App Router 流式 SSR 下响应头已发出，
 *   notFound() 只能替换内容、改不了状态码，实测仍是 200，语义不清）。
 */
export default function EnterPage() {
  if (!isPublicDeploy()) redirect("/");
  return (
    <Suspense fallback={null}>
      <EnterForm />
    </Suspense>
  );
}
