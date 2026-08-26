// AI 意图解构引擎（启发式，无后端）。
// 输入一段自然语言想法 → 输出「最佳组合」：项目类型 / AI 能力 / 技术栈 /
// 视觉风格 / UI 库 / 页面蓝图（骨架工作台要预填的 pageBlueprint）。
//
// 纯关键词打分：把用户一句话映射到已有的真实数据（PROJECT_TYPES /
// TECH_STACKS / VISUAL_STYLES / SKELETON_PAGE_MAP）。接口保持可插拔，
// 将来接真 LLM 时只替换 interpretIntent 内部实现，不破坏下游。
//
// 骨架 × 流程 的衔接就发生在这里：AI 一次性预填 flow-store 的全局选型
// + pageBlueprint，人工进骨架工作台只用微调。

import type { FlowState } from "@/lib/store/flow-store";
import { PROJECT_TYPES } from "@/data/project-types";
import { AI_CAPABILITIES } from "@/data/ai-capabilities";
import { TECH_STACKS } from "@/data/tech-stacks";
import { UI_LIBRARIES } from "@/data/ui-libraries";
import { VISUAL_STYLE_MAP } from "@/data/visual-styles";
import { SKELETON_PAGE_MAP } from "@/data/skeletons";
import { DEFAULT_STYLE_ID } from "@/data/visual-styles";

// ───────────────────────────── 输出类型 ─────────────────────────────

export interface IntentRecComponent {
  componentId: string;
  componentName: string;
  variantId: string | null;
  variantName: string;
}
export interface IntentRecPage {
  pageSlug: string;
  pageName: string;
  components: IntentRecComponent[];
}
/** 产品构想与 PRD 依据：AI 一句话在同一轮产出的「产品叙事」，供 docs/PRD.md 与市场契合说明复用 */
export interface ProductPage {
  /** 页面名称，如「简历上传与解析页」 */
  name: string;
  /** 建议路由，如 /resume/parse */
  path?: string;
  /** 页面功能描述：这个页面做什么、为谁解决什么问题 */
  description: string;
  /** 关联的核心功能名（来自 coreFeatures） */
  relatedFeatures: string[];
  /** 开发优先级 */
  priority: "P0" | "P1" | "P2";
}

export interface IntentNarrative {
  /** 产品愿景一句话 */
  vision: string;
  /** 定位 / 差异化 */
  positioning: string;
  /** 目标用户 */
  targetAudience: string[];
  /** 核心功能（名称 + 解决什么） */
  coreFeatures: { name: string; why: string }[];
  /** 业务专属页面（由核心功能推导，AI 产出或本地启发式兜底），用于 PRD「页面与信息架构」功能驱动章节 */
  pages?: ProductPage[];
  /** 本期非目标 */
  nonGoals: string[];
  /** 成功指标 */
  successMetrics: string[];
  /** 为何贴合当前主流市场 / 所选视觉契约的依据 */
  marketFit: string;
}

export interface IntentRecommendation {
  /** 用户原始输入 */
  text: string;
  /** 是否识别到了项目类型 */
  matched: boolean;
  projectType: { id: string; name: string; description: string };
  aiCapabilities: { id: string; name: string }[];
  techStack: { id: string; name: string } | null;
  visualStyle: { id: string; name: string } | null;
  uiLibrary: { main: string } | null;
  blueprint: IntentRecPage[];
  pagesCount: number;
  componentsCount: number;
  summary: string;
  narrative: IntentNarrative;
}

// ───────────────────────── 关键词打分 ─────────────────────────

/** 在文本中累计命中次数，长关键词权重更高；返回 0 表示未命中 */
function score(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  let total = 0;
  for (const kw of keywords) {
    const k = kw.toLowerCase();
    if (!k) continue;
    let idx = lower.indexOf(k);
    let count = 0;
    while (idx !== -1) {
      count++;
      idx = lower.indexOf(k, idx + k.length);
    }
    // 长关键词更有区分度，权重重一些
    total += count * Math.min(k.length, 6);
  }
  return total;
}

// ───────────────────────── 项目类型分类 ─────────────────────────

