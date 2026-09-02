// 生成项目产物：把流程中收集的全部配置（重点：Step 4 视觉设计的视觉风格）
// 推导成可落地的工程资产——设计 token、Tailwind 主题、机器可读配置。
//
// 这是「视觉风格套用到生成项目环节」的核心：Step 4 选的 palette / 字体 / 圆角
// 在这里被翻译成真实的 CSS 变量与 Tailwind 配置，下游代码生成器直接消费。

import type { FlowState, BlueprintEntry } from "@/lib/store/flow-store";
import type { ContentOverride } from "@/lib/content-resolver";
import {
  VISUAL_STYLES,
  VISUAL_STYLE_MAP,
  buildStyleSpec,
  type VisualStyle,
} from "@/data/visual-styles";
import { AI_CAPABILITIES } from "@/data/ai-capabilities";
import { VARIANT_OPTIONS } from "@/data/component-variants";
import { PROJECT_TYPES } from "@/data/project-types";
import { UI_LIBRARIES } from "@/data/ui-libraries";
import { TECH_STACKS } from "@/data/tech-stacks";
import { SKELETON_PAGE_MAP } from "@/data/skeletons";
import { MOTION_SCENARIOS, MOTION_VARIANT_MAP } from "@/data/motion-library";
import { buildArchitectureMarkdown } from "@/lib/architecture";
import { validateExport } from "@/lib/export-consistency";
import { buildAgentManifest, buildAgentHandoffMd, resolvedTokens } from "@/lib/agent-manifest";
import { buildCssVariables, buildTailwindConfig } from "@/lib/design-tokens-css";
import { buildSeedProject, buildAgentMdFiles, resolveSeedTokens } from "@/lib/seed-project";
import { buildAiKickoffPrompt } from "@/lib/ai-prompt";
import { buildSecurityGuideMd } from "@/lib/security-guide";
import { buildGuardNormsMd } from "@/lib/guard-norms";
import { resolvePositioning, inferProjectTypeName, inferFeatureDetails } from "@/lib/project-narrative";
import type { IntentNarrative } from "@/lib/ai-intent";
import { deriveFeaturePages } from "@/lib/ai-intent";
import { buildConvergenceDocs } from "@/lib/flow-export";

export interface FeatureCard {
  name: string;
  desc: string;
}

export interface GeneratedProject {
  /** 实际套用到产物的视觉风格（未选时回退默认） */
  style: VisualStyle;
  /** 是否使用了默认回退风格 */
  usedFallback: boolean;
  projectName: string;
  tagline: string;
  features: FeatureCard[];
  /** globals.css 中的 :root 设计 token */
  cssVariables: string;
  /** tailwind.config.ts 主题片段 */
  tailwindConfig: string;
  /** 机器可读的 Agent 闭环交接清单（xiye.agent.json，JSON 字符串） */
  agentManifest: string;
  /** 一致性自检结果 */
  consistency: {
    ok: boolean;
    issues: string[];
    warnings: string[];
  };
  /** 章节化「视觉与技术规范」文档（DESIGN_SPEC.md，含组件/动效/库规范） */
  designSpec: string;
  /** 完整文档交付包（多份 .md，含 README/技术选型/视觉规范/骨架说明/动效规范） */
  docs: { filename: string; title: string; content: string }[];
  /** 机器可读的完整项目配置（JSON 字符串） */
  xiyeConfig: string;
  /** 可运行种子工程（seed/ 目录，按技术栈生成） */
  seed: {
    files: { path: string; content: string }[];
    runCommand: string;
    frameworkLabel: string;
    runnable: boolean;
  };
}

export const DEFAULT_STYLE_ID = "aw-brutalist";

function resolveStyle(visualStyle: string | null): {
  style: VisualStyle;
  usedFallback: boolean;
} {
  if (visualStyle && VISUAL_STYLE_MAP[visualStyle]) {
    return { style: VISUAL_STYLE_MAP[visualStyle], usedFallback: false };
  }
  return {
    style: VISUAL_STYLE_MAP[DEFAULT_STYLE_ID] ?? VISUAL_STYLES[0],
    usedFallback: true,
  };
}

function buildFeatures(aiCapabilities: string[]): FeatureCard[] {
  if (aiCapabilities.length > 0) {
    return aiCapabilities
      .map((id) => AI_CAPABILITIES.find((c) => c.id === id))
      .filter(Boolean)
      .slice(0, 3)
      .map((c) => ({ name: c!.name, desc: c!.description ?? "AI 能力模块" }));
  }
  return [
    { name: "核心页面", desc: "基于所选项目类型搭建的主流程界面" },
    { name: "组件系统", desc: "按组件变体生成可复用 UI 单元" },
    { name: "主题体系", desc: "由视觉风格推导的设计 token 与暗色适配" },
  ];
}

function buildXiyeConfig(state: FlowState, style: VisualStyle): string {
  const p = style.palette;
  const config = {
    designTokenAuthority: "styles/globals.css :root（designSystem 覆盖生成；DESIGN_SPEC/AGENTS/xiye.config 与之对齐，冲突以 globals.css 为准）",
    project: {
      name: state.projectInfo?.projectName ?? null,
      type: state.projectType ?? null,
      description: state.projectInfo?.projectDescription ?? null,
      repository: state.projectInfo?.gitRepoUrl ?? null,
    },
    aiCapabilities: state.aiCapabilities,
    techStack: state.techStack,
    designSystem: state.designSystem,
    uiLibrary: state.uiLibrary,
    componentVariants: state.componentVariants,
    services: {
      apiKeys: Object.keys(state.apiKeys),
    },
    visualStyle: {
      id: style.id,
      name: style.name,
      sourceSkill: style.sourceSkill,
      libraryId: style.libraryId ?? null,
      palette: p,
      font: style.font,
      radius: style.radius,
      tokens: {
        css: buildCssVariables(style, state.designSystem),
        tailwind: buildTailwindConfig(style, state.designSystem),
      },
    },
    motion: Object.fromEntries(
      Object.entries(state.motionSelections ?? {}).map(([sid, vid]) => {
        const v = MOTION_VARIANT_MAP[vid];
        return [
          sid,
          v
            ? { id: v.id, name: v.name, framework: v.framework, source: v.source ?? null, code: v.code }
            : null,
        ];
      }),
    ),
  };
  return JSON.stringify(config, null, 2);
}

