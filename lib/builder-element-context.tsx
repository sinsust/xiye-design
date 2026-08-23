"use client";

// 给 builder 预览区内的「可点选元素」分配语义化 id，替代 React useId。
// 语义化 id = `${scope}:${componentId}:${variantId}:${slot}`：
//  - 同一组件 + 同一变体下，元素按渲染顺序得到稳定 slot；
//  - 刷新后组件树结构不变 → id 不变 → elementInteractions 持久化能正确匹配，不丢。
// Provider 在每次渲染开头把 slot 计数器归零，保证同组件同变体的槽位始终一致。

import { createContext, useContext, useRef, type ReactNode } from "react";

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
  const counter = useRef(0);
  // 每次渲染归零，确保同组件同变体的槽位序列稳定、可复现
  counter.current = 0;
  const value: BuilderElementCtxValue = {
    scope,
    componentId,
    variantId,
    nextSlot: () => counter.current++,
  };
  return (
    <BuilderElementCtx.Provider value={value}>{children}</BuilderElementCtx.Provider>
  );
}

export function useBuilderElementId(): BuilderElementCtxValue | null {
  return useContext(BuilderElementCtx);
}
