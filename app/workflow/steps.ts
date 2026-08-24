// 流程工作台 v2 · 4 阶段流程定义（纯数据，不依赖 store）
//
// 红线说明：useFlowStore.currentStep 仍是 1..4（老 /flow 短流程），不可改。
// 新 4 阶段流程的导航完全由本文件的 STEP_DEFS + 前端本地 state 管理，
// store 仅作为各阶段的数据层被读写，字段零新增零重命名。
//
// 与峰哥对齐（2026-08-24）：需求理解 + 方案生成 合并为「AI 协同工作台」单阶段，
// 入口是首页一句话，进入后多 Agent 持续并行干活与产出，不再人为切成两步。

export type StepId =
  | "collab" // AI 协同工作台（需求理解 + 方案生成合一）
  | "refine" // 方案完善
  | "build" // 页面搭建
  | "deliver"; // 交付落地

/** 布局模式：三栏等权 / 左对话+右上下双卡（协同工作台） */
export type StepLayout = "3col" | "collab";

export interface StepDef {
  id: StepId;
  id_label?: never;
  /** 阶段条完整标题 */
  label: string;
  /** 阶段条紧凑标题（窄屏用） */
  short: string;
  /** 一句话说明本阶段在做什么 */
  desc: string;
  /** 布局模式 */
  layout: StepLayout;
  /** 三栏母版默认列宽（仅 layout=3col 用），与线框文档一致 */
  cols: string;
  /** 三栏各自的职责提示（collab 模式下 left/right 含义见各页面组件） */
  panels: {
    left: string;
    center: string;
    right: string;
  };
}

export const STEP_DEFS: StepDef[] = [
  {
    id: "collab",
    label: "产品创意",
    short: "创意",
    desc: "一句话描述想法，多 Agent 并行干活：PRD/UX·UI/架构/审校实时产出，文档自动生长。",
    layout: "collab",
    cols: "minmax(0,1.2fr) 420px",
    panels: {
      left: "主对话线程：你与协调员来回沟通，背后多 Agent 并行处理",
      center: "专家协作面板：四专家并行工作状态与产出摘要",
      right: "实时文档生成区：产品定义 / 页面结构 / 技术方案 / 风险",
    },
  },
  {
    id: "refine",
    label: "方案落地",
    short: "落地",
    desc: "集中确认技术栈、部署、依赖、风险与待补项。",
    layout: "3col",
    cols: "340px minmax(0,1fr) 320px",
    panels: {
      left: "配置决策卡片区：技术栈 / 部署 / 数据库 / 鉴权 / 集成…",
      center: "技术方案摘要：前端 / 后端 / 数据层 / AI 能力 / 监控",
      right: "风险与审校 + 生成前检查清单",
    },
  },
  {
    id: "build",
    label: "页面搭建",
    short: "搭建",
    desc: "基于 AI 回填的页面蓝图做结构化搭建，而非从零拖画布。",
    layout: "3col",
    cols: "280px minmax(0,1fr) 320px",
    panels: {
      left: "页面蓝图导航（Accordion + Tree）：首页 / 选品页 / 报告页…",
      center: "当前页面结构预览区：高保真骨架卡片",
      right: "选中区块属性 + AI 建议（UX/UI / 审校 / PRD 约束）",
    },
  },
  {
    id: "deliver",
    label: "交付逻辑",
    short: "交付",
    desc: "系统将方案转为可交付物，并行生成、状态可见、可预览下载。",
    layout: "3col",
    cols: "300px minmax(0,1fr) 360px",
    panels: {
      left: "生成进度与产物列表：PRD / 页面说明书 / 技术架构 / 代码包…",
      center: "实时执行日志 / 执行轨迹（时间线）",
      right: "最终交付预览：摘要 + PRD / 代码结构 / 部署建议 Tabs",
    },
  },
];

export const STEP_INDEX: Record<StepId, number> = STEP_DEFS.reduce(
  (acc, s, i) => {
    acc[s.id] = i;
    return acc;
  },
  {} as Record<StepId, number>,
);