// —— P0：章节化「视觉与技术规范」文档（DESIGN_SPEC.md）——
export function buildDesignSpec(state: FlowState, style: VisualStyle): string {
  const p = style.palette;
  const spec = buildStyleSpec(style);
  const t = resolvedTokens(state); // token 真值（含自定义主色覆盖），与 globals.css / §3 css 同源
  const projectName = state.projectInfo?.projectName || "你的产品";
  const now = new Date().toLocaleString("zh-CN", { hour12: false });

  const techLabel =
    AI_CAPABILITIES.find((c) => c.id === state.techStack)?.name ?? state.techStack ?? "未选择";
  const mainLib = UI_LIBRARIES.find((l) => l.id === state.uiLibrary?.main);
  const addonLib = UI_LIBRARIES.find((l) => l.id === state.uiLibrary?.addon);

  const variantRow = (dim: string, label: string) => {
    const opt = VARIANT_OPTIONS.find(
      (x) => x.dimension === dim && x.id === state.componentVariants?.[dim],
    );
    return `| ${label} | ${opt?.name ?? "未选"} | ${opt?.componentName ? `${opt.componentName}.tsx` : "—"} |`;
  };

  const motionRows = Object.entries(state.motionSelections ?? {})
    .map(([sid, vid]) => {
      const sc = MOTION_SCENARIOS.find((s) => s.id === sid);
      const v = MOTION_VARIANT_MAP[vid];
      return `| ${sc?.name ?? sid} | ${v?.name ?? "未选"} | ${v?.framework ?? "—"} | ${v?.source ?? "—"} |`;
    })
    .join("\n");

  const serviceNames = Object.keys(state.apiKeys ?? {});

  return `# ${projectName} 视觉与技术规范

> 由 xiye 流程工作台自动生成 · ${now}
> 视觉风格：**${style.name}**${style.libraryId ? `（关联库 ${style.libraryId}）` : ""} · 来源：${style.sourceSkill}
> **设计 Token 唯一真值**：本文所有色值 / 字体 / 圆角的最终权威来源是 \`styles/globals.css\` 的 \`:root\` 变量（由 xiye.config.json 的 designSystem 覆盖生成）。本文表格、各章节 CSS 变量、以及 \`xiye.config.json\` 均与之对齐；若阅读中发现任何不一致，**一律以 \`globals.css\` 为准**。

---

## 1. 项目概述

| 项目 | 值 |
| --- | --- |
| 名称 | ${projectName} |
| 类型 | ${state.projectType ?? "未选择"} |
| 描述 | ${state.projectInfo?.projectDescription ?? "—"} |
| Git 仓库 | ${state.projectInfo?.gitRepoUrl ?? "—"} |

## 2. 技术栈与组件库

- **技术栈**：${techLabel}
- **UI 主库**：${mainLib ? `${mainLib.name}（${mainLib.framework} · ${mainLib.style} · ${mainLib.componentCount} 组件）` : "未选择"}
- **增强库**：${addonLib ? `${addonLib.name}（${addonLib.framework}）` : "未选择（可选）"}
${style.libraryId ? `- **视觉 ↔ 库匹配**：视觉风格来自「${style.libraryId}」，若主库与之一致则开发时能直接使用该库的组件规范，样式与 token 天然对齐。` : ""}

## 3. 设计 Token

\`\`\`css
${buildCssVariables(style, state.designSystem)}
\`\`\`

## 4. 视觉风格

| Token | 色值 | 用途 |
| --- | --- | --- |
| background | ${t.colors.background} | 页面背景 |
| surface | ${t.colors.surface} | 卡片/面板表面 |
| border | ${t.colors.border} | 描边/分隔线 |
| foreground | ${t.colors.foreground} | 主文本 |
| muted | ${t.colors.muted} | 次级文本 |
| primary | ${t.colors.primary} | 主色/行动（自定义主色后以此为准） |
| secondary | ${t.colors.secondary} | 强调/辅助 |

- **字体**：${t.typography.fontFamily}
- **圆角**：${t.layout.radius}

### 暗色模式

- 策略：${t.layout.darkMode}（由 designSystem.darkMode 决定）。
- 实现：在 \`styles/globals.css\` 追加 \`:root.dark\` 或 \`[data-theme="dark"]\` 作用域，**变量名与明色完全一致**（\`--background\` / \`--surface\` / \`--foreground\` / \`--primary\` 等），仅反相取值。
- 规则：暗色 token 是明色的对比度反相，**不得新增明色没有的变量名**，也不得改 \`--primary\`（主色暗色下通常保持不变或微调对比度）。切换由应用侧逻辑控制（class 或 data-theme），不要写死在组件里；\`xiye.config.json\` 的 designTokenAuthority 已声明 globals.css 为唯一真值。

## 5. 组件规范

### 5.1 核心组件样式（由视觉风格推导）

\`\`\`css
/* Button */
${spec.button}

/* Input */
${spec.input}

/* Card */
${spec.card}

/* Modal */
${spec.modal}
\`\`\`

${spec.usage}

### 5.2 组件变体

| 维度 | 选中变体 | 组件文件 |
| --- | --- | --- |
${variantRow("card", "卡片")}
${variantRow("button", "按钮")}
${variantRow("navbar", "导航")}
${variantRow("form", "表单")}

## 6. 动效规范

| 场景 | 选中变体 | 框架 | 来源 |
| --- | --- | --- | --- |
${motionRows || "| — | 未选择任何动效 | — | — |"}

### 6.1 加载与反馈（Loading & Feedback）

> 加载态是等待体验的核心，目标是「看得懂 · 不焦躁 · 不跳动」。以下为常用加载类组件的选用规范；所有加载态统一以「${style.name}」视觉契约的 token 为底色，仅沿用 surface / accent / text 与状态色，不额外新增色板。

| # | 组件 | 适用场景 | 默认参数 / 实现指引 |
| --- | --- | --- | --- |
| 1 | Spinner 转圈 | 等待时长不确定，仅提示「系统正在处理」 | 圆环以 accent 为高亮、surface(low) 为轨道；16/24/32 三档；旋转 0.8s 线性无限 |
| 2 | Progress Bar 进度条 | 进度可计算（上传 / 下载 / 表单步骤） | 高度 4px，accent 填充；步进可预测并给出百分比，完成后收敛到成功态 |
| 3 | Circular Progress 圆形进度 | 小空间内需展示明确进度 | 12/20/40px 三档；百分比文本居中，圆环弧形表示剩余量 |
| 4 | Skeleton 骨架屏 | 用占位块还原排版，避免页面抖动 | 以 surface(low) 色块 + 与真实内容等高的形状；结构稳定，不随内容加载而位移 |
| 5 | Shimmer 微光 | 叠加在骨架屏上，以流动亮光提示仍在加载 | 以 accent 8% 透明度的斜向流光扫过，1.4s 循环；仅用于浅表层，避免过度闪烁 |
| 6 | Button Loading 按钮加载 | 点击后切换加载态，防止重复提交 | 图标转圈 + 文案置灰/半透明；禁用态保持与背景可读的对比度 |
| 7 | Page Loader 页级加载 | 页面初次打开 / 核心内容加载前全局使用 | 首屏居中 Spinner 或整页骨架；预估超过 2s 时给出进度或文案，避免白屏 |

> 结束接力：加载完成后必须收敛到「成功 / 空 / 错误」三种状态之一；错误用警示色并附重试，空态给出引导文案，见 3. 设计 Token 的状态色与 6.2 过渡淡入（加载结束后内容以 0.24s 淡入，避免生硬切换）。

### 6.2 过渡与反馈节点

| 场景 | 建议 | 默认参数 |
| --- | --- | --- |
| 内容加载后浮现 | 淡入 | 0.24s ease-out |
| 面板 / 弹层出现 | 淡入 + 上滑 8px | 0.28s ease-out |
| 列表项增删 | 高度折叠 + 透明度插值 | 0.2s ease-in-out |
| 操作提交成功 | 对勾收缩 + 轻颤 | 0.16s 弹性回位 |
| 错误提示 | 警示色 toast + 可重试 | 2.4s 自动消散，含关闭按钮 |

> 约束：持续循环动效仅用于加载提示，避免抢注意力；一切过渡不应超过 0.3s，保持克制的产品感。

## 7. 工程配置

\`\`\`ts
${buildTailwindConfig(style, state.designSystem)}
\`\`\`

## 8. 服务接入

- **API 服务**：${serviceNames.length ? serviceNames.join("、") : "未配置"}

## 9. 开发任务清单

### 阶段一：工程初始化
- [ ] 初始化仓库与 CI（GitHub Actions / Jenkins / 其他）
- [ ] 接入设计 Token（globals.css）与主题系统
- [ ] 配置环境变量与密钥管理（.env + 密钥托管）
- [ ] 接入错误监控 ${state.uiLibrary ? "（如 Sentry）" : "（可选）"}

### 阶段二：核心功能
${(() => {
    const pt = PROJECT_TYPES.find((t) => t.id === state.projectType);
    const pages = pt ? pt.corePages.map((p) => `- [ ] 核心页面：${p}`).join("\n") : "- [ ] 搭建核心页面（按项目类型）";
    const ai = (state.aiCapabilities ?? []).length
      ? state.aiCapabilities
          .map((id) => `- [ ] AI 能力集成：${AI_CAPABILITIES.find((c) => c.id === id)?.name ?? id}`)
          .join("\n")
      : "- [ ] （未选择 AI 能力，跳过 AI 集成）";
    return `${pages}\n${ai}`;
  })()}
- [ ] 组件系统落地（${mainLib ? mainLib.name : "所选 UI 库"} + 组件规范）

### 阶段三：商业化与上线
- [ ] 认证与权限（登录 / RBAC / 第三方 OAuth）
- [ ] 计费与订阅接入（Stripe / PayPal）
- [ ] 合规落地（隐私政策 / 服务条款 / 数据保留策略）
- [ ] 上线清单：压测、告警、回滚预案、客服入口

---

_由 xiye 流程工作台生成。机器可读配置见 \`xiye.config.json\`。_
`;
}