const TYPE_KEYWORDS: Record<string, string[]> = {
  saas: ["saas", "工作台", "多租户", "订阅制", "会员系统", "收费", "软件即服务"],
  internal_tool: ["内部工具", "管理后台", "后台系统", "oa", "审批", "中台", "运营后台", "工单", "erp", "客服系统", "人力"],
  independent_site: ["官网", "落地页", "品牌站", "作品集", "展示站", "portfolio", "landing", "主页", "营销页"],
  ecommerce: ["电商", "商城", "网店", "购物", "商品", "下单", "卖货", "店铺", "订单"],
  ai_app: ["ai", "人工智能", "智能助手", "聊天机器人", "对话", "copilot", "生成式", "大模型", "gpt", "问答", "虚拟人"],
  data_analysis: ["数据分析", "报表", "bi", "数据看板", "可视化", "埋点", "数据平台", "分析"],
  community: ["社区", "论坛", "社群", "内容平台", "ugc", "社交", "feed", "贴吧", "创作者"],
  b2b_crm: ["crm", "销售管理", "销售", "线索", "客户管理", "商机", "客户关系"],
  marketplace: ["市场平台", "撮合", "二手", "租房平台", "外包", "接单", "双边"],
  devtool: ["开发者工具", "sdk", "cli", "文档站", "开发者平台", "api 工具", "开源工具"],
  education: ["教育", "课程", "学习", "培训", "网课", "题库", "驾考", "在线教育"],
  fintech: ["金融", "支付", "理财", "记账", "钱包", "信贷", "放贷", "股票"],
  health: ["医疗", "健康", "问诊", "挂号", "药店", "健康管理", "体检"],
  local_life: ["本地", "房产", "租房", "外卖", "到家", "生活服务", "探店"],
  mobile_app: ["移动应用", "手机应用", "移动 app", "ios", "android", "小程序"],
};

/** 识别项目类型：按关键词得分从高到低取最强且正分的候选 */
function classifyType(text: string): string | null {
  let best: string | null = null;
  let bestScore = 0;
  for (const [id, kws] of Object.entries(TYPE_KEYWORDS)) {
    const s = score(text, kws);
    if (s > bestScore) {
      bestScore = s;
      best = id;
    }
  }
  return bestScore > 0 ? best : null;
}

// ───────────────────────── AI 能力分类 ─────────────────────────

const AI_KEYWORDS: Record<string, string[]> = {
  chat: ["聊天", "对话", "客服", "陪伴", "机器人", "问答助手"],
  text_generation: ["写文案", "写文章", "文案", "内容生成", "营销文案", "摘要", "改写"],
  image: ["图片", "图像", "绘图", "海报", "logo", "头像", "文生图"],
  voice: ["语音", "音频", "录音", "转写", "tts", "声控", "语音助手"],
  document: ["文档解析", "pdf", "发票", "合同", "文件解析", "票据"],
  rag: ["知识库", "语义搜索", "rag", "企业知识", "文档问答"],
  data_analysis: ["查数", "数据分析", "自动图表", "nl 查询"],
  translation: ["翻译", "多语言", "i18n", "外语"],
  agent: ["agent", "自动化", "自主任务", "多步任务"],
  workflow: ["工作流", "流程编排", "自动流程"],
  recommendation: ["推荐", "猜你喜欢", "个性化推荐"],
  code_generation: ["代码", "编程", "补全", "开发者", "sdk"],
  ocr: ["识别", "ocr", "证件识别", "发票识别"],
  video: ["视频", "短视频", "剪辑", "数字人"],
};

function classifyAiCapabilities(text: string, typeId: string | null): string[] {
  const matched: string[] = [];
  for (const [id, kws] of Object.entries(AI_KEYWORDS)) {
    if (score(text, kws) > 0) matched.push(id);
  }
  if (matched.length) return matched.slice(0, 3);

  // 没命中时，按项目类型补一到两个「顺理成章」的能力
  if (typeId === "ai_app") return ["chat"];
  const byType = AI_CAPABILITIES.filter((c) => c.recommendedFor.includes(typeId ?? ""));
  if (!byType.length) return [];
  const pick = byType[0];
  const pick2 = byType.find((c) => c.id !== pick.id);
  return pick2 ? [pick.id, pick2.id] : [pick.id];
}

// ───────────────────────── 页面蓝图编排 ─────────────────────────

