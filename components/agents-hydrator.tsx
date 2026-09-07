"use client";

// 全局 agents store 水合：persist 已设 skipHydration（避免 SSR 首帧与客户端 localStorage 不一致
// 导致头像 src 等派生属性 hydration mismatch），此处仅负责客户端挂载后手动 rehydrate()，
// 读回本机人设覆盖与风格选择；服务端/客户端首帧统一走 DEFAULT_STYLE，挂载后再切持久化风格。
import { useEffect } from "react";
import { useAgentsStore } from "@/app/workflow/agents-store";

export function AgentsHydrator() {
  useEffect(() => {
    void useAgentsStore.persist.rehydrate();
  }, []);
  return null;
}