function buildReadmeMd(
  state: FlowState,
  project: { name: string; tagline: string; features: FeatureCard[] },
  style: VisualStyle,
): string {
  const stack = TECH_STACKS.find((t) => t.id === state.techStack);
  const mainLib = UI_LIBRARIES.find((l) => l.id === state.uiLibrary?.main);
  const addonLib = state.uiLibrary?.addon
    ? UI_LIBRARIES.find((l) => l.id === state.uiLibrary!.addon)
    : undefined;
  return `# ${project.name}

> ${project.tagline}

由 **xiye 流程工作台** 生成 · 套用视觉风格 **${style.name}** · 页面骨架 ${state.pageBlueprint.length} 块

## 项目概览
${project.features.map((f) => `- **${f.name}**：${f.desc}`).join("\n") || "- （无特性）"}

## 技术栈
${[
  stack ? `- **框架方案**：${stack.name}（${stack.frontend} / ${stack.backend} / ${stack.database}）` : "- **框架方案**：（未在流程中选择 · Step 3）",
  mainLib ? `- **UI 组件库**：${mainLib.name} · ${mainLib.componentCount} · ${mainLib.style}` : "- **UI 组件库**：（未选择 · Step 5）",
  addonLib ? `- **增强库**：${addonLib.name}（${addonLib.description}）` : "",
  `- **视觉风格**：${style.name}`,
]
  .filter(Boolean)
  .join("\n")}

## 快速开始
\`\`\`bash
# 安装依赖
npm install

# 本地开发
npm run dev
\`\`\`

## 可运行底座（seed/）
\`seed/\` 是按所选技术栈生成的**可运行工程骨架**：依赖锁定版本、目录按架构铺好、壳页面已套用设计 token。
把 \`seed/\` 目录交给 AI 开发 Agent，作为其开工起点：

\`\`\`bash
cd seed
${(() => {
  const seed = buildSeedProject(state, resolveSeedTokens(state));
  return seed.runCommand;
})()}
\`\`\`

seed 内已含：
- \`AGENTS.md\` / \`CLAUDE.md\`：AI 编码工具（Claude Code / Cursor / Copilot）打开工程即自动加载的**开发约定**
- \`BLUEPRINT.md\`：蓝图装配清单（页面路由与组件文件占位已落盘）
- \`scripts/verify.mjs\`：**可脚本化验收**（token / 目录 / 页面 / 组件 / 无 TODO / 无密钥泄漏）

## 交付文档
- [AGENTS.md](AGENTS.md) / [CLAUDE.md](CLAUDE.md)：**AI 开发约定**（打开仓库根即自动读取）
- [AI_HANDOFF.md](AI_HANDOFF.md)：**AI 交接指令**（把本包交给 AI 开发 Agent 的总纲）
- [AI_PROMPT.md](AI_PROMPT.md)：**AI 初始化提示词**（解压后把它连同工程一起贴给 AI 编程工具，即可开工）
- [xiye.agent.json](xiye.agent.json)：机器闭环交接清单（栈 / 依赖 / 页面 / token / 动效）
- [STACK.md](STACK.md)：技术栈与组件库选型
- [ARCHITECTURE.md](ARCHITECTURE.md)：工程架构（按技术栈推导的目录 / 分层 / 数据流）
- [DESIGN_SPEC.md](DESIGN_SPEC.md)：视觉与技术规范（设计 token / 字体 / 圆角 / 动效）
- [SKELETON.md](SKELETON.md)：页面骨架说明
- [MOTION.md](MOTION.md)：动效规范
- [xiye.config.json](xiye.config.json)：原始流程配置
`;
}