/** 每个项目类型 → 推荐哪些页面、每页哪些组件（组件 id 来自 data/skeletons 真实值） */
const TYPE_BLUEPRINT: Record<string, Record<string, string[]>> = {
  saas: {
    dashboard: ["dash-sidebar", "dash-topbar", "dash-kpi", "dash-table", "dash-permissions", "dash-chart", "dash-notifications", "dash-tasks"],
    auth: ["auth-login", "auth-signup"],
    pricing: ["pricing-tiers"],
    home: ["navbar", "hero", "features", "cta", "footer"],
  },
  internal_tool: {
    dashboard: ["dash-sidebar", "dash-topbar", "dash-kpi", "dash-table", "dash-permissions", "dash-tasks", "dash-transfer", "dash-activity"],
    auth: ["auth-login"],
  },
  data_analysis: {
    dashboard: ["dash-sidebar", "dash-topbar", "dash-kpi", "dash-chart", "dash-gauges", "dash-statstrip", "dash-table", "dash-filters"],
    auth: ["auth-login"],
  },
  ai_app: {
    "ai-chat": ["chat-window", "chat-input", "chat-suggest"],
    auth: ["auth-login", "auth-signup"],
    pricing: ["pricing-tiers"],
    dashboard: ["dash-sidebar", "dash-chart", "dash-notifications"],
    home: ["navbar", "hero", "cta", "footer"],
  },
  independent_site: {
    home: ["navbar", "hero", "features", "stats", "logos", "testimonials", "pricing", "home-process", "home-integrations", "home-contact", "cta", "footer"],
    about: ["about-story", "about-team"],
    contact: ["contact-form", "contact-info"],
    blog: ["blog-list", "blog-post"],
  },
  ecommerce: {
    product: ["product-grid", "product-info", "product-gallery", "product-cart"],
    home: ["navbar", "hero", "features", "logos", "testimonials", "footer"],
    about: ["about-story", "about-team"],
    blog: ["blog-list", "blog-post"],
    auth: ["auth-login"],
  },
  community: {
    blog: ["blog-list", "blog-post", "blog-tags"],
    auth: ["auth-login", "auth-signup"],
    dashboard: ["dash-list", "dash-notifications"],
    home: ["navbar", "hero", "features", "footer"],
  },
  b2b_crm: {
    dashboard: ["dash-sidebar", "dash-topbar", "dash-kpi", "dash-table", "dash-list", "dash-activity", "dash-permissions"],
    auth: ["auth-login"],
  },
  marketplace: {
    product: ["product-grid", "product-info"],
    home: ["navbar", "hero", "features", "logos", "testimonials", "footer"],
    about: ["about-story", "about-team"],
    auth: ["auth-login", "auth-signup"],
    dashboard: ["dash-table", "dash-list"],
  },
  education: {
    home: ["navbar", "hero", "features", "pricing", "testimonials"],
    about: ["about-story", "about-team"],
    blog: ["blog-list", "blog-post"],
    auth: ["auth-login", "auth-signup"],
  },
  fintech: {
    dashboard: ["dash-sidebar", "dash-topbar", "dash-kpi", "dash-chart", "dash-table"],
    auth: ["auth-login"],
    home: ["navbar", "hero", "features", "logos", "cta", "footer"],
    about: ["about-story", "about-team"],
    contact: ["contact-form", "contact-info"],
    blog: ["blog-list", "blog-post"],
  },
  health: {
    home: ["navbar", "hero", "features", "home-contact", "cta", "footer"],
    about: ["about-story", "about-team"],
    blog: ["blog-list", "blog-post"],
    auth: ["auth-login"],
    dashboard: ["dash-kpi", "dash-table", "dash-list"],
  },
  local_life: {
    home: ["navbar", "hero", "features", "home-contact", "cta", "footer"],
    about: ["about-story", "about-team"],
    product: ["product-info"],
    auth: ["auth-login"],
  },
  mobile_app: {
    home: ["navbar", "hero", "features"],
    auth: ["auth-login", "auth-signup"],
    product: ["product-grid", "product-info"],
  },
  devtool: {
    docs: ["docs-nav", "docs-content", "docs-search"],
    home: ["navbar", "hero", "features", "home-process", "home-integrations", "pricing", "cta", "footer"],
    auth: ["auth-login"],
  },
};

