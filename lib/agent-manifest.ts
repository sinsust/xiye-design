// 面向其他 AI / 开发 Agent 的「机器闭环清单」：把全部选型固化成可编程读取的 JSON
// （xiye.agent.json），并据此生成一份给 Agent 的起始指令（AI_HANDOFF.md）。
// 所有 id 均来自受控目录；配合一致性自检，保证 Agent 拿到的每个引用都真实存在。

import type { FlowState, BlueprintEntry, DesignSystem } from "@/lib/store/flow-store";
import {
  VISUAL_STYLES,
  VISUAL_STYLE_MAP,
  FONT_STACK,
  type VisualStyle,
} from "@/data/visual-styles";
import { TECH_STACKS } from "@/data/tech-stacks";
import { UI_LIBRARIES } from "@/data/ui-libraries";
import { PROJECT_TYPES } from "@/data/project-types";
import { SKELETON_PAGE_MAP } from "@/data/skeletons";
import { RADIUS_OPTIONS, FONT_OPTIONS, DARK_MODE_OPTIONS } from "@/data/design-presets";
import { TYPE_SCALE_TOKENS, DENSITY_TOKENS, SHADOW_TOKENS, SCROLL_TOKENS } from "@/data/design-tokens";
import { VARIANT_OPTIONS } from "@/data/component-variants";
import { MOTION_SCENARIO_MAP, MOTION_VARIANT_MAP } from "@/data/motion-library";
import { resolveArchitecture, buildArchitectureView } from "@/lib/architecture";
import { validateExport, type ConsistencyReport } from "@/lib/export-consistency";
import { buildSeedProject, resolveSeedTokens } from "@/lib/seed-project";

const DEFAULT_STYLE_ID = "aw-brutalist";
const HEX = /^#[0-9a-f]{3,8}$/i;

/** 机器可读清单（xiye.agent.json）的具名类型，供 UI/AI 提示词等消费方共享 */
type TechStackShape = (typeof TECH_STACKS)[number];

export interface AgentManifest {
  schema: string;
  kind: string;
  meta: {
    projectName: string;
    projectType: string;
    techStack: { id: string; name: string } | null;
  };
  stack: {
    id: string;
    name: string;
    frontend: TechStackShape["frontend"];
    backend: TechStackShape["backend"];
    database: TechStackShape["database"];
    styling: TechStackShape["styling"];
    aiIntegration: TechStackShape["aiIntegration"];
    pattern: string;
    directoryTree: unknown;
    packages: { frontend: string[]; backend: string[]; database: string[] };
  } | null;
  uiLibraries: {
    main: { id: string; name: string; framework: string; style: string } | null;
    addon: { id: string; name: string } | null;
  };
  visualStyle: { id: string; name: string; sourceSkill: string; usedFallback: boolean };
  designTokens: ResolvedDesignTokens;
  componentVariants: Record<string, unknown>;
  pages: AgentManifestPage[];
  motion: Record<string, AgentManifestMotion>;
  architecture: { file: string; layers: { id: string; name: string; path: string; pages: string[] }[] };
  constraints: string[];
  bootstrap: {
    seedDir: string;
    runnable: boolean;
    install: string;
    dev: string;
    runCommand: string;
    frameworkLabel: string;
    envVars: { key: string; required: boolean; note: string }[];
  };
  acceptance: string[];
  rules: { do: string[]; dont: string[] };
  deliverable: { format: string; fields: string[] };
  consistency: { ok: boolean; issues: unknown[]; warnings: unknown[] };
  referenceFiles: string[];
}

export interface AgentManifestPage {
  pageSlug: string;
  pageName: string;
  components: AgentManifestPageComponent[];
}

export interface AgentManifestPageComponent {
  componentId: string;
  componentName: string;
  variantId: string | null;
  variantName: string;
  preview?: unknown;
}

export interface ResolvedDesignTokens {
  colors: {
    primary: string;
    background: string;
    surface: string;
    border: string;
    foreground: string;
    muted: string;
    secondary: string;
  };
  typography: { fontFamily: string; typeScale: string };
  layout: { radius: string; density: string; shadow: string; darkMode: string };
}

export interface AgentManifestMotion {
  scenarioName: string;
  variantId: string;
  variantName: string;
  framework: string | null;
}

function resolveStyle(state: FlowState): { style: VisualStyle; usedFallback: boolean } {
  if (state.visualStyle && VISUAL_STYLE_MAP[state.visualStyle]) {
    return { style: VISUAL_STYLE_MAP[state.visualStyle], usedFallback: false };
  }
  return { style: VISUAL_STYLE_MAP[DEFAULT_STYLE_ID] ?? VISUAL_STYLES[0], usedFallback: true };
}