function buildStackMd(state: FlowState): string {
  const stack = TECH_STACKS.find((t) => t.id === state.techStack);
  const mainLib = UI_LIBRARIES.find((l) => l.id === state.uiLibrary?.main);
  const addonLib = state.uiLibrary?.addon
    ? UI_LIBRARIES.find((l) => l.id === state.uiLibrary!.addon)
    : undefined;
  return `# 技术选型说明

本文档记录本次生成所采用的技术栈与 UI 库选型依据。

## 技术栈方案
${
  stack
    ? `- **方案**：${stack.name}
- **前端**：${stack.frontend}
- **后端**：${stack.backend}
- **数据库**：${stack.database}
- **样式**：${stack.styling}
- **AI 集成**：${stack.aiIntegration}
- **适合场景**：${stack.suitableFor}
- **预估成本**：${stack.estimatedCost}
- **开发周期**：${stack.devDuration}
- **学习曲线**：${stack.learningCurve} · **扩展性**：${stack.scalability}
- **建议团队**：${stack.teamSize}
- **推荐项目类型**：${stack.recommendedFor.join("、")}`
    : "（流程中未选择技术栈，请回到 Step 3 选择）"
}

## UI 组件库
${
  mainLib
    ? `- **主库**：${mainLib.name}
  - 风格：${mainLib.style} · 组件数：${mainLib.componentCount} · 定制：${mainLib.customization}
  - 适应框架：${mainLib.framework} · 体积：${mainLib.bundleSize}
  - 优点：${mainLib.pros.join("、")}`
    : "- **主库**：（未选择 · Step 5）"
}
${addonLib ? `- **增强库**：${addonLib.name}（${addonLib.description}）` : ""}

## 关联文档
- 把本包交给 AI 开发 Agent 的总纲见 \`AI_HANDOFF.md\`，机器清单见 \`xiye.agent.json\`
- 配色 / 字体 / 圆角等视觉规范见 \`DESIGN_SPEC.md\`
- 工程目录与分层见 \`ARCHITECTURE.md\`
- 页面结构见 \`SKELETON.md\`
- 动效规范见 \`MOTION.md\`
`;
}

function buildSkeletonMd(state: FlowState): string {
  const byPage = new Map<string, BlueprintEntry[]>();
  for (const e of state.pageBlueprint) {
    const list = byPage.get(e.pageSlug) ?? [];
    list.push(e);
    byPage.set(e.pageSlug, list);
  }
  if (!byPage.size) {
    return `# 页面骨架说明

（尚未收录页面骨架。请到骨架工作台逐个把组件「加入蓝图」后重新生成。）`;
  }
  const lines: string[] = [
    "# 页面骨架说明",
    "",
    "本文档说明本次生成所采用的页面结构（来自骨架工作台逐个收集的蓝图）。",
    "",
  ];
  for (const [pageId, entries] of byPage) {
    const page = SKELETON_PAGE_MAP[pageId];
    lines.push(`## ${page?.name ?? pageId}`, "");
    for (const e of entries) {
      const comp = page?.components.find((c) => c.id === e.componentId);
      let variantName = "默认";
      if (e.variantId) {
        const v = comp?.variants.find((x) => x.id === e.variantId);
        variantName = v?.name ?? e.variantId;
      }
      lines.push(`- ${comp?.name ?? e.componentId}（变体：${variantName}）`);
    }
    lines.push("");
  }
  lines.push("> 提示：继续在骨架工作台通过「加入蓝图」累积，可精确复刻整套页面。");
  return lines.join("\n");
}

function buildMotionMd(state: FlowState): string {
  const entries = Object.entries(state.motionSelections);
  if (!entries.length) {
    return `# 动效规范

（尚未在流程 Step 4 类C 中选择动效，请选择后再生成。）`;
  }
  const lines = [
    "# 动效规范",
    "",
    "本文档记录本次生成所选择的动效预设（场景 → 变体）。",
    "",
    ...entries.map(([s, v]) => `- **${s}** → ${v}`),
    "",
    "> 交互动效的具体参数与实现遵循 DESIGN_SPEC.md 的「动效」章节。",
  ];
  return lines.join("\n");
}

// 当没走过「AI 一句话」（intentNarrative 为空）时，依据当前选型推导一套基线产品叙事
function deriveNarrativeFallback(state: FlowState, style: VisualStyle): IntentNarrative {
  const type = state.projectType ? PROJECT_TYPES.find((t) => t.id === state.projectType) : undefined;
  const features = inferFeatureDetails(state);
  const coreFeatures = (features.length ? features : [{ name: "核心主流程", desc: "" }]).map((f) => ({
    name: f.name,
    why: f.desc,
  }));
  const pageNames = state.pageBlueprint
    .map((e) => SKELETON_PAGE_MAP[e.pageSlug]?.name)
    .filter((x): x is string => !!x);
  const positioning = resolvePositioning(state);
  return {
    vision: `${inferProjectTypeName(state)}产品：${positioning}`,
    positioning,
    targetAudience: type?.audience ? [type.audience] : [],
    coreFeatures,
    nonGoals: [],
    successMetrics: [],
    marketFit: `套用「${style.name}」视觉契约，信息架构遵循主流站点结构（${pageNames.slice(0, 4).join("、") || "核心页面"}），保证初始上线即具备完整、可展示、可转化的产品骨架。`,
  };
}

