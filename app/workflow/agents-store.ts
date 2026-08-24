"use client";

// 全局「后宫智囊团」人设 store：在默认角色（AGENT_PROFILES)基础上，允许用户
// 自定义每位专家的名字与头像，全流程（左栏 / 会诊条 / 详情卡 / 微调/交付）实时生效。
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
  boot: () => void;
  hydrate: (rows: { role: AgentId; name: string; avatarUrl: string | null }[]) => void;
  setOverride: (role: AgentId, patch: AgentOverride) => void;
  resetAll: () => void;
}

export const useAgentsStore = create<AgentsState>()(
  persist(
    (set, get) => ({
      booted: false,
      overrides: {},
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
        for (const row of rows) {
          const patch: AgentOverride = {};
          if (row.name) patch.name = row.name;
          patch.avatarUrl = row.avatarUrl || null;
          overrides[row.role] = { ...overrides[row.role], ...patch };
        }
        set({ overrides });
      },
      setOverride: (role, patch) =>
        set((s) => ({
          overrides: { ...s.overrides, [role]: { ...s.overrides[role], ...patch } },
        })),
      resetAll: () => set({ overrides: {} }),
    }),
    {
      name: "xiye_agents_personas",
      partialize: (s) => ({ overrides: s.overrides }) as AgentsState,
    },
  ),
);

/** 读单个专家的自定义名（无则 undefined） */
export function getAgentName(role: AgentId): string | undefined {
  return useAgentsStore.getState().overrides[role]?.name || undefined;
}

function resolve(role: AgentId): ResolvedAgent {
  const base = AGENT_MAP[role];
  const ov = useAgentsStore.getState().overrides[role];
  return {
    ...base,
    name: ov?.name || base.name,
    avatarUrl: ov?.avatarUrl || DEFAULT_AVATARS[role] || null,
  };
}

/** 响应式订阅单个专家 */
export function useAgent(role: AgentId): ResolvedAgent {
  // 触发订阅：任意 override 或 booted 变化都会重渲染
  void useAgentsStore((s) => s.overrides[role]);
  void useAgentsStore((s) => s.booted);
  return resolve(role);
}

/** 响应式订阅全部专家（保持默认顺序） */
export function useAgentList(): ResolvedAgent[] {
  void useAgentsStore((s) => s.overrides);
  void useAgentsStore((s) => s.booted);
  return AGENT_PROFILES.map((a) => resolve(a.id));
}

/** 可供 API/提示词传递的名字覆盖负载（仅含已自定义名字的角色） */
export function personaPayload(): { role: AgentId; name: string }[] {
  const overrides = useAgentsStore.getState().overrides;
  return (Object.keys(overrides) as AgentId[])
    .filter((r) => overrides[r]?.name?.trim())
    .map((r) => ({ role: r, name: overrides[r]!.name!.trim() }));
}