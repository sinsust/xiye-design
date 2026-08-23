// 探索式产品发现（多轮访谈）的共享类型与纯函数。
// 这一层不引入任何服务端依赖（不 import node:*、不 import ai-intent-server），
// 可被客户端组件与服务端路由共同引用。

// ───────────────────────── 类型 ─────────────────────────

/** 一个可点选的分支方向卡片 */
export interface Branch {
  id: string;
  label: string;
  description: string;
  /** 可选：预期收益 / 周期等补充信息 */
  preview?: string;
}

/** 单条对话消息；assistant 消息可携带 branches 供用户点选继续 */
export interface DiscoverMessage {
  role: "user" | "assistant";
  content: string;
  branches?: Branch[];
}

/** 正在生长的产品 PRD 草稿（brief） */
export interface BriefModule {
  name: string;
  detail: string;
}
export interface BriefPhase {
  name: string;
  items: string[];
}
export interface BriefRole {
  role: string;
  scope: string;
}
export interface ProductBrief {
  vision: string;
  positioning: string;
  targetAudience: string[];
  coreModules: BriefModule[];
  chosenDirections: string[];
  phases: BriefPhase[];
  roles: BriefRole[];
  /** 柔性字段：模型可补充本产品特有的结构化要点（如定价模式 / 渠道分发 / 冷启动策略），不被固定字段框死 */
  extra?: Record<string, string | string[]>;
}

/** 一次 AI 返回的完整响应 */
export interface DiscoverResponse {
  reply: string;
  branches: Branch[];
  brief: ProductBrief;
  done: boolean;
}

/** 服务端多轮发现的请求体 */
export interface DiscoverRequest {
  messages: DiscoverMessage[];
  brief: ProductBrief | null;
}

// ───────────────────────── 空 brief 工厂 ─────────────────────────

export function emptyBrief(): ProductBrief {
  return {
    vision: "",
    positioning: "",
    targetAudience: [],
    coreModules: [],
    chosenDirections: [],
    phases: [],
    roles: [],
    extra: {},
  };
}

// ───────────────────────── 合成：brief → 文本（喂给组合映射） ─────────────────────────

/** 把生长中的 brief 综合成一段结构化文本，供 interpretIntentSmart 产出更精准的组合 */
export function synthesizeBriefToText(brief: ProductBrief): string {
  const lines: string[] = [];
  if (brief.vision) lines.push(`产品愿景：${brief.vision}`);
  if (brief.positioning) lines.push(`定位/差异：${brief.positioning}`);
  if (brief.targetAudience.length)
    lines.push(`目标用户：${brief.targetAudience.join("、")}`);
  if (brief.coreModules.length) {
    lines.push(
      "核心模块：" +
        brief.coreModules.map((m) => `${m.name}（${m.detail}）`).join("；"),
    );
  }
  if (brief.chosenDirections.length)
    lines.push(`已确定方向：${brief.chosenDirections.join("；")}`);
  if (brief.phases.length) {
    lines.push(
      "分期规划：" +
        brief.phases
          .map((p) => `${p.name}（${p.items.join("、")}）`)
          .join("；"),
    );
  }
  if (brief.roles.length) {
    lines.push(
      "角色权限：" +
        brief.roles.map((r) => `${r.role}（${r.scope}）`).join("；"),
    );
  }
  if (brief.extra && typeof brief.extra === "object") {
    for (const [k, v] of Object.entries(brief.extra)) {
      const val = Array.isArray(v) ? v.join("；") : v;
      if (val.trim()) lines.push(`${k}：${val}`);
    }
  }
  return lines.join("\n");
}

/** 把 extra 里的值规范成 string | string[]，过滤无效项 */
export function asExtra(v: unknown): Record<string, string | string[]> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, string | string[]> = {};
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    if (Array.isArray(raw)) {
      const arr = asStringArray(raw);
      if (arr.length) out[k] = arr;
    } else if (typeof raw === "string" && raw.trim()) {
      out[k] = raw.trim();
    }
  }
  return out;
}

// ───────────────────────── 合成：brief → IntentNarrative（回填叙事） ─────────────────────────

import type { IntentNarrative } from "@/lib/ai-intent";

/** 把丰满后的 brief 转成 flow-store 已有的 IntentNarrative，便于 docs/PRD.md 复用 */
export function briefToNarrative(brief: ProductBrief): IntentNarrative {
  return {
    vision: brief.vision || "（待补充）",
    positioning: brief.positioning || "（待补充）",
    targetAudience: brief.targetAudience.length ? brief.targetAudience : [],
    coreFeatures: brief.coreModules.length
      ? brief.coreModules.map((m) => ({ name: m.name, why: m.detail }))
      : [],
    nonGoals: [],
    successMetrics: [],
    marketFit: [
      brief.positioning,
      brief.chosenDirections.length
        ? `已确定方向：${brief.chosenDirections.join("；")}`
        : "",
      brief.phases.length
        ? `分期：${brief.phases.map((p) => p.name).join(" → ")}`
        : "",
    ]
      .filter(Boolean)
      .join("。"),
  };
}

// ───────────────────────── 数组化辅助（供服务端 sanitize 复用） ─────────────────────────

export function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
}
export function asModules(v: unknown): BriefModule[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x: any) => ({
      name: typeof x?.name === "string" ? x.name.trim() : "",
      detail: typeof x?.detail === "string" ? x.detail.trim() : "",
    }))
    .filter((m: BriefModule) => m.name);
}
export function asPhases(v: unknown): BriefPhase[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x: any) => ({
      name: typeof x?.name === "string" ? x.name.trim() : "",
      items: asStringArray(x?.items),
    }))
    .filter((p: BriefPhase) => p.name && p.items.length);
}
export function asRoles(v: unknown): BriefRole[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x: any) => ({
      role: typeof x?.role === "string" ? x.role.trim() : "",
      scope: typeof x?.scope === "string" ? x.scope.trim() : "",
    }))
    .filter((r: BriefRole) => r.role);
}
