import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { type VariantDimension } from "@/data/component-variants";
import type { IntentNarrative } from "@/lib/ai-intent";
import type { DiscoverMessage, ProductBrief } from "@/lib/ai-discover";

// 流程工作台的全局状态。
// 各 Step 需要的字段按步骤逐步扩展，未实现步骤的字段先用注释占位。

// —— Step 4 类B：设计 Token（圆角/字体/密度/阴影/滚动/暗色模式）——
// 注：配色已并入「类A 视觉风格」(visualStyle)，此处不再单独存 colorScheme。
export interface DesignSystem {
  radius: string | null; // 选中的圆角 ID
  font: string | null; // 选中的字体 ID
  type: string | null; // 选中的字号层级 ID
  density: string | null; // 选中的间距密度 ID
  shadow: string | null; // 选中的阴影层级 ID
  scroll: string | null; // 选中的滚动行为 ID
  darkMode: string | null; // 选中的暗色模式 ID
  colorPrimary: string | null; // 自定义主色 hex，覆盖风格 accent
  colorSecondary: string | null; // 自定义辅色 hex，覆盖风格 accent2
}

// —— Step 4 类B：组件与交互（卡片/按钮/导航栏/表单/交互动效 5 维度）——
export interface ComponentVariants {
  card: string | null;
  button: string | null;
  navbar: string | null;
  form: string | null;
  interaction: string | null; // 交互动效预设 ID
}

// —— Step 8：项目信息（名称/描述/仓库/部署/域名，全部可选填）——
export interface ProjectInfo {
  projectName: string | null; // 项目名称（必填项仅前端提示，数据层允许 null）
  projectDescription: string | null; // 项目描述
  gitRepoUrl: string | null; // Git 仓库地址
}

// —— 页面蓝图：builder 逐个收集的「骨架 + 变体」条目，flow 生成时并入 ——
export interface BlueprintEntry {
  pageSlug: string; // 目标页面，如 "landing" / "dashboard"
  componentId: string; // 骨架组件 id
  variantId: string | null; // 选中的变体 id
}

// —— Step 1 探索式访谈会话缓存：避免每次进入页面都重新生成 ——
export interface IntentSession {
  messages: DiscoverMessage[];
  brief: ProductBrief | null;
  done: boolean;
  updatedAt: number;
}

// —— 多 Agent 会诊结果：collab 协同阶段产出，贯通到 refine 方案完善阶段复用 ——
export type PanelOutput = Record<string, AgentOutput>;

export interface AgentOutput {
  status: AgentStatus;
  progress: number;
  summary: string;
  details: string[];
}

export type AgentStatus = "standby" | "thinking" | "producing" | "done";

// —— 交付产物：deliver 阶段生成后落 store，避免离开/刷新丢失需重生成 ——
export type ArtifactStatus = "idle" | "generating" | "done" | "skip";

export interface DeliverArtifact {
  status: ArtifactStatus;
  progress: number;
  content: string;
}

export interface DeliverArtifacts {
  prd: DeliverArtifact;
  blueprint: DeliverArtifact;
  architecture: DeliverArtifact;
  deploy: DeliverArtifact;
}

export interface FlowState {
  currentStep: number; // 当前步骤，1..4

  // —— Step 1：项目类型 ——
  projectType: string | null;

  // —— Step 2：AI 能力（多选）——
  aiCapabilities: string[]; // 已选 AI 能力 ID 数组

  // —— Step 3：技术栈方案 ——
  techStack: string | null; // 选中的技术栈方案 ID

  // —— Step 4：设计体系 ——
  designSystem: DesignSystem | null;

  // —— Step 5：UI 组件库（主库 + 可选增强库）——
  uiLibrary: {
    main: string | null; // 主库 ID（必选 1 个）
    addon: string | null; // 增强库 ID（可选 0-1 个）
  } | null;

  // —— Step 6：组件变体 ——
  componentVariants: ComponentVariants | null;

  // —— Step 8：项目信息 ——
  projectInfo: ProjectInfo | null;

  // —— Step 9：API Key（key-value 扁平结构，如 { "OPENAI_API_KEY": "sk-..." }）——
  apiKeys: Record<string, string>;

  // —— Step 4 类A：视觉风格（从视觉类 skill 抽出的具象风格，单选 ID）——
  visualStyle: string | null;

  // —— Step 4 类C：动效（按场景各自选一个变体，场景id → 变体id）——
  motionSelections: Record<string, string>;

  // —— Step 11+ 字段占位（待实现）——
  // ...

  // —— 页面蓝图（builder 逐个收集 → flow 生成时并入）——
  pageBlueprint: BlueprintEntry[];

  // —— 骨架回程锚点：记录进入骨架时的流程步骤，「返回流程」据此回跳—— 
  builderReturnStep: number;

  // —— AI 一句话产出的产品叙事（vision / 目标用户 / 功能 / 市场契合），供 docs/PRD.md
  // —— 与生成端复用；仅会话内有效，重新生成 AI 一句话后覆盖。
  intentNarrative: IntentNarrative | null;

