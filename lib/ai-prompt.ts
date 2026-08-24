// 生成「AI 初始化提示词」：一段可直接粘贴进任意 AI 编程工具（Cursor / Codex / WorkBuddy /
// TRAE / Qoder 等）的开工指令。用户把解压后的整套导出放进某个工具并打开工程后，
// 把这段提示词一贴，AI 即按既有约定进入开工状态——无需 AI「碰巧读到」交接文档。

import type { FlowState } from "@/lib/store/flow-store";
import { TECH_STACKS } from "@/data/tech-stacks";
import { UI_LIBRARIES } from "@/data/ui-libraries";
import { PROJECT_TYPES } from "@/data/project-types";
import { MOTION_SCENARIO_MAP, MOTION_VARIANT_MAP } from "@/data/motion-library";
import { buildSeedProject, resolveSeedTokens } from "@/lib/seed-project";
import { buildAgentManifest, type AgentManifest } from "@/lib/agent-manifest";
import {
  resolvePositioning,
  inferFeatureDetails,
  inferKeyModules,
  inferProjectTypeName,
} from "@/lib/project-narrative";

/** 页面 → 组件（变体）的装配清单文本 */
function blueprintLines(manifest: AgentManifest): string {
  const pages = manifest.pages;
  if (!pages.length) return "- （尚未把组件加入蓝图）";
  return pages
    .map((p) => {
      const comps = p.components
        .map((c) => `${c.componentName}（${c.variantName}）`)
        .join("、");
      return `- **${p.pageName}**：${comps || "（待补全）"}`;
    })
    .join("\n");
}

/** 动效清单文本 */
function motionLines(state: FlowState): string {
  const entries = Object.entries(state.motionSelections ?? {});
  if (!entries.length) return "（未设置专项动效）";
  return entries
    .map(([scenarioId, variantId]) => {
      const s = MOTION_SCENARIO_MAP[scenarioId];
      const v = MOTION_VARIANT_MAP[variantId];
      return `- ${s?.name ?? scenarioId} → ${v?.name ?? variantId}`;
    })
    .join("\n");
}

/**
 * 生成给 AI 编程工具的开场提示词。
 * UI 展示 + 写进交付（docs/AI_PROMPT.md），两者共用同一函数，保证一致。
 */