/** 从组件变体里挑一个最有代表性的（优先「标准 / 编辑式 / 工作台」，否则取第一个） */
function pickVariant(comp: { variants: { id: string; name: string }[] } | undefined) {
  if (!comp || !comp.variants.length) {
    return { id: null, name: "默认" };
  }
  const preferred =
    comp.variants.find((v) => /标准|编辑式|工作台/.test(v.name)) ??
    comp.variants[0];
  return { id: preferred.id, name: preferred.name };
}

function buildBlueprint(typeId: string | null): IntentRecPage[] {
  const plan: Record<string, string[]> = typeId
    ? TYPE_BLUEPRINT[typeId] ?? {}
    : {};
  const pages: IntentRecPage[] = [];
  for (const [pageSlug, componentIds] of Object.entries(plan)) {
    const page = SKELETON_PAGE_MAP[pageSlug];
    if (!page) continue;
    const components: IntentRecComponent[] = [];
    for (const cid of componentIds) {
      const comp = page.components.find((c) => c.id === cid);
      if (!comp) continue;
      const v = pickVariant(comp);
      components.push({
        componentId: comp.id,
        componentName: comp.name.replace(/\{\{[^}]*\}\}/g, "").trim(),
        variantId: v.id,
        variantName: v.name,
      });
    }
    if (components.length) {
      pages.push({ pageSlug, pageName: page.name, components });
    }
  }
  return pages;
}

// ───────────────────────── 风格 / 栈 / 库 ─────────────────────────

const TYPE_STACK: Record<string, string> = {
  independent_site: "astro_supabase",
  saas: "nextjs_supabase",
  data_analysis: "django_postgres",
  ai_app: "nextjs_supabase",
  ecommerce: "react_express",
  community: "nextjs_supabase",
  internal_tool: "react_express",
  b2b_crm: "nextjs_supabase",
  marketplace: "go_react",
  education: "nextjs_supabase",
  fintech: "springboot_vue",
  health: "django_postgres",
  local_life: "react_express",
  mobile_app: "nextjs_supabase",
  devtool: "nextjs_supabase",
};

const ENTERPRISE_TYPES = new Set([
  "internal_tool",
  "saas",
  "data_analysis",
  "fintech",
  "b2b_crm",
]);

const STYLE_KEYWORDS: { kws: string[]; id: string; desc: string }[] = [
  // —— 行业/情绪 → 风格：把「业务属于哪个领域、想传达什么情绪」映射到贴合的色系（优先级最高）——
  // 母婴 / 亲子 / 育儿 / 家庭：温馨暖奶油 + 鼠尾草绿
  { kws: ["母婴", "亲子", "育儿", "婴儿", "儿童", "宝宝", "妈妈", "奶瓶", "奶粉", "孕", " babysitter", " childcare", " infant", " newborn", " toddler"], id: "editorial-luxury", desc: "母婴/亲子 → 温馨暖奶油" },
  // 宠物 / 园艺 / 有机 / 健康生活：清新自然绿
  { kws: ["宠物", "猫咪", "猫粮", "狗粮", "犬", "猫", "动物", "毛孩子", "园艺", "绿植", "有机", "健康食品", "养生", "度假", "生态", " pet ", " organic"], id: "nature-green", desc: "宠物/自然 → 清新自然绿" },
  // 奢侈品 / 高端 / 商务送礼：奢华衬线
  { kws: ["奢侈", "高端", "商务送礼", "高定", "珠宝", "腕表", "名表", "私享", "vip", "premium"], id: "luxury", desc: "高端 → 奢华质感" },
  // 纯白 / 优雅 / 化妆品 / 展示型品牌：极简编辑暖白
  { kws: ["纯白", "留白", "优雅", "彩妆", "护肤", "香水", "时尚", "女装", "高级感", "极简", "简约", "干净", "minimal"], id: "minimalist-editorial", desc: "纯白/优雅 → 极简编辑暖白" },
  // 玩具 / 儿童乐园 / 亲子娱乐 / 教育 / 节日：活泼多彩
  { kws: ["玩具", "乐园", "亲子娱乐", "游乐园", "启蒙", "教育", "培训", "课程", "kids", "playground"], id: "truus-aurora", desc: "玩具/教育 → 活泼多彩" },
  // 食品 / 餐饮 / 小食 / 农产品：暖橙有食欲
  { kws: ["食品", "餐饮", "美食", "小吃", "烘焙", "咖啡", "茶饮", "外卖", "菜", "零食", " food ", " coffee"], id: "warm-orange", desc: "餐饮食品 → 暖橙有食欲" },
  // 服装 / 品牌零售 / 电商营销：极简编辑或暖橙
  { kws: ["服装", "潮牌", "零售", "shopping", "retail"], id: "warm-orange", desc: "零售/电商 → 暖橙活力" },
  // —— 通用形容词（情绪/质感直接点名）——
  { kws: ["贵", "奢华", "高端", "营销", "编辑风格", "杂志"], id: "editorial-luxury", desc: "奢华/杂志" },
  { kws: ["暗", "开发者", "终端", "黑客", "代码", "科技深色", "monospace"], id: "dark-developer", desc: "暗色开发者" },
  { kws: ["温馨", "温暖", "柔和", "亲和", "治愈", "可爱", "软萌", " cozy"], id: "editorial-luxury", desc: "温馨治愈" },
  { kws: ["创意", "机构", "活泼", "多彩", "agency"], id: "truus-aurora", desc: "创意机构" },
  { kws: ["科技", "智能", "saas", "企业", "专业", "数据", "金融", "后台"], id: "tech-blue", desc: "科技/企业冷蓝" },
  { kws: ["空灵", "玻璃", "通透", "轻盈"], id: "ethereal-glass", desc: "空灵玻璃" },
];

