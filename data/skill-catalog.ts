// Skill 目录数据。
// 内容来自本地 skill 仓库 D:\workspace\skill（TRAE Skills 规范：.agents/skills/<name>/SKILL.md）。
// IDE 会自动扫描 skills 目录下的 SKILL.md 并按需加载——这就是「集成」的本质：
// 把选中 skill 的文件夹复制到目标项目的 skills 目录（WorkBuddy 为 .workbuddy/skills/）。
//
// 本文件由读取 D:\workspace\skill\.agents\skills\* 的真实 SKILL.md 整理而成，非占位数据。

// 全部可用技术栈 ID（与 Step 3 对齐）。
export const ALL_STACKS = [
  "nextjs_supabase",
  "nuxt_firebase",
  "react_express",
  "astro_supabase",
] as const;

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: "ai" | "data" | "ui" | "devops" | "integration" | "utility";
  filePath: string; // 在 skill 仓库中的相对路径
  fileType: string; // 文件类型（md/json/yaml/ts/py 源等）
  compatibleStacks: string[]; // 兼容的技术栈 ID（空数组 = 通用，适用任何栈）
  tags: string[]; // 标签
  /** 适用开发场景（用于流程中按当前任务自动装配）：如 视觉规范 / 代码健康度 / 动效 / 文案 / 架构 */
  scenario?: string[];
  /** GitHub / 仓库地址（AI 发现或贡献的技能填；本地仓库技能留空，走 filePath 复制安装） */
  github?: string;
  /** 来源：local=本地 skill 仓库；github=外部仓库；auto=AI 联网发现并自动贡献 */
  source?: "local" | "github" | "auto";
  /** 贡献人（邮箱/账号）；本地内置为空，auto 类由当前登录账号自动带 */
  contributor?: string;
}

export const SKILL_CATEGORIES = [
  { id: "ai", label: "AI 能力", icon: "Brain" },
  { id: "data", label: "数据处理", icon: "Database" },
  { id: "ui", label: "UI/交互", icon: "Layout" },
  { id: "devops", label: "DevOps", icon: "Server" },
  { id: "integration", label: "第三方集成", icon: "Plug" },
  { id: "utility", label: "工具类", icon: "Wrench" },
];

// 本地 skill 仓库根目录（AI 读取来源，也是「一键集成」的复制源根）。
// 生产/CI 通过环境变量 SKILL_REPO_ROOT 注入；未配置时为空（依赖该目录的能力自动降级/拒绝）。
export const SKILL_REPO_ROOT = process.env.SKILL_REPO_ROOT ?? "";

// UI/设计类技能面向任意 Web 框架，标记兼容全部技术栈。
const UI = [...ALL_STACKS] as string[];

