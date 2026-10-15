import { Suspense } from "react";
import { isPublicDeploy } from "@/lib/deploy-mode";
import { EnterForm } from "@/components/enter-form";
import { EnterLocalRedirect } from "@/components/enter-local-redirect";

/**
 * /enter —— 邀请码门户（public 部署模式专用，server component）。
 *
 * 静态化（Hobby 函数数削减 §5.1.3 措施 E）：本页不再使用 redirect()/notFound()，
 * 这些会把它锁成动态渲染（占 1 个 Vercel Function）。isPublicDeploy() 在构建期由
 * NEXT_PUBLIC_DEPLOY_MODE 内联，因此分支在构建期即确定：
 *   - public 构建：渲染表单（middleware 总闸已放行 /enter）；
 *   - local 构建：渲染 EnterLocalRedirect，客户端跳回首页。
 */
export default function EnterPage() {
  if (!isPublicDeploy()) {
    return <EnterLocalRedirect />;
  }
  return (
    <Suspense fallback={null}>
      <EnterForm />
    </Suspense>
  );
}