/** 与 buildCssVariables 同一套取值逻辑，但输出结构化对象（供 Agent 编程读取） */
export function resolvedTokens(state: FlowState): ResolvedDesignTokens {
  const { style } = resolveStyle(state);
  const ds: DesignSystem = state.designSystem ?? {
    radius: null,
    font: null,
    type: null,
    density: null,
    shadow: null,
    scroll: null,
    darkMode: null,
    colorPrimary: null,
    colorSecondary: null,
  };
  const p = style.palette;

  const radius = ds.radius ? RADIUS_OPTIONS.find((r) => r.id === ds.radius)?.value ?? `${style.radius}px` : `${style.radius}px`;
  const font = ds.font ? FONT_OPTIONS.find((f) => f.id === ds.font)?.value ?? FONT_STACK[style.font] : FONT_STACK[style.font];
  const typeScale = ds.type ? TYPE_SCALE_TOKENS.find((t) => t.id === ds.type)?.css?.trim() ?? "" : "";
  const density = ds.density ? DENSITY_TOKENS.find((t) => t.id === ds.density)?.css?.trim() ?? "" : "";
  const shadow = ds.shadow ? SHADOW_TOKENS.find((t) => t.id === ds.shadow)?.css?.trim() ?? "" : "";
  const darkMode = ds.darkMode ?? "both";

  // 自定主/辅色覆盖风格 accent/accent2（与骨架工作台同一套逻辑）
  const primary = ds.colorPrimary && HEX.test(ds.colorPrimary) ? ds.colorPrimary : p.accent;
  const secondary = ds.colorSecondary && HEX.test(ds.colorSecondary) ? ds.colorSecondary : p.accent2;

  return {
    colors: {
      primary,
      background: p.bg,
      surface: p.surface,
      border: p.border,
      foreground: p.text,
      muted: p.muted,
      secondary,
    },
    typography: { fontFamily: font, typeScale },
    layout: { radius, density, shadow, darkMode },
  };
}

/** 蓝图页面 → 每个页面含组件与所选变体 */
function orderedPages(state: FlowState) {
  const order: string[] = [];
  const byPage = new Map<string, BlueprintEntry[]>();
  for (const e of state.pageBlueprint) {
    if (!order.includes(e.pageSlug)) order.push(e.pageSlug);
    const list = byPage.get(e.pageSlug) ?? [];
    list.push(e);
    byPage.set(e.pageSlug, list);
  }
  return order.map((slug) => {
    const page = SKELETON_PAGE_MAP[slug];
    return {
      pageSlug: slug,
      pageName: page?.name ?? slug,
      components: (byPage.get(slug) ?? []).map((e) => {
        const comp = page?.components.find((c) => c.id === e.componentId);
        const variant = comp?.variants.find((v) => v.id === e.variantId) ?? comp?.variants[0];
        return {
          componentId: e.componentId,
          componentName: comp?.name ?? e.componentId,
          variantId: variant?.id ?? null,
          variantName: variant?.name ?? "默认",
          preview: variant?.["preview" as keyof typeof variant] ?? undefined,
        };
      }),
    };
  });
}

const STACK_PACKAGES: Record<string, { frontend: string[]; backend: string[]; database: string[] }> = {
  nextjs_supabase: { frontend: ["next", "react", "react-dom", "tailwindcss"], backend: ["@supabase/supabase-js", "@supabase/ssr"], database: ["supabase(postgres)"] },
  t3_app: { frontend: ["next", "react", "@trpc/react-query", "tailwindcss"], backend: ["@trpc/server", "zod", "@prisma/client"], database: ["postgresql(prisma)"] },
  remix_supabase: { frontend: ["@remix-run/react", "react", "@remix-run/node", "tailwindcss"], backend: ["@supabase/supabase-js", "@supabase/ssr"], database: ["supabase(postgres)"] },
  sveltekit_supabase: { frontend: ["svelte", "@sveltejs/kit", "@sveltejs/adapter-auto", "tailwindcss"], backend: ["@supabase/supabase-js", "@supabase/ssr"], database: ["supabase(postgres)"] },
  nuxt_firebase: { frontend: ["nuxt", "vue", "@nuxtjs/tailwindcss"], backend: ["firebase"], database: ["firestore"] },
  astro_supabase: { frontend: ["astro", "@astrojs/tailwindcss"], backend: ["@supabase/supabase-js"], database: ["supabase(postgres)"] },
  react_express: { frontend: ["react", "react-dom", "vite"], backend: ["express", "prisma", "@prisma/client"], database: ["postgresql(prisma)"] },
  django_postgres: { frontend: [], backend: ["django", "djangorestframework", "celery", "gunicorn"], database: ["postgresql"] },
  rails_postgres: { frontend: [], backend: ["rails", "sidekiq"], database: ["postgresql"] },
  laravel_vue: { frontend: ["vue", "vite", "@inertiajs/vue3"], backend: ["laravel/framework", "@inertiajs/inertia-laravel"], database: ["mysql|postgresql"] },
  springboot_vue: { frontend: ["vue", "vite", "pinia"], backend: ["spring-boot-starter-web", "spring-boot-starter-security", "mybatis-plus"], database: ["mysql|postgresql"] },
  go_react: { frontend: ["react", "vite"], backend: ["gin", "gorm"], database: ["postgresql|clickhouse"] },
  nextjs_appwrite: { frontend: ["next", "react", "tailwindcss"], backend: ["appwrite"], database: ["appwrite(postgresql)"] },
  cf_workers: { frontend: ["@cloudflare/workers-types"], backend: ["hono", "wrangler"], database: ["d1(sqlite)|r2|kv"] },
};

