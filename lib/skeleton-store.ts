"use client";

// 骨架工作台 · 选择持久化 store。
// picks：每个页面 × 每个组件 → 选中的变体 id（选择即存，刷新不丢）。
// schemes：可命名的完整方案（多套切换）。

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ContentOverride } from "@/lib/content-resolver";

export interface SkeletonScheme {
  id: string;
  name: string;
  picks: Record<string, Record<string, string>>; // pageId -> componentId -> variantId
  savedAt: string;
}

/** 按板块的动效覆盖：只作用于当前板块的预览（可单独微调），不影响其他组件 */
export interface ComponentMotion {
  motionId: string;
  /** 微调参数：distance=位移幅度(px)，duration=时长(s) */
  params?: { distance?: number; duration?: number };
}

interface SkeletonState {
  picks: Record<string, Record<string, string>>;
  schemes: SkeletonScheme[];
  activeSchemeId: string | null;
  /** 项目文案（真实内容覆盖 demo，用于一次替换） */
  content: ContentOverride;
  /** 元素级交互挂载：elementId -> interaction id 列表（可叠加） */
  elementInteractions: Record<string, string[]>;
  /** 按板块动效覆盖：key = `${pageId}:${componentId}`，只改当前板块，不影响其他 */
  componentMotion: Record<string, ComponentMotion>;
  /** 就地换件：key = `${pageId}:${componentId}` → 换成的内置 Uiverse 精选件 id（null 清除） */
  componentOverride: Record<string, string>;
  /** 主 CTA 按钮风格覆盖：key = `${pageId}:${componentId}` → 按钮样式 id（null 跟随默认实心） */
  buttonStyles: Record<string, string>;
  pickVariant: (pageId: string, componentId: string, variantId: string) => void;
  saveScheme: (name: string) => void;
  loadScheme: (id: string) => void;
  deleteScheme: (id: string) => void;
  setContent: (patch: ContentOverride) => void;
  setComponentMotion: (key: string, cfg: ComponentMotion | null) => void;
  setComponentOverride: (key: string, kitId: string | null) => void;
  setComponentButtonStyle: (key: string, styleId: string | null) => void;
}

export const useSkeletonStore = create<SkeletonState>()(
  persist(
    (set, get) => ({
      picks: {},
      schemes: [],
      activeSchemeId: null,
      content: {},
      elementInteractions: {},
      componentMotion: {},
      componentOverride: {},
      buttonStyles: {},

      pickVariant: (pageId, componentId, variantId) =>
        set((s) => ({
          picks: {
            ...s.picks,
            [pageId]: {
              ...(s.picks[pageId] ?? {}),
              [componentId]: variantId,
            },
          },
        })),

      saveScheme: (name) => {
        const picks = get().picks;
        const scheme: SkeletonScheme = {
          id: `scheme-${Date.now()}`,
          name: name.trim() || `方案 ${get().schemes.length + 1}`,
          picks,
          savedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
        };
        set((s) => ({ schemes: [...s.schemes, scheme], activeSchemeId: scheme.id }));
      },

      loadScheme: (id) => {
        const scheme = get().schemes.find((sc) => sc.id === id);
        if (!scheme) return;
        set({ picks: scheme.picks, activeSchemeId: id });
      },

      deleteScheme: (id) =>
        set((s) => ({
          schemes: s.schemes.filter((sc) => sc.id !== id),
          activeSchemeId: s.activeSchemeId === id ? null : s.activeSchemeId,
        })),

      setContent: (patch) => set((s) => ({ content: { ...s.content, ...patch } })),

      setComponentMotion: (key, cfg) =>
        set((s) => {
          const next = { ...s.componentMotion };
          if (cfg) next[key] = cfg;
          else delete next[key];
          return { componentMotion: next };
        }),

      setComponentOverride: (key, kitId) =>
        set((s) => {
          const next = { ...s.componentOverride };
          if (kitId) next[key] = kitId;
          else delete next[key];
          return { componentOverride: next };
        }),

      setComponentButtonStyle: (key, styleId) =>
        set((s) => {
          const next = { ...s.buttonStyles };
          if (styleId) next[key] = styleId;
          else delete next[key];
          return { buttonStyles: next };
        }),
    }),
    {
      name: "xiye.skeleton-picks",
      // 不持久化瞬态选中态；其余编辑态偏好与交互挂载落盘
      partialize: (s) => ({
        picks: s.picks,
        schemes: s.schemes,
        content: s.content,
        elementInteractions: s.elementInteractions,
        componentMotion: s.componentMotion,
        componentOverride: s.componentOverride,
        buttonStyles: s.buttonStyles,
      }),
      // 版本号 + 迁移：此前 persist 无 version/migrate，schema 变更后老数据会原样灌入新结构。
      // v1 迁移做一次防御性清洗：所有 map 字段非对象即回落空对象，schemes 非数组即重置，
      // 避免脏数据导致渲染期读取 undefined 而白屏。
      version: 1,
      migrate: (persisted, from) => {
        const raw = (persisted ?? {}) as Partial<SkeletonState>;
        if (from >= 1) return raw as SkeletonState;
        const asMap = (v: unknown) =>
          v && typeof v === "object" && !Array.isArray(v) ? v : {};
        return {
          picks: asMap(raw.picks),
          schemes: Array.isArray(raw.schemes) ? raw.schemes : [],
          content: asMap(raw.content),
          elementInteractions: asMap(raw.elementInteractions),
          componentMotion: asMap(raw.componentMotion),
          componentOverride: asMap(raw.componentOverride),
          buttonStyles: asMap(raw.buttonStyles),
        } as SkeletonState;
      },
    },
  ),
);