function resolveVisualStyle(text: string, typeId: string | null, fallbackId: string): string {
  const lower = text.toLowerCase();
  for (const s of STYLE_KEYWORDS) {
    if (s.kws.some((k) => k && lower.includes(k.toLowerCase()))) return s.id;
  }
  // 由项目类型兜底：公众展示 / 电商等默认给暖色调，后台给企业蓝，避免一律套深色/玻璃
  return typeStyleByType(typeId) ?? fallbackId;
}

function typeStyleByType(typeId: string | null): string | null {
  switch (typeId) {
    case "ecommerce":
    case "marketplace":
    case "local_life":
      return "warm-orange";
    case "independent_site":
      return "minimalist-editorial";
    case "education":
      return "truus-aurora";
    case "health":
      return "nature-green";
    case "fintech":
      return "slate-gray";
    default:
      return null; // saas/internal/devtool 等走 fallback
  }
}

// ───────────────────────── 产品叙事 / PRD 依据（启发式） ─────────────────────────

/**
 * 本地启发式：从核心功能推导「业务专属页面」。
 * 即使 AI 没返回 pages（未配 DeepSeek / 解析失败），PRD 第 4 节也能把功能映射到要开发的页面。
 * 规则：先用关键词匹配常见功能→页面模板，未命中则按功能名泛化为「XX 页」。
 */