export function buildAgentManifest(state: FlowState): AgentManifest {
  const { style, usedFallback } = resolveStyle(state);
  const report = validateExport(state);
  const stack = state.techStack ? TECH_STACKS.find((t) => t.id === state.techStack) : undefined;
  const pkgs = stack ? STACK_PACKAGES[stack.id] : undefined;
  const uiLib = state.uiLibrary;
  const mainLib = uiLib?.main ? UI_LIBRARIES.find((l) => l.id === uiLib.main) : undefined;
  const addonLib = uiLib?.addon ? UI_LIBRARIES.find((l) => l.id === uiLib.addon) : undefined;
  const arch = resolveArchitecture(state.techStack);
  const projectType = state.projectType
    ? PROJECT_TYPES.find((t) => t.id === state.projectType)?.name ?? state.projectType
    : "未指定";

  const chosenVariants = Object.fromEntries(
    (Object.keys(state.componentVariants ?? {}) as (keyof typeof state.componentVariants)[]).map((dim) => {
      const id = state.componentVariants?.[dim] ?? null;
      const opt = id ? VARIANT_OPTIONS.find((o) => o.id === id) : undefined;
      return [dim, opt ? { id: opt.id, dimension: opt.dimension, name: opt.name, componentName: opt.componentName ?? null, preview: opt.preview } : { id: id ?? null, name: null }];
    }),
  );

  const motion = Object.fromEntries(
    Object.entries(state.motionSelections).map(([scenarioId, variantId]) => {
      const scenario = MOTION_SCENARIO_MAP[scenarioId];
      const variant = MOTION_VARIANT_MAP[variantId];
      return [scenarioId, { scenarioName: scenario?.name ?? scenarioId, variantId, variantName: variant?.name ?? variantId, framework: variant?.framework ?? null }];
    }),
  );

  return {
    schema: "xiye/agent-manifest@1",
    kind: "底座交接清单",
    meta: {
      projectName: state.projectInfo?.projectName ?? "你的产品",
      projectType,
      techStack: stack ? { id: stack.id, name: stack.name } : null,
    },
    stack: stack
      ? {
          id: stack.id,
          name: stack.name,
          frontend: stack.frontend,
          backend: stack.backend,
          database: stack.database,
          styling: stack.styling,
          aiIntegration: stack.aiIntegration,
          pattern: arch.kb.pattern,
          directoryTree: arch.kb.tree,
          packages: pkgs ?? { frontend: [], backend: [], database: [] },
        }
      : null,
    uiLibraries: {
      main: mainLib ? { id: mainLib.id, name: mainLib.name, framework: mainLib.framework, style: mainLib.style } : null,
      addon: addonLib ? { id: addonLib.id, name: addonLib.name } : null,
    },
    visualStyle: {
      id: style.id,
      name: style.name,
      sourceSkill: style.sourceSkill,
      usedFallback,
    },
    designTokens: resolvedTokens(state),
    componentVariants: chosenVariants,
    pages: orderedPages(state),
    motion: motion,
    architecture: {
      // 内核：目录树与分层落地见 docs/ARCHITECTURE.md
      file: "docs/ARCHITECTURE.md",
      layers: buildArchitectureView(state.techStack, state.pageBlueprint).layers.map((l) => ({
        id: l.layerId,
        name: l.layerName,
        path: l.path,
        pages: l.pages.map((p) => p.pageName),
      })),
    },
    constraints: [
      "设计 Token 必须原样落地：primary/background/foreground/字体/圆角/密度/暗色模式，不得自行换色",
      "目录结构、分层、数据流遵循 docs/ARCHITECTURE.md，不得为图省事改成扁平实现",
      "每个页面/组件/变体按本清单 pages 与 componentVariants 实现，跨层引用一律禁止",
      "所有含密钥的 AI 调用必须放服务端，禁止在浏览器 bundle 暴露模型密钥",
    ],
    bootstrap: (() => {
      const seed = buildSeedProject(state, resolveSeedTokens(state));
      return {
        seedDir: "seed/",
        runnable: seed.runnable,
        install: seed.runCommand.split(" && ")[0] ?? "npm install",
        dev: seed.runCommand.split(" && ").slice(1).join(" && ") || seed.runCommand,
        runCommand: seed.runCommand,
        frameworkLabel: seed.frameworkLabel,
        envVars: [
          { key: "DATABASE_URL", required: true, note: "数据库连接串（按所选栈）" },
          ...Object.keys(state.apiKeys ?? {}).map((k) => ({
            key: k,
            required: false,
            note: "AI/三方密钥，只进服务端 .env",
          })),
        ],
      };
    })(),
    acceptance: [
      "npm install && npm run dev 能启动，首页可见已套用视觉 token 的壳页面",
      "globals.css 的 :root token 与 DESIGN_SPEC.md 完全一致（primary/背景/字体/圆角/暗色）",
      "目录结构遵循 docs/ARCHITECTURE.md，无扁平化、无跨层引用",
      "pages 清单中每个页面/组件/变体均已实现，无占位 TODO",
      "motion 指定的动效已按 framework 接入，参数与 MOTION.md 一致",
      "AI 调用全部在服务端，浏览器 bundle 无密钥",
      "暗色模式按 designTokens.layout.darkMode 生效",
    ],
    rules: {
      do: [
        "以 seed/ 为起点做增量开发，不要另起炉灶重建工程",
        "先落地 globals.css token + tailwind 主题，让视觉基线先生效",
        "按 pages 逐页装配组件，componentVariants 决定实现类与预览类",
        "AI 能力收敛到服务端（stack.aiIntegration），前端只读流",
        "完成后按 deliverable 格式回执，附启动截图",
      ],
      dont: [
        "不要自行换色或改字体/圆角（视觉基线由 token 锁定）",
        "不要把目录改扁平或跨层引用（架构边界见 ARCHITECTURE.md）",
        "不要在浏览器 bundle 暴露任何密钥",
        "不要跳过验收清单中的任一项就声称完成",
      ],
    },
    deliverable: {
      format: "完成回执（markdown）",
      fields: [
        "启动命令与运行截图（证明 npm run dev 可跑）",
        "验收清单逐项勾选结果",
        "已实现页面/组件清单（对照 pages）",
        "未完成项与阻塞原因（若有）",
        "复跑命令（供用户一键验证）",
      ],
    },
    consistency: { ok: report.ok, issues: report.issues, warnings: report.warnings },
    referenceFiles: [
      "seed/ — 可运行底座工程（依赖/配置/入口/壳页面已套 token）",
      "docs/ARCHITECTURE.md — 工程架构（目录/分层/数据流/落点）",
      "docs/DESIGN_SPEC.md — 视觉与技术规范（token/组件/动效/暗色）",
      "docs/SKELETON.md — 页面骨架说明",
      "docs/MOTION.md — 动效规范",
      "globals.css — :root 设计 token",
      "tailwind.config.ts — 主题片段",
      "xiye.config.json — 原始流程配置",
    ],
  };
}

