import { getSessionUser } from "@/lib/auth";
import { listBrainNotes } from "@/lib/brain-db";
import { BrainHome } from "@/components/brain/brain-home";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BrainPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const notes = await listBrainNotes(user.sub);
  // M3：默认进入「今日空间」轻量记忆助手；完整看板为二级入口
  return <BrainHome initialNotes={notes} />;
}