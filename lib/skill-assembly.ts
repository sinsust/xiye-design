// 技能自动装配：把「知识库 / 本地 skill 仓库」里的技能，在开发流程中按当前任务场景与
// 技术栈自动匹配、安装到目标项目，并在 AI 联网发现新技能时自动贡献回共享知识库。
//
// 设计约束（对应需求：高保真 > 完整 > 可生长）：
//  - 安装的是「技能」本身（复制/克隆到项目 skills 目录），不改动用户业务逻辑；
//  - 已安装 / AI 宿主已有更强内置 → 跳过，避免冗余与冲突；
//  - AI 发现的技能：直接写入共享知识库（贡献人=当前登录账号，由服务端 session 带，AI 不自填）。
//
// 本文件只产出「注入串 + 纯匹配函数」，不含 IO；实际安装/写库由 AI 在开发中执行或调用 API。

import {
  SKILL_CATALOG,
  ALL_STACKS,
  type Skill,
} from "@/data/skill-catalog";

export interface SkillContext {
  /** 当前项目技术栈 ID（与 data/skill-catalog.ts 的 ALL_STACKS 对齐；可空 = 通用） */
  stack?: string;
  /** 当前开发场景关键词，如 视觉规范 / 代码健康度 / 动效 / 文案 / 架构 */
  scenarios?: string[];
  /** 额外标签，如 landing / dashboard / 移动端 */
  tags?: string[];
}

/**
 * 按场景 / 技术栈 / 标签从精选目录匹配技能（纯函数，供注入串描述与 UI 复用）。
 * - 技术栈：compatibleStacks 为空（通用）或命中 stack 即视为栈匹配；
 * - 场景：scenario 与 contexts.scenarios 有交集即命中；
 * - 标签：tags 交集作为加分项，但不强制。
 */
export function matchSkillsForContext(ctx: SkillContext): Skill[] {
  const stack = ctx.stack;
  const wantedScenarios = new Set(ctx.scenarios ?? []);
  const wantedTags = new Set(ctx.tags ?? []);

  return SKILL_CATALOG.filter((s) => {
    const stackOk =
      !stack ||
      s.compatibleStacks.length === 0 ||
      s.compatibleStacks.includes(stack);
    if (!stackOk) return false;

    if (wantedScenarios.size > 0) {
      const hit = (s.scenario ?? []).some((sc) => wantedScenarios.has(sc));
      if (!hit) return false;
    }
    // 标签仅作软过滤：无场景需求但有标签需求时，要求标签存在交集
    if (wantedScenarios.size === 0 && wantedTags.size > 0) {
      const tagHit = s.tags.some((t) => wantedTags.has(t));
      if (!tagHit) return false;
    }
    return true;
  });
}

export const SKILL_ASSEMBLY_INJECTION = `【技能自动装配（来源：xiye 知识库 type:"skill" + 本地 skill 仓库 data/skill-catalog.ts；可在 /library 浏览深做）】

你在「开发 / 生成代码」阶段，应主动借助已有技能加速交付，并让知识库持续生长：

1) 何时查技能：每接到一个开发任务，先按「任务场景 + 技术栈」判断是否需要专项技能。常见场景与对应技能举例：
   - 视觉规范 / 高端设计 / landing → design-taste-frontend、high-end-visual-design、design-kungfu、image-to-code；
   - 代码健康度 / 质量门禁 / 安全 / 测试 → code-quality-checker；
   - 动效 / GSAP → gpt-taste；
   - 重设计现有项目 → redesign-existing-projects；
   - 需要找更多能力 → find-skills（搜索并安装 Agent Skills）。
   也可调用知识库检索（RAG 命中 type:"skill" 的共享条目，含 repoUrl）获得社区贡献的技能。

2) 如何安装（集成到当前项目，不改动用户业务代码）：
   - 本地仓库技能（source:"local"，有 filePath）：把该 skill 文件夹复制到当前项目的 skills 目录（如 .workbuddy/skills/<id>/SKILL.md）；
   - 外部技能（有 github / repoUrl）：按仓库说明安装或克隆到项目 skills 目录。
   安装后即时可用，后续同类任务直接调用。

3) 去重 / 跳过（避免冗余与冲突）：
   - 目标项目 skills 目录已存在同名技能 → 跳过；
   - 你（AI 宿主）已内置等价或更强的同功能技能 → 用内置，跳过安装；
   - 内置明显更优时优先内置，仅在本地/外部技能更强时才安装它。

4) 自动反哺（发现即贡献，让知识库生长）：
   - 若你在联网检索 / 阅读资料时发现「本项目适用、但知识库与本地目录都没有」的技能，应自动把它贡献到共享知识库：调用
     POST /api/knowledge ，body = { type: "skill", name, repoUrl, body, summary, useCase, tags }；
   - 贡献人（当前登录账号邮箱）由服务端 session 自动带上，你**不要**在 body 里写任何邮箱/账号；
   - 来源标记 source:"auto"。用户之后可在 /library 查看、删除你贡献的条目。
   - 只贡献「确实可复用、带公开仓库地址、且说明清楚干嘛用」的技能；无地址或低质的一律不贡献。`;
