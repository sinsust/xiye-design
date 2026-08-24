import {
  Sparkles,
  ClipboardList,
  Network,
  Palette,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

/**
 * 多 Agent 角色定义（v2 工作台共享常量）
 *
 * Phase 1：仅用于左栏展示与身份标识
 * Phase 2：作为 /api/ai/panel 的角色编排依据（每个角色独立 system prompt + 输出 schema）
 */
export type AgentId = "moderator" | "pm" | "architect" | "designer" | "guard";

export interface AgentProfile {
  id: AgentId;
  name: string;
  /** 专业领域（左栏副标题） */
  specialty: string;
  /** 一句话职责（对话流中专家卡片头部） */
  mandate: string;
  /** 负责回写的 flow-store 字段域（档案面板联动提示用） */
  owns: string;
  icon: LucideIcon;
}

export const AGENT_PROFILES: AgentProfile[] = [
  {
    id: "moderator",
    name: "老鸨子-丽颖",
    specialty: "对话主控 · 调度会诊",
    mandate: "拆解你的想法、追问细节、判断何时召集专家",
    owns: "对话与 PRD 草稿",
    icon: Sparkles,
  },
  {
    id: "pm",
    name: "产品专家-亦菲",
    specialty: "PRD · 页面清单",
    mandate: "把想法结构化成定位、用户、核心功能与页面清单",
    owns: "产品叙事 / 页面蓝图",
    icon: ClipboardList,
  },
  {
    id: "architect",
    name: "架构专家-热巴",
    specialty: "技术栈 · 好处与风险",
    mandate: "给出前后端选型方案对比，每项附好处、风险与替代",
    owns: "技术栈 / AI 能力",
    icon: Network,
  },
  {
    id: "designer",
    name: "视觉专家-冰冰",
    specialty: "视觉风格 · 组件基调",
    mandate: "推荐视觉风格与组件基调，并说明设计理由",
    owns: "视觉风格 / 设计系统",
    icon: Palette,
  },
  {
    id: "guard",
    name: "开发规范-苍老师",
    specialty: "AI 编程边界 · 反漂移",
    mandate: "定义生成不漂移的边界：设计 token 唯一真值、代码验收规则、反 AI 味约束",
    owns: "开发规范 / 验收规则",
    icon: ShieldCheck,
  },
];

export const AGENT_MAP: Record<AgentId, AgentProfile> = Object.fromEntries(
  AGENT_PROFILES.map((a) => [a.id, a]),
) as Record<AgentId, AgentProfile>;

/** 专家默认头像图（真实照片，缺失则 UI 回退图标）；用户可在人设管理页覆盖 */
export const DEFAULT_AVATARS: Record<AgentId, string | null> = {
  moderator: "/flow-v2/avatars/review.webp",
  pm: "/flow-v2/avatars/prd.png",
  architect: "/flow-v2/avatars/arch.jpg",
  designer: "/flow-v2/avatars/uxui.jpg",
  guard: "/flow-v2/avatars/avatars.png",
};
