"use client";

// 给 builder 预览区内的「可点选元素」分配语义化 id，替代 React useId。
// 语义化 id = `${scope}:${componentId}:${variantId}:${slot}`：
//  - 同一组件 + 同一变体下，元素按渲染顺序得到稳定 slot；
//  - 刷新后组件树结构不变 → id 不变 → elementInteractions 持久化能正确匹配，不丢。
// 用 useMemo 基于 (scope, componentId, variantId) 生成稳定的槽位计数器工厂，
// 避免 render 期直接 mutation ref（StrictMode 双调用 / Suspense 下会污染计数）。
// 单次渲染内 nextSlot 从 0 递增、跨渲染不保留 —— 与原「每次渲染归零」语义一致。

import { createContext, useContext, useMemo, type ReactNode } from "react";

interface BuilderElementCtxValue {
  scope: string;
  componentId: string;
  variantId: string;
  /** 返回当前槽位序号并自增（同一组件/变体内唯一稳定） */
  nextSlot: () => number;
}

const BuilderElementCtx = createContext<BuilderElementCtxValue | null>(null);

export function BuilderElementProvider({
  scope,
  componentId,
  variantId,
  children,
}: {
  scope: string;
  componentId: string;
  variantId: string;
  children: ReactNode;
}) {
  const value: BuilderElementCtxValue = useMemo(() => {
    let slot = 0;
    return {
      scope,
      componentId,
      variantId,
      nextSlot: () => slot++,
    };
  }, [scope, componentId, variantId]);
  return (
    <BuilderElementCtx.Provider value={value}>{children}</BuilderElementCtx.Provider>
  );
}

export function useBuilderElementId(): BuilderElementCtxValue | null {
  return useContext(BuilderElementCtx);
}