export function buildAgentHandoffMd(state: FlowState, report: ConsistencyReport): string {
  const manifest = buildAgentManifest(state);
  const stack = state.techStack ? TECH_STACKS.find((t) => t.id === state.techStack) : undefined;
  const projName = state.projectInfo?.projectName ?? "你的产品";
  const typeName = state.projectType
    ? PROJECT_TYPES.find((t) => t.id === state.projectType)?.name ?? state.projectType
    : "（未指定）";
  const seed = buildSeedProject(state, resolveSeedTokens(state));

  const pagesLines = manifest.pages
    .map((p) => `- **${p.pageName}**：${p.components.map((c) => `${c.componentName}（${c.variantName}）`).join("、") || "（待补全）"}`)
    .join("\n") || "- （尚未把组件加入蓝图）";

  const tokenLine = `primary=${manifest.designTokens.colors.primary} · 字体=${manifest.designTokens.typography.fontFamily} · 圆角=${manifest.designTokens.layout.radius} · 暗色=${manifest.designTokens.layout.darkMode}`;

  const acceptanceLines = manifest.acceptance.map((a) => `- [ ] ${a}`).join("\n");
  const acceptanceChecked = manifest.acceptance.map((a) => `- [x] ${a}`).join("\n");
  const doLines = manifest.rules.do.map((d) => `- ${d}`).join("\n");
  const dontLines = manifest.rules.dont.map((d) => `- ${d}`).join("\n");

  return `# AI 交接指令（AI_HANDOFF）

> 把本文件连同同目录的 \`xiye.agent.json\` 一起交给 AI 开发 Agent，作为其开工的「总纲」。
> 你的角色：工程负责人，负责把下面这份规格按所选技术栈落地为可运行底座与界面。

## 一、任务

标定一个产品：**${projName}**（${typeName}）${stack ? `，框架方案 **${stack.name}**（${stack.frontend} / ${stack.backend} / ${stack.database}）` : ""}。
请按本技能交付：能跑起来的项目骨架、技术栈代码目录、视觉规范落地、蓝图各页面与组件、动效。

## 二、开工起点（seed/ 可运行底座）

**不要从零搭工程。** \`seed/\` 已按所选技术栈生成可运行骨架：依赖锁定版本、目录按架构铺好、壳页面已套用设计 token。

\`\`\`bash
cd seed
${seed.runCommand}
\`\`\`

启动后首页即显示已套用视觉风格的壳页面，在此之上做增量开发。

## 三、必须先读、且必须按它实现的文件

1. \`docs/PRD.md\` —— 产品需求（范围 / 功能 / 优先级），AI 开发的功能依据：先界定做什么。
2. \`seed/\` —— **可运行底座**：依赖/配置/入口/壳页面，开工起点。
3. \`docs/ARCHITECTURE.md\` —— 工程目录、分层边界、数据流。**目录结构照此落地，不得改成扁平实现。**
4. \`docs/DESIGN_SPEC.md\` —— 设计 token、组件规范、动效、暗色。**token 必须原样落地。**
5. \`docs/SKELETON.md\` 与 \`docs/MOTION.md\` —— 各页面的区块与动效细节。
6. \`globals.css\`（:root token）与 \`tailwind.config.ts\` —— 直接可用的主题起点。

## 四、硬性约束

- **不改设计**：视觉基线 = ${tokenLine}。任何偏离都需要在此总纲明确授权。
- **冲突以 globals.css 为准**：若 \`docs/DESIGN_SPEC.md\` / \`seed/AGENTS.md\` / \`xiye.config.json\` 间色彩或字体矛盾，一律以 \`globals.css\` 的 :root 为唯一真值，其余对齐之；存疑先提示用户确认。
- **不悬空引用**：本包已通过一致性自检（以下）${report.ok ? "，无悬空引用。" : "，存在需人工确认的问题，见文末。"}
- **密钥安全**：所有含密钥的 AI 调用必须放服务端；浏览器 bundle 不得出现模型密钥。
- **按清单搭页面**：
${pagesLines}

## 五、DO 与 DON'T

**DO**
${doLines}

**DON'T**
${dontLines}

## 六、实现顺序建议

1. \`cd seed && ${seed.runCommand}\` 先跑起来，确认壳页面与视觉 token 生效。
2. 落地 \`globals.css\` 的 :root token + tailwind 主题（seed 已含，核对一致即可）。
3. 逐页按 \`pages\` 装配组件（componentVariants 对应的实现类与预览类）。
4. 接入 \`motion\` 指定的动效（framework 决定用 gsap / lenis / css）。
5. 把 AI 能力按 \`stack.aiIntegration\` 收敛到服务端，前端只读流。

## 七、验收清单（完成后逐项自证）

${acceptanceLines}

## 八、完成回执（按此格式交付给用户）

\`\`\`markdown
## 完成回执
- 启动命令：\`${seed.runCommand}\`
- 运行截图：<附首页截图，证明可运行且视觉 token 生效>
- 验收清单：
${acceptanceChecked}
- 已实现页面/组件：<对照 pages 清单>
- 未完成项与阻塞原因：<若无则写「无」>
- 复跑命令：\`${seed.runCommand}\`
\`\`\`

## 九、一致性结果

- 状态：${report.ok ? "✅ 通过" : "⚠ 存在悬空引用"}
${report.warnings.length ? `- 提示：${report.warnings.join("；")}` : "- 提示：无"}
${report.issues.length ? `- 需人工处理：${report.issues.join("；")}` : "- 无悬空引用"}

> 由 xiye 流程工作台生成 · 机器清单见 \`xiye.agent.json\` · 原始配置见 \`xiye.config.json\`
`;
}