  // —— 探索式访谈生长出的完整 PRD 草稿（brief），供 docs/PRD.md 富化复用 ——
  productBrief: ProductBrief | null;

  // —— Step 1 探索式访谈缓存：消息 / brief / 完成状态 ——
  intentSession: IntentSession | null;

  // —— 多 Agent 会诊结果（collab → refine 贯通）——
  panelOutput: PanelOutput | null;

  // —— 交付产物缓存（deliver 阶段，跨离开/刷新保留）——
  deliverArtifacts: DeliverArtifacts | null;

  setProjectType: (type: string) => void;
  toggleAiCapability: (id: string) => void;
  setTechStack: (id: string) => void;
  setDesignSystem: (partial: Partial<DesignSystem>) => void;
  setUiLibrary: (selection: { main?: string | null; addon?: string | null }) => void;
  setComponentVariant: (dimension: VariantDimension, variantId: string) => void;
  setProjectInfo: (partial: Partial<ProjectInfo>) => void;
  setApiKey: (key: string, value: string) => void;
  setVisualStyle: (id: string | null) => void;
  setMotion: (scenarioId: string, variantId: string) => void;
  addBlueprintComponent: (entry: { pageSlug: string; componentId: string; variantId?: string | null }) => void;
  updateBlueprintVariant: (pageSlug: string, componentId: string, variantId: string) => void;
  removeBlueprintComponent: (pageSlug: string, componentId: string) => void;
  clearBlueprint: () => void;
  setBuilderReturnStep: (step: number) => void;
  setIntentNarrative: (n: IntentNarrative | null) => void;
  setProductBrief: (b: ProductBrief | null) => void;
  setIntentSession: (s: IntentSession | null) => void;
  clearIntentSession: () => void;
  setPanelOutput: (o: PanelOutput | null) => void;
  setDeliverArtifacts: (a: DeliverArtifacts | null) => void;
  savedProjectId: string | null;
  setSavedProjectId: (id: string | null) => void;
  captureFlowSnapshot: () => Record<string, unknown>;
  generateConfig: () => string;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  /** 整体重置：清空全部历史项目字段并回到指定步骤（默认第 1 步）。用于「新开一个项目」「首页输入新想法」。 */
  resetAll: (toStep?: number) => void;
}

// 短流程共 4 步：AI 意图 / 骨架搭建 / 收尾配置 / 生成项目。
// 视觉风格、设计 Token、组件蓝图交由骨架工作台(builder)接管，此处只保留收尾信息。
const TOTAL_STEPS = 4;
const clampStep = (step: number) =>
  Math.max(1, Math.min(step, TOTAL_STEPS));

