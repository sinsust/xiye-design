import { getSessionUser } from "@/lib/auth";
import { BrainHome } from "@/components/brain/brain-home";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function BrainPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // M3：默认进入「今日空间」轻量记忆助手；完整看板为二级入口
  // 不再在服务端整表预取笔记全文：今日空间用 /api/brain/today 轻量聚合；
  // 完整看板首次打开时才由 SecondBrain 拉取，避免只是看一眼首页也背上全量正文传输。
  // Suspense 边界: BrainHome 内部使用 useSearchParams 读取深度链接参数
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">加载中…</div>}>
      <BrainHome />
    </Suspense>
  );
}
