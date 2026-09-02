"use client";

// 全局「角色人设」store：在默认角色（AGENT_PROFILES)基础上，允许用户自定义每位专家的名字与头像，
// 并支持按「风格」整体切换（后宫 / 帝王 / 霸总 / 江湖 / 修仙 / 校园 / 赛博）。
// 选风格 = 套用该风格 5 位专家的默认名 + 默认头像，并切换会诊 prompt 主题（由 styleId 派生）。
//
// 持久化策略：
// - 始终写一份到 localStorage，未登录用户也能自定义（本机生效）；
// - 已登录用户在管理中把变更同步到服务端（/api/agents），并以服务端为权威被拉取合并。
// 读取一律走 useAgent / useAgentList，默认值 = AGENT_PROFILES + DEFAULT_AVATARS。

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  AGENT_PROFILES,
  AGENT_MAP,
  DEFAULT_AVATARS,
  type AgentId,
  type AgentProfile,
} from "./agents";
import {
  AGENT_ROLES,
  AGENT_STYLES,
  DEFAULT_STYLE,
  getStyle,
  styleAvatarPath,
  type AgentStyleId,
} from "@/lib/agent-styles";

/** 用户对单个专家的个性化覆盖 */
export interface AgentOverride {
  /** 自定义名字（空串视为未自定义） */
  name?: string;
  /** 自定义头像图地址（null 或空串视为用默认） */
  avatarUrl?: string | null;
}

/** 覆盖后的完整可展示专家 */
export interface ResolvedAgent extends AgentProfile {
  avatarUrl: string | null;
}

interface AgentsState {
  /** 是否已触发过一次 boot（避免重复拉取） */
  booted: boolean;
  overrides: Partial<Record<AgentId, AgentOverride>>;
  /** 当前选中的风格（驱动 prompt 主题 / UI 文案） */
  currentStyleId: AgentStyleId;
  boot: () => void;
  hydrate: (rows: { role: AgentId; name: string; avatarUrl: string | null; styleId?: string | null }[]) => void;
  setOverride: (role: AgentId, patch: AgentOverride) => void;
  /** 套用整套风格预设（覆盖 5 位人设名 + 头像）并切换当前风格 */
  setStyle: (styleId: AgentStyleId) => void;
  resetAll: () => void;
}

export const useAgentsStore = create<AgentsState>()(
  persist(
    (set, get) => ({
      booted: false,
      overrides: {},
      currentStyleId: DEFAULT_STYLE,
      boot: () => {
        if (get().booted) return;
        set({ booted: true });
        // 未登录也能用本地覆盖；登录后再用服务端权威覆盖一次
        void fetch("/api/agents")
          .then((r) => (r.ok ? r.json() : { agents: [] }))
          .then((d) => {
            if (Array.isArray(d.agents) && d.agents.length) {
              get().hydrate(d.agents);
            }
          })
          .catch(() => {});
      },
      hydrate: (rows) => {
        const overrides: Partial<Record<AgentId, AgentOverride>> = { ...get().overrides };
        let styleId: AgentStyleId | undefined;
        for (const row of rows) {
          const patch: AgentOverride = {};
          if (row.name) patch.name = row.name;
          patch.avatarUrl = row.avatarUrl || null;
          overrides[row.role] = { ...overrides[row.role], ...patch };
          if (row.styleId && AGENT_STYLES[row.styleId as AgentStyleId]) {
            styleId = row.styleId as AgentStyleId;
          }
        }
        set({ overrides, ...(styleId ? { currentStyleId: styleId } : {}) });
      },
      setOverride: (role, patch) =>
        set((s) => ({
          overrides: { ...s.overrides, [role]: { ...s.overrides[role], ...patch } },
        })),
      setStyle: (styleId) => {
        const style = AGENT_STYLES[styleId];
        const overrides: Partial<Record<AgentId, AgentOverride>> = { ...get().overrides };
        for (const role of AGENT_ROLES) {
          overrides[role] = {
            name: style.agents[role].name,
            avatarUrl: styleAvatarPath(styleId, role),
          };
        }
        set({ overrides, currentStyleId: styleId });
      },
      resetAll: () => set({ overrides: {}, currentStyleId: DEFAULT_STYLE }),
    }),
    {
      name: "xiye_agents_personas",
      partialize: (s) => ({ overrides: s.overrides, currentStyleId: s.currentStyleId }) as AgentsState,
      // 版本号 + 迁移：persist 此前无 version/migrate，schema 一旦变更，老数据会原样灌入新结构。
      // v1 迁移做一次防御性清洗：非法/已下线的 styleId 回落默认，overrides 非对象则重置。
      version: 1,
      migrate: (persisted, from) => {
        const raw = (persisted ?? {}) as Partial<AgentsState>;
        if (from >= 1) return raw as AgentsState;
        const overrides =
          raw.overrides && typeof raw.overrides === "object" && !Array.isArray(raw.overrides)
            ? raw.overrides
            : {};
        const styleId =
          typeof raw.currentStyleId === "string" &&
          AGENT_STYLES[raw.currentStyleId as AgentStyleId]
            ? raw.currentStyleId
            : DEFAULT_STYLE;
        return { overrides, currentStyleId: styleId } as AgentsState;
      },
    },
  ),
);

/** 读单个专家的自定义名（无则 undefined） */
export function getAgentName(role: AgentId): string | undefined {
  return useAgentsStore.getState().overrides[role]?.name || undefined;
}

/** 读当前风格 id */
export function getStyleId(): AgentStyleId {
  return useAgentsStore.getState().currentStyleId;
}

/** 响应式读当前风格对象 */
export function useCurrentStyle() {
  const id = useAgentsStore((s) => s.currentStyleId);
  return getStyle(id);
}

function resolve(role: AgentId): ResolvedAgent {
  const base = AGENT_MAP[role];
  const ov = useAgentsStore.getState().overrides[role];
  const styleId = useAgentsStore.getState().currentStyleId;
  const styleFallback =
    styleId === "harem"
      ? DEFAULT_AVATARS[role]
      : styleAvatarPath(styleId, role);
  return {
    ...base,
    name: ov?.name || base.name,
    avatarUrl: ov?.avatarUrl || styleFallback || null,
  };
}

/** 响应式订阅单个专家 */
export function useAgent(role: AgentId): ResolvedAgent {
  // 触发订阅：任意 override / 风格 / booted 变化都会重渲染
  void useAgentsStore((s) => s.overrides[role]);
  void useAgentsStore((s) => s.booted);
  void useAgentsStore((s) => s.currentStyleId);
  return resolve(role);
}

/** 响应式订阅全部专家（保持默认顺序） */
export function useAgentList(): ResolvedAgent[] {
  void useAgentsStore((s) => s.overrides);
  void useAgentsStore((s) => s.booted);
  void useAgentsStore((s) => s.currentStyleId);
  return AGENT_PROFILES.map((a) => resolve(a.id));
}

/** 可供 API/提示词传递的名字覆盖负载（仅含已自定义名字的角色） */
export function personaPayload(): { role: AgentId; name: string }[] {
  const overrides = useAgentsStore.getState().overrides;
  return (Object.keys(overrides) as AgentId[])
    .filter((r) => overrides[r]?.name?.trim())
    .map((r) => ({ role: r, name: overrides[r]!.name!.trim() }));
}
