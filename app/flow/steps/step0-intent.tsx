"use client";

import { useSearchParams } from "next/navigation";
import { IntentExplorer } from "@/components/intent-explorer";

// 流程工作的第一步：AI 多轮探索式访谈。
// 用户说一个初始想法 → AI 分析并给出围绕想法的多个分支方向让用户选择，
// 多轮深化后把产品 PRD 做丰满 → 实时同步到 flow-store，底部「下一步」进入骨架搭建。
export function Step0Intent() {
  const searchParams = useSearchParams();
  const intentFromUrl = searchParams.get("intent") ?? "";

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-1 flex-col gap-5">
      <div className="shrink-0 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          和 AI 一起把想法做丰满
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          先说一个初始想法，AI 会分析意图、给出多个方向让你选，再一轮轮把产品 PRD 聊清楚——而不是千篇一律的模板。
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <IntentExplorer defaultValue={intentFromUrl} className="h-full" />
      </div>
    </div>
  );
}