export function deriveFeaturePages(
  features: { name: string; why: string }[],
): ProductPage[] {
  const ruleMap: { kw: string[]; page: Omit<ProductPage, "relatedFeatures"> }[] = [
    { kw: ["简历", "resume", "cv", "履历"], page: { name: "简历上传与解析页", path: "/resume/parse", description: "用户上传 PDF/Word 简历，系统提取技能、经验、期望薪资、地点等结构化字段，供后续匹配使用。", priority: "P0" } },
    { kw: ["匹配", "matching", "match", "推荐岗位"], page: { name: "岗位匹配结果页", path: "/jobs/match", description: "展示与用户简历加权匹配后的岗位列表，输出匹配分数与命中原因（关键词/薪资/地点/经验）。", priority: "P0" } },
    { kw: ["推送", "push", "每日", "daily", "订阅提醒"], page: { name: "推送设置页", path: "/settings/push", description: "用户设定每日推送时间与频次，选择推送渠道，管理已订阅的匹配岗位流。", priority: "P1" } },
    { kw: ["岗位详情", "job detail", "职位详情"], page: { name: "岗位详情页", path: "/jobs/[id]", description: "展示单个岗位的原始链接、匹配点、薪资对比、公司信息，支持收藏 / 忽略反馈。", priority: "P0" } },
    { kw: ["数据源", "爬虫", "crawl", "api 接入", "采集"], page: { name: "数据源接入配置页", path: "/admin/sources", description: "管理爬虫 / API / UGC 三类数据源，配置解析规则与调度，查看抓取状态。", priority: "P1" } },
    { kw: ["简历解析", "解析"], page: { name: "简历解析结果页", path: "/resume/result", description: "展示解析后的结构化简历字段，支持用户校正与补充。", priority: "P1" } },
    { kw: ["仪表盘", "dashboard", "看板", "数据概览"], page: { name: "数据仪表盘", path: "/dashboard", description: "聚合核心指标、任务看板与通知中心的运营视图。", priority: "P1" } },
    { kw: ["对话", "chat", "ai 对话", "copilot"], page: { name: "AI 对话工作台", path: "/chat", description: "提供对话窗口、输入区与建议提示，承载 AI 交互主流程。", priority: "P1" } },
    { kw: ["定价", "pricing", "订阅", "计费"], page: { name: "定价与订阅页", path: "/pricing", description: "展示定价卡片、功能对比表与定价 FAQ，承载付费转化。", priority: "P2" } },
    { kw: ["认证", "登录", "注册", "auth"], page: { name: "认证页", path: "/auth", description: "分屏布局的登录 / 注册表单，承载账号体系入口。", priority: "P0" } },
  ];

  const out: ProductPage[] = [];
  for (const f of features) {
    const lower = f.name.toLowerCase();
    const hit = ruleMap.find((r) => r.kw.some((k) => lower.includes(k.toLowerCase())));
    if (hit) {
      out.push({ ...hit.page, relatedFeatures: [f.name] });
    } else {
      // 泛化兜底：功能名 → 「XX 页」，保证每个功能都有对应页面被点出
      const name = f.name.replace(/页$|界面$|功能$|模块$/, "") + "页";
      out.push({
        name,
        description: `承载「${f.name}」能力，供用户或运营在独立页面上完成相关操作。`,
        relatedFeatures: [f.name],
        priority: "P1",
      });
    }
  }
  // 去重（按页面名）
  const seen = new Set<string>();
  return out.filter((p) => (seen.has(p.name) ? false : (seen.add(p.name), true)));
}

/** 从已识别的项目类型 + 选型推导一套默认「产品叙事」，保证启发式兜底也有完整 PRD */
function buildNarrative(
  t: NonNullable<(typeof PROJECT_TYPES)[number]>,
  visualStyleName: string,
  pages: IntentRecPage[],
  aiCaps: { id: string; name: string }[],
): IntentNarrative {
  const coreFeatures: { name: string; why: string }[] = (t.keyModules ?? [])
    .slice(0, 5)
    .map((m) => ({ name: m, why: t.description }));
  if (!coreFeatures.length) {
    for (const c of aiCaps.slice(0, 3)) {
      coreFeatures.push({ name: c.name, why: "由所选 AI 能力支撑的差异化竞争力" });
    }
  }
  if (!coreFeatures.length) {
    coreFeatures.push({ name: "核心主流程", why: t.description });
  }
  const pageNames = pages.map((p) => p.pageName);
  return {
    vision: `致力于打造一个「${t.name}」产品：${t.description}`,
    positioning: t.positioning ?? t.description,
    targetAudience: t.audience ? [t.audience] : [],
    coreFeatures,
    pages: deriveFeaturePages(coreFeatures),
    nonGoals: ["本期不做完整多语言 / 地域化", "不做核心主流程之外的增值模块"],
    successMetrics: ["注册 / 激活率", "核心功能留存", "关键路径转化率"],
    marketFit: `面向当前主流的「${t.name}」形态构建，套用贴合当下审美的「${visualStyleName}」视觉契约，信息架构遵循主流站点结构（${pageNames.slice(0, 4).join("、") || "核心页面"}），让初始上线即具备完整、可展示、可转化的产品骨架。`,
  };
}

// ───────────────────────── 主入口 ─────────────────────────