export function buildAiKickoffPrompt(state: FlowState): string {
  const report = buildAgentManifest(state);
  const seed = buildSeedProject(state, resolveSeedTokens(state));

  const projName = state.projectInfo?.projectName ?? "你的产品";
  const stack = report.stack;
  const tk = report.designTokens;
  const stackPkgs = stack?.packages;
  const stackLine =
    stack && stackPkgs
      ? `- 技术栈：${stack.name}｜${stack.frontend} / ${stack.backend} / ${stack.database}\n  依赖：${stackpkg(stackPkgs.frontend, stackPkgs.backend, stackPkgs.database)}`
      : "";

  const doLines = report.rules.do.map((d: string) => `- ${d}`).join("\n");
  const dontLines = report.rules.dont.map((d: string) => `- ${d}`).join("\n");

  return `你是一名资深全栈工程师。当前打开的工程，是由 xiye 流程工作台生成的「设计底座」。请你按下面这份总纲，把底座开发成真正能跑、且符合既有技术栈与视觉规范的产品。

# 产品定位
- 产品：**${projName}**（${inferProjectTypeName(state)}）
- 定位：${resolvePositioning(state)}
- 特点：
${(inferFeatureDetails(state).map((f) => f.desc ? `  - **${f.name}**：${f.desc}` : `  - ${f.name}`).join("\n") || "  - （暂无）")}
- 关键模块：${inferKeyModules(state).join("、") || "按架构铺开核心流程（见 BLUEPRINT）"}
${stackLine}

# 开工方式（不要从零搭工程）
\`seed/\` 已按所选技术栈生成可运行底座：依赖锁定、目录按架构铺好、壳页面已套用设计 token。
先把它跑起来，再在此之上做增量开发：

\`\`\`bash
cd seed
${seed.runCommand}
\`\`\`

启动后首页即为已套视觉风格的壳页面。

# 必须先读、并按它实现的文件
1. \`docs/PRD.md\` —— 产品需求（范围 / 功能清单 / 优先级），是 AI 开发的功能依据：先读它界定「做什么」
2. \`seed/AGENTS.md\`、\`seed/CLAUDE.md\` —— 开发约定（主流 AI 工具打开工程会自动加载）
3. \`docs/AI_HANDOFF.md\` —— 交接总纲
4. \`xiye.agent.json\` —— 机器可读清单（栈 / 页面 / token / 动效 / 约束）
5. \`docs/ARCHITECTURE.md\` —— 架构（目录 / 分层 / 数据流）。目录结构照此落地，不得改成扁平实现
6. \`docs/DESIGN_SPEC.md\`、\`docs/SKELETON.md\`、\`docs/MOTION.md\` —— 视觉与技术规范
7. \`seed/BLUEPRINT.md\` —— 页面路由与组件占位已生成，按它装配
8. \`seed/DATA_CONTRACT.md\` —— 数据模型与 API 契约

# 视觉基线（锁定，未经授权不得更改）
- 主色 primary = \`${tk.colors.primary}\` ｜ 字号/字体 = \`${tk.typography.fontFamily}\` ｜ 圆角 = \`${tk.layout.radius}\` ｜ 暗色 = \`${tk.layout.darkMode}\`
- token 见 \`globals.css\` 的 :root 与 \`tailwind.config.ts\` 映射。任何换色/改字体/改圆角都需用户明确授权。

# 冲突处理（文档间不一致时）
- 若发现 \`docs/DESIGN_SPEC.md\` / \`seed/AGENTS.md\` / \`xiye.config.json\` 之间色彩或字体矛盾，**一律以 \`styles/globals.css\` 的 \`:root\` 为唯一真值**，其余文档对齐之。
- 仍存疑时，先提示用户确认再改；不要凭推测静默覆盖 token。

# 页面与组件（按蓝图逐页装配）
${blueprintLines(report)}

# 专项动效
${motionLines(state)}

# DO 与 DON'T
**DO**
${doLines}

**DON'T**
${dontLines}

# 分步开发节奏（务必逐阶段推进，禁止一次全做完）
以 \`docs/PRD.md\` 第 4 节列出的页面优先级为准，分 3 个阶段增量开发。**每一阶段完成即停下，输出「完成清单」并等待确认后，才可进入下一阶段**——不要在未确认时继续写业务代码：

**Phase 0（底座跑通）**
- 任务：\`cd seed\` 启动成功；首页壳页面正常渲染；按上面「必须先读」顺序把文件读完并确认理解了文档间的依赖关系。
- 完成输出：标记「Phase 0 完成」，贴启动日志/截图 + \`verify.mjs\` 通过项，列出你认为接下来最该先做的页面。
- 等待我确认 → 进入 Phase 1。

**Phase 1（P0 核心链路）**
- 任务：仅实现 \`docs/PRD.md\` 里标记为 **P0·核心** 的页面与功能，打通端到端主流程，暂不做美观润色与 P1/P2。
- 完成输出：列「已实现清单」（页面/接口/组件 + 各自验收证据），并对照 PRD 逐条勾选，明确「P0 无遗漏」；再跑一次自检。
- 等待我确认 → 进入 Phase 2。

**Phase 2（P1→P2 完善 + 打磨）**
- 任务：实现 **P1·重要** 页面与能力，再按需实现 **P2·辅助**；视觉/动效按 DESIGN_SPEC 打磨。本期非目标（见 PRD 第 8 节）不要越界实现。
- 完成输出：同 Phase 1 的完整清单 + 最终自检 + 复跑命令，并按 AI_HANDOFF 的「完成回执」格式交付（启动截图 + 验收逐项结果 + 已实现清单）。

**防遗漏硬性要求**
- 每阶段结束前，把该阶段所有页面/功能与 PRD 逐条勾对：凡有未实现必须列出原因，**不得静默跳过**。
- 任何一条被卡住时，停下来向我说明阻塞点与可选方案，等我答复再继续，禁止自行降级或换方案。

# 完成验收
运行 seed 自检：
\`\`\`bash
cd seed && node scripts/verify.mjs
\`\`\`
需全部通过（token 一致性 / 目录分层 / 交接文件 / 蓝图落盘 / 无 TODO / 无密钥泄漏）。通过后按 docs/AI_HANDOFF.md 的「完成回执」格式交付：启动截图 + 验收逐项结果 + 已实现页面/组件清单 + 复跑命令。

现在开始：先读上述文件，然后 \`cd seed\` 按「分步开发节奏」的 Phase 0 → 1 → 2 逐阶段把页面与组件实现出来，每阶段结束后停下来等我确认。`;
}

/** 辅助内联技术栈依赖用 */
function stackpkg(frontend: string[], backend: string[], database: string[]): string {
  const parts: string[] = [];
  if (frontend?.length) parts.push(`前端依赖 ${frontend.join(", ")}`);
  if (backend?.length) parts.push(`后端依赖 ${backend.join(", ")}`);
  if (database?.length) parts.push(`数据库 ${database.join(", ")}`);
  return parts.length ? `（${parts.join("；")}）` : "";
}