export const SKILL_CATALOG: Skill[] = [
  {
    id: "1688-sourcing-inquiry",
    name: "1688 采购询盘寻源",
    description:
      "把模糊的采购需求转化为结构化询盘，由平台匹配合适供应商与报价方案。",
    category: "integration",
    filePath: ".agents/skills/1688-sourcing-inquiry",
    fileType: "md",
    compatibleStacks: [],
    tags: ["采购", "询盘", "电商"],
  },
  {
    id: "brand-design-md",
    name: "品牌设计规范生成",
    description:
      "根据品牌名从 getdesign.md 自动获取设计规范并生成匹配风格的 UI 代码，支持 62 个顶级品牌。",
    category: "ui",
    filePath: ".agents/skills/brand-design-md",
    fileType: "md",
    compatibleStacks: UI,
    tags: ["品牌", "UI", "设计系统"],
  },
  {
    id: "brandkit",
    name: "Premium 品牌视觉生成",
    description:
      "品牌规范板、Logo 系统、视觉世界演示，覆盖极简 / 暗黑科技 / 奢华 / 开发者工具等风格。",
    category: "ui",
    filePath: ".agents/skills/brandkit",
    fileType: "md",
    compatibleStacks: UI,
    tags: ["品牌", "视觉", "logo"],
  },
  {
    id: "code-quality-checker",
    name: "代码质量检测",
    description:
      "多维度质量检测：代码规范、安全漏洞、性能问题、测试覆盖率、依赖审计、复杂度分析。",
    category: "utility",
    filePath: ".agents/skills/code-quality-checker",
    fileType: "md",
    compatibleStacks: [],
    tags: ["质量", "lint", "安全", "测试"],
    scenario: ["代码健康度", "质量门禁", "安全", "测试"],
    source: "local",
  },
  {
    id: "design-kungfu",
    name: "智能设计推荐",
    description:
      "分析 Web 应用需求，从 130+ 设计风格中智能匹配最佳方案，提供完整设计系统与 shadcn/ui 指南。",
    category: "ui",
    filePath: ".agents/skills/design-kungfu",
    fileType: "md",
    compatibleStacks: UI,
    tags: ["设计", "推荐", "shadcn"],
  },
  {
    id: "design-taste-frontend",
    name: "Anti-slop 前端设计",
    description:
      "读取 brief 推断设计方向，产出不像模板的界面；重设计先做审计，严格的预检清单。",
    category: "ui",
    filePath: ".agents/skills/design-taste-frontend",
    fileType: "md",
    compatibleStacks: UI,
    tags: ["前端", "设计", "landing"],
    scenario: ["视觉规范", "前端设计", "landing"],
    source: "local",
  },
  {
    id: "design-taste-frontend-v1",
    name: "设计品味 v1（兼容版）",
    description:
      "v1 原版保留，仅在与默认 v2 行为不兼容的旧项目中使用。",
    category: "ui",
    filePath: ".agents/skills/design-taste-frontend-v1",
    fileType: "md",
    compatibleStacks: UI,
    tags: ["前端", "设计", "兼容"],
  },
  {
    id: "find-skills",
    name: "发现并安装 Skill",
    description:
      "当用户想扩展能力时，搜索并安装可安装的 Agent Skills。",
    category: "utility",
    filePath: ".agents/skills/find-skills",
    fileType: "md",
    compatibleStacks: [],
    tags: ["skill", "发现", "安装"],
    scenario: ["技能发现", "技能安装"],
    source: "local",
  },
  {
    id: "full-output-enforcement",
    name: "完整输出强制",
    description:
      "覆盖 LLM 截断行为，禁止占位符，干净处理 token 上限拆分。",
    category: "utility",
    filePath: ".agents/skills/full-output-enforcement",
    fileType: "md",
    compatibleStacks: [],
    tags: ["输出", "防截断"],
  },
  {
    id: "gpt-taste",
    name: "UX/UI & GSAP 动效",
    description:
      "Elite UX/UI 与 GSAP 动效工程师：随机布局、AIDA 结构、严格滚动动效。",
    category: "ui",
    filePath: ".agents/skills/gpt-taste",
    fileType: "md",
    compatibleStacks: UI,
    tags: ["UX", "动效", "GSAP"],
  },
  {
    id: "high-end-visual-design",
    name: "高端视觉设计标准",
    description:
      "定义字体 / 间距 / 阴影 / 卡片 / 动画，让网站显得昂贵，屏蔽廉价通用 AI 风。",
    category: "ui",
    filePath: ".agents/skills/high-end-visual-design",
    fileType: "md",
    compatibleStacks: UI,
    tags: ["视觉", "高端", "设计"],
    scenario: ["视觉规范", "高端设计"],
    source: "local",
  },
  {
    id: "imagegen-frontend-mobile",
    name: "移动端图像生成",
    description:
      "iOS / Android / 跨平台高质量屏幕概念与流程（仅出图，不写代码）。",
    category: "ui",
    filePath: ".agents/skills/imagegen-frontend-mobile",
    fileType: "md",
    compatibleStacks: UI,
    tags: ["移动端", "图像", "设计"],
  },
  {
    id: "imagegen-frontend-web",
    name: "网页设计图像生成",
    description:
      "为每个 section 生成独立横向参考图，统一调性，适用于落地页与营销站。",
    category: "ui",
    filePath: ".agents/skills/imagegen-frontend-web",
    fileType: "md",
    compatibleStacks: UI,
    tags: ["网页", "图像", "设计"],
  },
  {
    id: "image-to-code",
    name: "图像转代码",
    description:
      "先生成设计图并深度分析，再实现高度还原的网站。",
    category: "ui",
    filePath: ".agents/skills/image-to-code",
    fileType: "md",
    compatibleStacks: UI,
    tags: ["图像", "代码", "前端"],
  },
  {
    id: "industrial-brutalist-ui",
    name: "工业野兽派 UI",
    description:
      "瑞士排版 + 军事终端美学，刚性网格、极端字号对比、工业降级效果。",
    category: "ui",
    filePath: ".agents/skills/industrial-brutalist-ui",
    fileType: "md",
    compatibleStacks: UI,
    tags: ["UI", "野兽派", "dashboard"],
  },
  {
    id: "minimalist-ui",
    name: "极简编辑风 UI",
    description:
      "暖色单色调、排版对比、扁平 bento 网格、柔和粉彩，无渐变无重阴影。",
    category: "ui",
    filePath: ".agents/skills/minimalist-ui",
    fileType: "md",
    compatibleStacks: UI,
    tags: ["UI", "极简", "bento"],
  },
  {
    id: "redesign-existing-projects",
    name: "现有项目重设计",
    description:
      "审计当前设计、识别通用 AI 模式、在不破坏功能的前提下提升到高端标准。",
    category: "ui",
    filePath: ".agents/skills/redesign-existing-projects",
    fileType: "md",
    compatibleStacks: UI,
    tags: ["重设计", "审计", "UI"],
  },
  {
    id: "setup-matt-pocock-skills",
    name: "Agent 工程技能配置",
    description:
      "在 AGENTS.md / CLAUDE.md 配置 Agent skills 块与 docs/agents，统一 issue 追踪与领域文档。",
    category: "utility",
    filePath: ".agents/skills/setup-matt-pocock-skills",
    fileType: "md",
    compatibleStacks: [],
    tags: ["AGENTS.md", "工程", "配置"],
  },
  {
    id: "shopify-section-html-to-library",
    name: "Shopify 区块注入",
    description:
      "将静态 HTML 区块转为 Liquid 区块库，注册 Hero/布局变体并接入画布预览。",
    category: "integration",
    filePath: ".agents/skills/shopify-section-html-to-library",
    fileType: "md",
    compatibleStacks: UI,
    tags: ["Shopify", "Liquid", "电商"],
  },
  {
    id: "stitch-design-taste",
    name: "Google Stitch 设计系统",
    description:
      "生成 premium 反通用 UI 标准的 DESIGN.md，严格排版、校准色彩、非对称布局。",
    category: "ui",
    filePath: ".agents/skills/stitch-design-taste",
    fileType: "md",
    compatibleStacks: UI,
    tags: ["设计系统", "Stitch", "UI"],
  },
  {
    id: "ui-ux-pro-max",
    name: "UI/UX 设计智能库",
    description:
      "本地可搜数据库：84 风格 / 192 配色 / 74 字体搭配 / 22 技术栈的 UI/UX 智能。",
    category: "ui",
    filePath: ".agents/skills/ui-ux-pro-max",
    fileType: "md",
    compatibleStacks: UI,
    tags: ["UI", "UX", "设计系统"],
  },
  {
    id: "web-scraper",
    name: "网页内容抓取",
    description:
      "抓取指定 URL 的网页内容并提取文本、标题、链接、图片，用于数据采集与分析。",
    category: "data",
    filePath: ".agents/skills/web-scraper",
    fileType: "md",
    compatibleStacks: [],
    tags: ["爬虫", "数据采集", "抓取"],
  },
];
