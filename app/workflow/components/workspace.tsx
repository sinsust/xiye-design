"use client";

import type { ReactNode } from "react";

interface WorkspaceProps {
  /** 三栏列宽模板，默认 280px 1fr 320px，可由各步覆盖 */
  cols?: string;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}

/**
 * 三栏母版：左导航 / 中主工作区 / 右建议与检查。
 * 每步只需填入三块内容，框架负责步骤条、底部栏、响应式。
 */
export function Workspace({ cols = "280px minmax(0,1fr) 320px", left, center, right }: WorkspaceProps) {
  return (
    <div
      className="grid min-h-0 flex-1 gap-4 max-[1279px]:grid-cols-1 min-[1280px]:grid-cols-[var(--flow-cols)]"
      style={{ ["--flow-cols" as string]: cols }}
    >
      <aside className="min-h-0 overflow-hidden max-[1279px]:max-h-72 min-[1280px]:h-full">{left}</aside>
      <main className="min-h-0 min-w-0 overflow-hidden">{center}</main>
      <aside className="min-h-0 overflow-hidden max-[1279px]:max-h-96 min-[1280px]:h-full">{right}</aside>
    </div>
  );
}
