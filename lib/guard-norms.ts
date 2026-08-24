// 规范师（开发规范守门员）的「预置规范库」。
// 规范师产出的开发边界规范是通用、可复用的知识，不依赖具体项目，因此无需每次调用大模型、
// 消耗 token。这里把已选定/检索到的通用规范提前写死成一份受管的目录，
// 规范师会诊时直接从中提取相关条目返回（对外表现为一次会诊，实际走本地一次性拼装）。

// 视觉与品味规范来自 taste-skill（Anti-Slop 前端 skill）等已装载技能；
// 代码规范来自 Clean Code 方法论 + AGENTS.md 工程协作惯例。

export interface GuardSubject {
  /** 分组名，作为每条规范的前缀标签 */
  group: string;
  /** 来源技能名 */
  source: string;
  /** 该组的规范条目（每条一行，简明可执行） */
  rules: string[];
}

export const GUARD_SUBJECTS: GuardSubject[] = [
  {
    group: "视觉",
    source: "taste-skill「Anti-Slop」",
    rules: [
      "动手前先读 brief：辨析页面类型、情绪词、目标受众、既有品牌资产，并输出一行「Design Read」定基调，避免跳到默认审美。",
      "反默认：不自动使用 AI 紫渐变、居中 Hero+暗色网格、三张等宽特性卡、全站玻璃拟态、无限循环微动效、Inter+slate-900 这类 LLM 默认组合。",
      "三旋钮先行：先定 设计差异 / 动效强度 / 视觉密度 三档，再据其约束布局、动效与密度，不随手东拼西凑。",
      "能上真实设计系统就用官方包（一项目一套、不混用），不手搓官方已存在的 CSS。",
      "排版：默认无衬线 display（Geist / Outfit / Satoshi / Cabinet Grotesk 等）；默认禁用衬线（尤其 Fraunces / Instrument_Serif）；强调用同字族的粗/斜，不混族。",
      "颜色：全站最多 1 个强调色、饱和度默认<80%；默认禁 AI 紫/蓝光；「暖米白+铜/赭/深棕」这类 premium 高频 tell 默认也禁；一旦选定强调色须全页锁定不得中途变色。",
      "图标：用官方图标库（Phosphor / HugeIcons / Radix / Tabler），禁手绘 SVG，一项目一系，默认不用 lucide；emoji 默认禁用，改图标库字形。",
      "响应式与布局：全高用 min-h-[100dvh] 而非 h-screen；多列用 Grid 而非 flex 百分比；统一断点与最大宽度容器。",
    ],
  },
  {
    group: "代码",
    source: "Clean Code 方法论 + 各语言 AGENTS.md 惯例",
    rules: [
      "函数小而单一职责：命名即文档、参数尽量<3、无隐藏副作用、重复抽出（DRY）。",
      "注释默认最小化：只解释 WHY 而非 WHAT；过时注释比缺失更有害，随代码同步维护。",
      "命名：类/组件大驼峰、函数/变量小驼峰、常量全大写下划线；布尔用 is/has/can 前缀；禁止拼音/缩写。",
      "公开 API 与复杂逻辑必须有类型与必要文档；不放密钥进仓库，.env 不进库、不入交付包。",
      "测试快、边界感知、可重复；关键路径可被脚本化验收覆盖。",
      "引入三方库前先查 package.json 是否已安装，缺失先输出安装命令，不默认假设库存在。",
    ],
  },
  {
    group: "协作",
    source: "AGENTS.md 工程协作惯例",
    rules: [
      "把 AGENTS.md / 交接文档当代码：版本化、评审、定期清理——过时规则害大于缺。",
      "格式交给 linter / 既有工具定，不在配置里手工描述格式化规则（保持单一事实来源）。",
      "契约从简单起步，遇到具体问题再加复杂度，不预造复杂层级。",
      "不得静默跳过需求：任何卡住的条目都要停下说明阻塞与可选方案，等确认再继续。",
    ],
  },
  {
    group: "安全",
    source: "xiye 安全开发守则",
    rules: [
      "敏感接口必须鉴权；AI 与登录/注册接口限流防刷。",
      "密钥只走服务端环境变量，不进前端、不进代码库、不入 zip。",
      "DB 变更走迁移；错误信息不泄露内部细节；CSRF 防护。",
      "交付前通过脚本化自检（token 一致性 / 目录分层 / 无 TODO·FIXME / 无密钥泄漏），全部通过才能算完成。",
    ],
  },
];

/** 展平为「[组] 规范」的条目数组 */
export function buildGuardNormDetails(): string[] {
  const out: string[] = [];
  for (const s of GUARD_SUBJECTS) {
    for (const r of s.rules) {
      out.push(`【${s.group}】${r}`);
    }
  }
  return out;
}

/** 只取指定分组（按关键词「视觉」等），供按需裁剪 */
export function buildGuardNormDetailsByGroup(keys: string[]): string[] {
  const wanted = new Set(keys);
  const out: string[] = [];
  for (const s of GUARD_SUBJECTS) {
    if (!wanted.size || wanted.has(s.group)) {
      for (const r of s.rules) out.push(`【${s.group}】${r}`);
    }
  }
  return out;
}

export function guardSummary(): string {
  const groups = GUARD_SUBJECTS.map((s) => s.source);
  return `已从预置规范库（${groups.join(" / ")}）提取开发边界规范，不消耗模型 token。`;
}

/** 落盘为 docs/GUARD_NORMS.md，随工程交付给 AI 编码工具 */
export function buildGuardNormsMd(): string {
  const groups = GUARD_SUBJECTS.map(
    (s) => `## ${s.group}规范（来源：${s.source}）

${s.rules.map((r) => `- ${r}`).join("\n")}
`,
  ).join("\n");
  return `# 开发边界规范（Guard Norms）

> 由 xiye 流程工作台的「规范师」从预置技能库提取，为通用规则、不依赖具体项目。
> 视觉/品味规范来自 taste-skill（Anti-Slop），代码规范来自 Clean Code 方法论，协作规范来自 AGENTS.md 工程惯例。

${groups}
`;
}