/** 章节化「产品需求文档」（PRD.md）：由 AI 一句话产出的叙事推导，未走 AI 时用选型兜底 */
export function buildPrdMd(
  state: FlowState,
  style: VisualStyle,
  narrative: IntentNarrative,
): string {
  const projectName =
    state.projectInfo?.projectName ||
    state.productBrief?.name ||
    narrative.vision?.split(/[，。；;,.!?！？]/)[0]?.slice(0, 40) ||
    "你的产品";
  const now = new Date().toLocaleString("zh-CN", { hour12: false });
  const pTypeName = inferProjectTypeName(state);
  const stackLabel = state.techStack
    ? TECH_STACKS.find((t) => t.id === state.techStack)?.name ?? state.techStack
    : "未选择";

  const targetRows = narrative.targetAudience.length
    ? narrative.targetAudience
        .map((t) => `- ${t}`)
        .join("\n")
    : "- 面向该品类的核心用户与决策者";
  const featuresForPrd =
    narrative.coreFeatures && narrative.coreFeatures.length
      ? narrative.coreFeatures
      : [{ name: "核心主流程", why: "围绕所选类型搭建的主流程与关键模块" }];
  // 核心功能按数量分配 P0/P1/P2（约 40% / 40% / 余量），先算好再渲染，避免引用后声明变量
  const featCount = featuresForPrd.length;
  const featP0 = Math.max(1, Math.ceil(featCount * 0.4));
  const featP1 = Math.max(1, Math.ceil(featCount * 0.4));
  const featureRows = featuresForPrd
    .map((f, i) => {
      const matched = state.productBrief?.coreModules?.find(
        (m) => m.name === f.name || (m.detail && m.detail.includes(f.name)) || (m.name && f.name.includes(m.name)),
      );
      const why = f.why || matched?.detail || "围绕核心场景，让用户高效完成关键操作";
      const prio = i < featP0 ? "P0" : i < featP0 + featP1 ? "P1" : "P2";
      return `| ${f.name} | ${why} | ${prio} |`;
    })
    .join("\n");
  // 4.1 通用骨架页面（来自骨架工作台选择，属基础站结构）
  const pageGroups: Record<string, string[]> = {};
  for (const e of state.pageBlueprint) {
    const pg = SKELETON_PAGE_MAP[e.pageSlug];
    if (!pg) continue;
    const comp = pg.components.find((c) => c.id === e.componentId);
    (pageGroups[e.pageSlug] ??= []).push(comp?.name ?? e.componentId);
  }
  const skeletonRows = Object.entries(pageGroups).length
    ? Object.entries(pageGroups)
        .map(([slug, comps]) => {
          const pg = SKELETON_PAGE_MAP[slug];
          return `- **${pg?.name ?? slug}**：${comps.join("、")}`;
        })
        .join("\n")
    : "- 进入骨架工作台选择页面与区块后自动补全";

  // 4.2 业务专属页面（功能驱动）：从核心功能推导，AI 产出优先、本地启发式兜底
  const featurePages =
    narrative.pages && narrative.pages.length
      ? narrative.pages
      : deriveFeaturePages(narrative.coreFeatures);
  const PRIORITY_LABEL: Record<string, string> = { P0: "P0·核心", P1: "P1·重要", P2: "P2·辅助" };
  const p0 = featurePages.filter((p) => p.priority === "P0").length;
  const p1 = featurePages.filter((p) => p.priority === "P1").length;
  const p2 = featurePages.filter((p) => p.priority === "P2").length;
  const featureRows4 =
    featurePages.length > 0
      ? featurePages
          .map((p) => {
            const related = p.relatedFeatures?.length
              ? p.relatedFeatures.join("、")
              : "（通用）";
            const path = p.path ? `（${p.path}）` : "";
            const prio = PRIORITY_LABEL[p.priority] ?? p.priority;
            return `| ${p.name}${path} | ${prio} | ${related} | ${p.description || "—"} |`;
          })
          .join("\n")
      : "| （暂无） | — | — | 核心功能尚未推导出专属页面 |";

  // 3.1 功能验收标准：为每个核心功能推导开发可用的「任务/结果/边界」验收（确定性生成，保持稳定可落地）
  const acceptanceRows = featuresForPrd
    .map((f) => {
      const name = f.name;
      const reason = f.why || "围绕核心价值交付可用体验";
      return (
        `### ${name}\n` +
        `> 价值依据：${reason}\n` +
        `\`\`\`\n` +
        `- 给定：处于${name}场景的核心用户\n` +
        `- 当：用户触发「${name}」的主操作（进入/创建/提交/查看）\n` +
        `- 应：主流程顺畅完成，关键结果立即可见，且符合所选视觉规范（token 一致、响应式、动效克制）\n` +
        `- 边界：输入为空/非法时有友好提示；加载中与失败态均有明确反馈；数据存取走 DATA_CONTRACT 约定接口\n` +
        `- 可测：该功能关键路径可被 seed/scripts/verify.mjs 或浏览器手工脚本覆盖，无 TODO/FIXME 遗留\n` +
        `\`\`\``
      );
    })
    .join("\n\n");

  // 4.3 页面验收标准：P0 页面逐页给出进入条件/主交互/跳出判定
  const pageAcRows = featurePages
    .filter((p) => p.priority === "P0")
    .map((p) => {
      const path = p.path ? ` \`${p.path}\`` : "";
      const related = p.relatedFeatures?.length ? `（关联：${p.relatedFeatures.join("、")}）` : "";
      return `- **${p.name}**${path} ${related}\n  - 进入：从上一页/导航可达；路由挂载正确、渲染不报错\n  - 主交互：${p.description || "完成该页面的核心操作"}，结果即时反馈\n  - 退出：返回上一级或跳转下一环节清晰；空态/加载态/错误态齐备`;
    })
    .join("\n") || "- （暂无 P0 页面，见第 4.2 节优先级）";

  // 收敛链回填（P0 Batch B）：把协同阶段产出的 screenMap / screenSpec 引入 PRD，
  // 使主文档也引用链，而非仅作为 docs/ 下独立 spec。字段来自 state.screenMap / state.screenSpec（可能 null）。
  const escMd = (v?: string) => (v ?? "").replace(/\|/g, "/").replace(/\n/g, " ");
  let screenMapSection = "";
  if (state.screenMap && state.screenMap.screens.length) {
    const m = state.screenMap;
    const rows = m.screens
      .slice(0, 40)
      .map(
        (s) =>
          `| **${escMd(s.name)}** | ${escMd(s.type)} | ${escMd(s.purpose)} | ${s.entryPoints.length ? s.entryPoints.map(escMd).join("、") : "主入口"} | ${s.exitPaths.map(escMd).join("、") || "—"} |`,
      )
      .join("\n");
    const nav = m.navigation.length
      ? m.navigation
          .slice(0, 20)
          .map((n) => `- ${escMd(n.action)}：${escMd(n.fromScreenId)} → ${escMd(n.toScreenId)}${n.condition ? `（条件：${escMd(n.condition)}）` : ""}`)
          .join("\n")
      : "";
    screenMapSection = `
### 4.4 信息架构（协同收敛产出）

> 以下来自协同阶段「信息架构收敛」，是产品真实页面结构的权威来源；完整页面地图与跳转决策详见交付包 \`docs/INFORMATION_ARCHITECTURE.md\`。

| 页面 | 类型 | 使命 | 入口 | 出口 |
| --- | --- | --- | --- | --- |
${rows}
${nav ? `\n**关键跳转**：\n${nav}\n` : ""}`;
  }
  let screenSpecSection = "";
  if (state.screenSpec && state.screenSpec.screens.length) {
    const blocks = state.screenSpec.screens
      .slice(0, 30)
      .map((sc) => {
        const inter = sc.interactions
          .slice(0, 8)
          .map((i) => `- **${escMd(i.trigger)}** → 意图：${escMd(i.userIntent)}；系统「${escMd(i.systemResponse)}」${i.nextScreenId ? `；跳转 ${escMd(i.nextScreenId)}` : ""}${i.requiresConfirmation ? "；需二次确认" : ""}`)
          .join("\n");
        return `#### ${escMd(sc.name)}（${escMd(sc.type)}）\n- 主结果：${escMd(sc.primaryOutcome)}\n- 交互契约：\n${inter}`;
      })
      .join("\n\n");
    screenSpecSection = `
### 4.5 界面规格契约摘要

> 以下为协同阶段「界面规格契约」要点；完整信息层级 / 状态设计 / 数据需求 / 开放问题详见交付包 \`docs/SCREEN_SPEC.md\`。

${blocks}
`;
  }

  // 5. 用户核心旅程：由 P0 页面按序串联（P0 → P0 → P1 的合理推进顺序）
  const p0Pages = featurePages.filter((p) => p.priority === "P0");
  const p1Pages = featurePages.filter((p) => p.priority === "P1");
  const flowChain = [...p0Pages, ...p1Pages].slice(0, 4);
  const flowRows =
    flowChain.length > 0
      ? flowChain
          .map((p, i) => {
            const stepName = ["认知/进入", "主操作", "完成/产出", "续用/转化"][i] ?? `第${i + 1}步`;
            return `- **${stepName}** → \`${p.name}\`${p.path ? `（${p.path}）` : ""}：${p.description || "完成该环节"}`;
          })
          .join("\n")
      : "- 进入首页/登录页，沿导航进入核心操作并完成一次闭环";

  // 6. 用户核心旅程（协同收敛优先）：若已生成 ExperienceJourney，用它替换粗糙 P0/P1 串联
  let coreJourneySection: string;
  if (state.journey && state.journey.steps.length) {
    const j = state.journey;
    const steps = [...j.steps].sort((a, b) => a.order - b.order);
    const stepLines = steps
      .map(
        (s) =>
          `- **步骤 ${s.order} · ${escMd(s.userGoal)}**：用户「${escMd(s.userAction)}」→ 系统「${escMd(s.systemBehavior)}」→ 可见「${escMd(s.visibleOutcome)}」${s.frictionOrRisk ? `（风险：${escMd(s.frictionOrRisk)}）` : ""}`,
      )
      .join("\n");
    coreJourneySection = `> 以下旅程来自协同阶段「用户体验旅程收敛」产出（由 AI 结合愿景与核心功能推导），是端到端可跑通的关键路径；完整旅程步骤、关键时刻与边界详见交付包 \`docs/USER_JOURNEY.md\`。\n\n- 首要场景：用户「${escMd(j.primaryScenario.user)}」因「${escMd(j.primaryScenario.trigger)}」期望「${escMd(j.primaryScenario.desiredOutcome)}」\n${stepLines}`;
  } else {
    coreJourneySection = flowRows;
  }

  // 6. 关键数据模型：由核心功能推导候选实体与建议字段（AI 开发可细化）
  const entityRows = featuresForPrd
    .map((f) => {
      const n = f.name;
      let fields = "id、归属主键、状态、创建/更新时间";
      if (n.includes("匹配") || n.includes("推荐") || n.includes("评分")) {
        fields = "id、目标输入、评分/命中原因、版本号、时间戳";
      } else if (n.includes("简历") || n.includes("上传") || n.includes("解析")) {
        fields = "id、原始文件 URL、结构化字段(JSON)、解析状态、时间戳";
      } else if (n.includes("对话") || n.includes("通话") || n.includes("AI")) {
        fields = "id、会话 ID、消息/角色、内容、时间戳";
      } else if (n.includes("预测") || n.includes("仪表") || n.includes("归因")) {
        fields = "id、时间维度、指标名、数值、关联对象";
      } else if (n.includes("库") || n.includes("管理")) {
        fields = "id、名称、分类、版本、更新时间";
      } else if (n.includes("采集") || n.includes("数据")) {
        fields = "id、设备/来源、原始数据、时间戳、同步状态";
      }
      const remark = f.why || "支撑核心功能的持久化数据";
      return `| ${f.name} | ${fields} | ${remark} |`;
    })
    .join("\n") || "| 核心主流程 | id、归属主键、状态、创建/更新时间 | 通用主表 |";

  // 9. 里程碑与交付范围
  const milestoneRows = [
    `### Phase 0 · 底座跑通（参照 \`seed/\`）\n- 启动工程并确认运行；读交接文档；verify.mjs 全部通过。`,
    `### Phase 1 · 核心链路（P0 · 共 ${p0} 个 P0 页面）\n> 范围：${p0Pages.map((p) => `\`${p.name}\``).join("、") || "核心 P0 页面"}\n- 打通端到端主流程，可被关键路径验收覆盖。`,
    `### Phase 2 · 完善分层（P1 → P2）\n> 范围：P1 共 ${p1} 个、P2 共 ${p2} 个页面\n- 实现 P1 能力与打磨视觉/动效；P2 按需补齐；非目标（第 8 节）不做。`,
  ].join("\n\n");

  const nonGoalRows = narrative.nonGoals?.length
    ? narrative.nonGoals.map((n) => `- ${n}`).join("\n")
    : "- 不实现超出核心功能与非目标之外的重型增值模块；\n- 不做与当前技术栈不一致的大规模重构。";
  const metricRows = narrative.successMetrics?.length
    ? narrative.successMetrics.map((m) => `- ${m}`).join("\n")
    : "- 注册/激活率\n- 核心功能留存与关键路径转化率\n- 从「可运行底座」到「主流程跑通」的交付完整性";

  // 协作阶段「规范守门员」会诊产出（已一次性生成，此处直接带入，无需在 refine/deliver 重复会诊）
  const guardSummary = state.panelOutput?.guard;
  const guardSection =
    guardSummary && (guardSummary.summary || (guardSummary.details && guardSummary.details.length))
      ? `## 11.5. 开发规范与边界（AI 生成约束）

> 本节源自工作台多 Agent 会诊的「规范守门员」产出，已在协作阶段一次性生成，此处直接带入，**后续阶段无需重复会诊**。

${guardSummary.summary ? `**核心结论**：${guardSummary.summary}\n\n` : ""}${guardSummary.details?.length ? `**规范清单**：\n${guardSummary.details.map((d, i) => `${i + 1}. ${d}`).join("\n")}\n\n` : ""}更多工程级约束详见交付包 \`docs/AGENTS.md\` / \`docs/CLAUDE.md\` / \`docs/SECURITY.md\`。

`
      : "";

  // 对话产出的设计系统（brief.extra.visualSpec）优先作为「视觉契约」，无则用 marketFit 兜底
  const visualSpec = state.productBrief?.extra?.visualSpec;
  const visualContract =
    typeof visualSpec === "string" && visualSpec.trim()
      ? `> 对话中已确认的设计系统（由产品方法论推导，供视觉落地参考）：\n\n${visualSpec.trim()}\n\n> 最终视觉 token 唯一真值以 \`docs/DESIGN_SPEC.md\` 与 \`globals.css\` 为准，此处为方向性参考。`
      : narrative.marketFit;

  const positioningPart =
    (narrative.positioning?.trim().replace(/[。；;]+$/, "") || "聚焦目标用户的核心场景") + "。";

  return `# ${projectName} · 产品需求文档（PRD）

> 由 xiye 流程工作台生成 · ${now}
> 一句话：${narrative.vision}

## 1. 产品概述

> 本产品定位为 **${pTypeName}**（基于 ${stackLabel}），围绕愿景「${narrative.vision}」展开。${positioningPart}主要服务 ${state.productBrief?.targetAudience?.join("、") || "该品类的核心用户与决策者"}，${state.productBrief?.description || "围绕该场景提供端到端的可用体验"}。

| 项 | 内容 |
| --- | --- |
| 类型 | ${pTypeName} |
| 技术栈 | ${stackLabel} |
| 愿景 | ${narrative.vision} |
| 定位 | ${narrative.positioning} |

## 2. 目标用户（JTBD 视角）

${targetRows}

> 已应用 Jobs To Be Done 框架：从 功能性 / 社交性 / 情感性 三类任务理解用户「雇」产品完成的进展，而非仅列画像。

## 3. 核心功能（按 RICE 轻重排序）

| 功能 | 价值（解决什么问题） | 优先级 |
| --- | --- | --- |
${featureRows}

> 已按 RICE（Reach×Impact×Confidence%/Effort）思路将核心功能轻重排序；量化优先级详见知识库 \`amp-prioritize\` skill。

## 4. 页面与信息架构

> 由两部分构成：**通用骨架页**（基础站结构，任何项目适用）+ **业务专属页面**（由上方核心功能推导，是本项目必须额外开发的部分）。

### 4.1 通用骨架页（基础站结构）

${skeletonRows}

### 4.2 业务专属页面（功能驱动，需额外开发）

| 页面 | 优先级 | 关联核心功能 | 功能描述 |
| --- | --- | --- | --- |
${featureRows4}

> 本期需额外开发 **${featurePages.length}** 个业务专属页面（P0：${p0} · P1：${p1} · P2：${p2}）。这些页面对应「核心功能」章节的具体落地，是本项目区别于通用模板的关键交付；通用骨架页见 4.1。

### 4.3 页面验收标准（P0 页逐页给出，供 AI 开发按此自检）

${pageAcRows}
${screenMapSection}${screenSpecSection}

## 5. 功能验收标准

> 每个核心功能的「任务 / 结果 / 边界 / 可测」验收标准如下，AI 开发须按此实现，并作为自测依据。

${acceptanceRows}

## 6. 用户核心旅程

> 把 P0/P1 页面串成一条可端到端跑通的关键旅程，是「AI 能对着开发不跑偏」的骨架。

${coreJourneySection}

## 7. 关键数据模型（候选实体与建议字段）

> AI 开发时可细化到实际 ORM/Schema；字段命名与接口契约遵循 \`seed/DATA_CONTRACT.md\`。

| 候选实体 | 建议字段 | 备注 |
| --- | --- | --- |
${entityRows}

## 8. 里程碑与交付范围

> AI 开发按此 Phase 0 / 1 / 2 逐阶段推进，每阶段完成后输出清单并等待确认，避免遗漏。详见交付包 \`docs/AI_PROMPT.md\`。

${milestoneRows}

## 9. 非本期目标（Explicit Non-Goals）

${nonGoalRows}

## 10. 成功指标与观测

${metricRows}

## 11. 市场契合与视觉契约

${visualContract}

${guardSection}## 12. 价值主张（PR/FAQ 反向验证）

> 已应用 Amazon Working Backwards：先写客户视角新闻稿，再倒推要造什么。

- **一句话新闻稿式价值主张**：${narrative.vision}
- **定位差异（why now）**：${narrative.positioning}
- 若新闻稿痛点不够生动、价值主张像空话，说明想法仍需用 \`amp-jobs-to-be-done\` / \`amp-amazon-working-backwards\` skill 深做。

## 13. 方法论溯源

本 PRD 由 xiye「AI 一句话」生成，已强制套用 xiye 知识库引入的顶级产品设计方法论：

- \`amp-craft-spec\`（结构化 PRD 写作）
- \`amp-jobs-to-be-done\`（JTBD 用户洞察）
- \`amp-prioritize\`（RICE 优先级）
- \`amp-amazon-working-backwards\`（PR/FAQ 反向验证）

来源：[amplitude/builder-skills](https://github.com/amplitude/builder-skills)（Amplitude 官方 PM 团队）。如需更深的结构化产出，可在 xiye 知识库「技能」类复制对应 skill 原文甩给 AI。

> 视觉 token / 字体 / 圆角 / 动效等视觉规范详见 \`docs/DESIGN_SPEC.md\`。
`;

}