export function interpretIntent(text: string): IntentRecommendation {
  const trimmed = text.trim();
  const typeId = classifyType(trimmed) ?? "saas";

  const type = PROJECT_TYPES.find((t) => t.id === typeId) ?? PROJECT_TYPES[0];
  const capIds = classifyAiCapabilities(trimmed, typeId);
  const capability = (id: string) =>
    AI_CAPABILITIES.find((c) => c.id === id);

  // 技术栈：偏好该类型顺理成章的方案，缺省用 Next.js + Supabase
  const preferStack = TYPE_STACK[typeId];
  const stack =
    TECH_STACKS.find((t) => t.id === preferStack) ??
    TECH_STACKS.find((t) => t.recommendedFor.includes(typeId)) ??
    TECH_STACKS[0];

  // 视觉风格：优先让输入里的行业/情绪/形容词决定，其次按项目类型给贴合色系，最后才回退全局默认
  const visualStyle = VISUAL_STYLE_MAP[resolveVisualStyle(trimmed, typeId, DEFAULT_STYLE_ID)];

  // UI 主库：企业型后台用 Ant Design，面向公众用 shadcn/ui
  const mainLib =
    UI_LIBRARIES.find((l) => l.id === (ENTERPRISE_TYPES.has(typeId) ? "antd" : "shadcn")) ??
    UI_LIBRARIES[0];

  const blueprint = buildBlueprint(typeId);

  const projectType = { id: type.id, name: type.name, description: type.description };
  const aiCapabilities = capIds
    .map((id) => capability(id))
    .filter(Boolean)
    .map((c) => ({ id: c!.id, name: c!.name }));
  const techStack = stack ? { id: stack.id, name: stack.name } : null;

  const componentsCount = blueprint.reduce((n, p) => n + p.components.length, 0);
  const narrative = buildNarrative(type, visualStyle?.name ?? "", blueprint, aiCapabilities);
  const summary = `识别到你想做「${type.name}」：为你选了 ${stack?.name ?? "默认"} 技术栈、套用「${visualStyle?.name ?? "默认"}」视觉风格${aiCapabilities.length ? `，并预置 ${aiCapabilities.length} 项 AI 能力` : ""}。已在 ${blueprint.length} 个页面里放好 ${componentsCount} 个区块，可直接进页面搭建工作台微调。`;

  return {
    text: trimmed,
    matched: classifyType(trimmed) !== null,
    projectType,
    aiCapabilities,
    techStack,
    visualStyle: visualStyle ? { id: visualStyle.id, name: visualStyle.name } : null,
    uiLibrary: { main: mainLib.id },
    blueprint,
    pagesCount: blueprint.length,
    componentsCount,
    summary,
    narrative,
  };
}

// ───────────────────────── 落地到 flow-store ─────────────────────────

/** 把 AI 推荐写入 flow-store：全局选型 + pageBlueprint 一并预填 */
export function applyIntentRecommendation(
  rec: IntentRecommendation,
  s: FlowState,
) {
  // 项目类型
  s.setProjectType(rec.projectType.id);

  // AI 能力：先清掉现有再按推荐设置
  for (const id of s.aiCapabilities) {
    if (!rec.aiCapabilities.some((c) => c.id === id)) s.toggleAiCapability(id);
  }
  for (const c of rec.aiCapabilities) {
    if (!s.aiCapabilities.includes(c.id)) s.toggleAiCapability(c.id);
  }

  if (rec.techStack) s.setTechStack(rec.techStack.id);
  if (rec.visualStyle) s.setVisualStyle(rec.visualStyle.id);
  if (rec.uiLibrary) s.setUiLibrary({ main: rec.uiLibrary.main });
  if (rec.narrative) s.setIntentNarrative(rec.narrative);

  // 骨架蓝图：仅当 AI 本次确实推导出蓝图时才替换（避免清空用户在 builder 手动搭建的页面骨架）
  if (rec.blueprint && rec.blueprint.length) {
    s.clearBlueprint();
    for (const page of rec.blueprint) {
      for (const c of page.components) {
        s.addBlueprintComponent({
          pageSlug: page.pageSlug,
          componentId: c.componentId,
          variantId: c.variantId,
        });
      }
    }
  }
}

// ───────────────────────── 在线解构（真实 AI + 启发式兜底） ─────────────────────────

export interface SmartIntentResult {
  rec: IntentRecommendation;
  source: "ai" | "heuristic";
}

/** 优先请求服务端真实 LLM（app/api/ai/intent），失败/未配 key 时回退启发式。 */
export async function interpretIntentSmart(
  text: string,
): Promise<SmartIntentResult> {
  try {
    const res = await fetch("/api/ai/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const rec = (await res.json()) as IntentRecommendation;
      return { rec, source: "ai" };
    }
  } catch {
    // 网络异常 → 走启发式兜底
  }
  return { rec: interpretIntent(text), source: "heuristic" };
}