export const useFlowStore = create<FlowState>()(
  persist(
    (set, get) => ({
  currentStep: 1,
  projectType: null,
  aiCapabilities: [],
  techStack: null,
  designSystem: null,
  uiLibrary: null,
  componentVariants: null,
  projectInfo: null,
  apiKeys: {},
  visualStyle: null,
  motionSelections: {},
  pageBlueprint: [],
  builderReturnStep: 2,
  intentNarrative: null,
  productBrief: null,
  intentSession: null,
  panelOutput: null,
  deliverArtifacts: null,
  savedProjectId: null,

  setProjectType: (type) => set({ projectType: type }),
  toggleAiCapability: (id) =>
    set((s) => ({
      aiCapabilities: s.aiCapabilities.includes(id)
        ? s.aiCapabilities.filter((x) => x !== id)
        : [...s.aiCapabilities, id],
    })),
  setTechStack: (id) => set({ techStack: id }),
  setDesignSystem: (partial) =>
    set((s) => ({
      designSystem: {
        ...(s.designSystem ?? {
          radius: null,
          font: null,
          type: null,
          density: null,
          shadow: null,
          scroll: null,
          darkMode: null,
          colorPrimary: null,
          colorSecondary: null,
        }),
        ...partial,
      },
    })),
  setUiLibrary: (selection) =>
    set((s) => ({
      uiLibrary: {
        ...(s.uiLibrary ?? { main: null, addon: null }),
        ...selection,
      },
    })),
  setComponentVariant: (dimension, variantId) =>
    set((s) => ({
      componentVariants: {
        ...(s.componentVariants ?? {
          card: null,
          button: null,
          navbar: null,
          form: null,
          interaction: null,
        }),
        [dimension]: variantId,
      },
    })),
  setProjectInfo: (partial) =>
    set((s) => ({
      projectInfo: {
        ...(s.projectInfo ?? {
          projectName: null,
          projectDescription: null,
          gitRepoUrl: null,
        }),
        ...partial,
      },
    })),
  setApiKey: (key, value) =>
    set((s) => ({ apiKeys: { ...s.apiKeys, [key]: value } })),
  setVisualStyle: (id) => set({ visualStyle: id }),
  setMotion: (scenarioId, variantId) =>
    set((s) => ({
      motionSelections: { ...s.motionSelections, [scenarioId]: variantId },
    })),
  addBlueprintComponent: ({ pageSlug, componentId, variantId = null }) =>
    set((s) => {
      const exists = s.pageBlueprint.some(
        (e) => e.pageSlug === pageSlug && e.componentId === componentId,
      );
      if (exists)
        return {
          pageBlueprint: s.pageBlueprint.map((e) =>
            e.pageSlug === pageSlug && e.componentId === componentId
              ? { ...e, variantId: variantId ?? e.variantId }
              : e,
          ),
        };
      return {
        pageBlueprint: [...s.pageBlueprint, { pageSlug, componentId, variantId }],
      };
    }),
  updateBlueprintVariant: (pageSlug, componentId, variantId) =>
    set((s) => ({
      pageBlueprint: s.pageBlueprint.map((e) =>
        e.pageSlug === pageSlug && e.componentId === componentId
          ? { ...e, variantId }
          : e,
      ),
    })),
  removeBlueprintComponent: (pageSlug, componentId) =>
    set((s) => ({
      pageBlueprint: s.pageBlueprint.filter(
        (e) => !(e.pageSlug === pageSlug && e.componentId === componentId),
      ),
    })),
  clearBlueprint: () => set({ pageBlueprint: [] }),
  setBuilderReturnStep: (step) => set({ builderReturnStep: step }),
  setIntentNarrative: (n) => set({ intentNarrative: n }),
  setProductBrief: (b) => set({ productBrief: b }),
  setIntentSession: (s) => set({ intentSession: s }),
  clearIntentSession: () => set({ intentSession: null }),
  setPanelOutput: (o) => set({ panelOutput: o }),
  setDeliverArtifacts: (a) => set({ deliverArtifacts: a }),
  setSavedProjectId: (id) => set({ savedProjectId: id }),
  captureFlowSnapshot: () => {
    const s = get();
    return {
      currentStep: s.currentStep,
      builderReturnStep: s.builderReturnStep,
      projectType: s.projectType,
      aiCapabilities: s.aiCapabilities,
      techStack: s.techStack,
      designSystem: s.designSystem,
      uiLibrary: s.uiLibrary,
      componentVariants: s.componentVariants,
      projectInfo: s.projectInfo,
      apiKeys: s.apiKeys,
      visualStyle: s.visualStyle,
      motionSelections: s.motionSelections,
      pageBlueprint: s.pageBlueprint,
      intentNarrative: s.intentNarrative,
      productBrief: s.productBrief,
      intentSession: s.intentSession,
      panelOutput: s.panelOutput,
      deliverArtifacts: s.deliverArtifacts,
      savedProjectId: s.savedProjectId,
    };
  },
  generateConfig: () => {
    const s = get();
    return JSON.stringify(
      {
        projectType: s.projectType,
        aiCapabilities: s.aiCapabilities,
        techStack: s.techStack,
        designSystem: s.designSystem,
        uiLibrary: s.uiLibrary,
        componentVariants: s.componentVariants,
        projectInfo: s.projectInfo,
        apiKeys: s.apiKeys,
        visualStyle: s.visualStyle,
        motionSelections: s.motionSelections,
        pageBlueprint: s.pageBlueprint,
      },
      null,
      2,
    );
  },
  nextStep: () => set((s) => ({ currentStep: clampStep(s.currentStep + 1) })),
  prevStep: () => set((s) => ({ currentStep: clampStep(s.currentStep - 1) })),
  goToStep: (step) => set({ currentStep: clampStep(step) }),
  resetAll: (toStep = 1) =>
    set({
      currentStep: clampStep(toStep),
      projectType: null,
      aiCapabilities: [],
      techStack: null,
      designSystem: null,
      uiLibrary: null,
      componentVariants: null,
      projectInfo: null,
      apiKeys: {},
      visualStyle: null,
      motionSelections: {},
      pageBlueprint: [],
      intentNarrative: null,
      productBrief: null,
      intentSession: null,
      panelOutput: null,
      deliverArtifacts: null,
    }),
    }),
    {
      name: "xiye-flow-design",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? window.localStorage
          : (undefined as unknown as Storage),
      ),
      // 持久化：设计 token + Step 1 探索式访谈会话（避免每次进入都重新生成）。
      partialize: (state) => ({
        projectType: state.projectType,
        aiCapabilities: state.aiCapabilities,
        techStack: state.techStack,
        designSystem: state.designSystem,
        uiLibrary: state.uiLibrary,
        componentVariants: state.componentVariants,
        projectInfo: state.projectInfo,
        apiKeys: state.apiKeys,
        visualStyle: state.visualStyle,
        motionSelections: state.motionSelections,
        pageBlueprint: state.pageBlueprint,
        intentNarrative: state.intentNarrative,
        productBrief: state.productBrief,
        intentSession: state.intentSession,
        panelOutput: state.panelOutput,
        deliverArtifacts: state.deliverArtifacts,
        savedProjectId: state.savedProjectId,
      }),
    },
  ),
);