/**
 * UI 展示与 zip 内 PRD.md 的唯一真值入口：当前 ref 阶段「产品专家」预览
 * 与最终生成工程包共用同一函数，保证两处内容完全一致。
 */
export function buildPrdMdForState(state: FlowState): string {
  const { style } = resolveStyle(state.visualStyle);
  const narrative = state.intentNarrative ?? deriveNarrativeFallback(state, style);
  return buildPrdMd(state, style, narrative);
}

export function generateProject(state: FlowState, content?: ContentOverride, styleId?: string | null): GeneratedProject {
  const { style, usedFallback } = resolveStyle(state.visualStyle);
  const projectName =
    state.projectInfo?.projectName ||
    state.productBrief?.name ||
    "你的产品";
  const features = buildFeatures(state.aiCapabilities);
  const project = { name: projectName, tagline: "由 xiye 流程工作台生成 · 已套用所选视觉风格", features };
  const designSpec = buildDesignSpec(state, style);
  const stackLabel = state.techStack
    ? TECH_STACKS.find((t) => t.id === state.techStack)?.name ?? state.techStack
    : "";
  const pTypeName = state.projectType
    ? PROJECT_TYPES.find((t) => t.id === state.projectType)?.name ?? state.projectType
    : null;
  const architectureMd = buildArchitectureMarkdown(
    state.techStack,
    stackLabel,
    projectName,
    pTypeName,
    features.map((f) => f.name),
    state.pageBlueprint,
    state.screenMap,
  );

  const consistency = validateExport(state);
  const agentManifest = JSON.stringify(buildAgentManifest(state), null, 2);
  const handoffMd = buildAgentHandoffMd(state, consistency);
  const seed = buildSeedProject(state, resolveSeedTokens(state), content);
  const prdNarrative = state.intentNarrative ?? deriveNarrativeFallback(state, style);
  const prdMd = buildPrdMd(state, style, prdNarrative);

  return {
    style,
    usedFallback,
    projectName,
    tagline: project.tagline,
    features,
    cssVariables: buildCssVariables(style, state.designSystem),
    tailwindConfig: buildTailwindConfig(style, state.designSystem),
    agentManifest,
    consistency,
    designSpec,
    docs: [
      { filename: "README.md", title: "项目概览", content: buildReadmeMd(state, project, style) },
      { filename: "PRD.md", title: "产品需求文档", content: prdMd },
      { filename: "STACK.md", title: "技术选型", content: buildStackMd(state) },
      { filename: "AI_HANDOFF.md", title: "AI 交接指令", content: handoffMd },
      { filename: "AI_PROMPT.md", title: "AI 初始化提示词", content: buildAiKickoffPrompt(state) },
      { filename: "ARCHITECTURE.md", title: "工程架构", content: architectureMd },
      { filename: "DESIGN_SPEC.md", title: "视觉与技术规范", content: designSpec },
      { filename: "SKELETON.md", title: "页面骨架说明", content: buildSkeletonMd(state) },
      { filename: "MOTION.md", title: "动效规范", content: buildMotionMd(state) },
      { filename: "SECURITY.md", title: "安全开发注意事项", content: buildSecurityGuideMd() },
      { filename: "GUARD_NORMS.md", title: "开发边界规范", content: buildGuardNormsMd() },
      // 三件套-A：AI 编码工具打开仓库根即自动读取的顶层约定（zip 根目录）
      ...buildAgentMdFiles(state, "").map((f) => ({ filename: f.path, title: "AI 开发约定", content: f.content })),
      // P0 修复：把 collab 收敛链（蓝图/旅程/页面地图/界面规格/原型）接进交付物，
      // 否则用户在协同阶段审阅确认的产物在交付门被整体丢弃（此前 project-generator 完全不消费这 5 层）。
      // P2-④：透传所选角色风格，使 spec 文档顶部带「收敛视角」注脚，语气与风格一致。
      ...buildConvergenceDocs(state, styleId),
    ],
    xiyeConfig: buildXiyeConfig(state, style),
    seed,
  };
}

export function buildProjectZipFiles(project: GeneratedProject): { name: string; content: string }[] {
  const docFiles = project.docs.map((d) => ({
    name: d.filename === "AGENTS.md" || d.filename === "CLAUDE.md" ? d.filename : `docs/${d.filename}`,
    content: d.content,
  }));
  const styleFiles = [
    { name: "styles/globals.css", content: project.cssVariables },
    { name: "styles/tailwind.config.ts", content: project.tailwindConfig },
  ];
  const rootJson = [
    { name: "xiye.agent.json", content: project.agentManifest },
    { name: "xiye.config.json", content: project.xiyeConfig },
  ];
  const seedFiles = project.seed.files.map((f) => ({ name: `seed/${f.path}`, content: f.content }));
  return [...docFiles, ...styleFiles, ...rootJson, ...seedFiles];
}
