// 骨架工作台 · 统一内容层（文案单一事实源）。
// 目标：① 全站 demo 文案统一（品牌名 / CTA / 导航 / 通用按钮…）；
//       ② 真实搭建时「一次替换」——改这里（或传入真实内容）即全站同步。
// 变体 code 用 {{brand}} / {{cta.primary}} / {{nav.features}} 等占位符引用本层。

export interface DemoContent {
  /** 品牌名（全站复用，如 Logo 文字、页脚版权） */
  brand: string;
  /** 产品名（用于标题/副标题里的产品指代） */
  product: string;
  /** 一句话定位（tagline） */
  tagline: string;
  /** 行动按钮（primary/secondary 为通用按钮，title/subheading/button 为 CTA 区块文案） */
  cta: {
    primary: string;
    secondary: string;
    title: string;
    subheading: string;
    button: string;
  };
  /** 导航链接文案 */
  nav: {
    features: string;
    pricing: string;
    faq: string;
    docs: string;
    blog: string;
  };
  /** 首屏文案 */
  hero: {
    badge: string;
    heading: string;
    subheading: string;
  };
  /** 认证页文案 */
  auth: {
    loginTitle: string;
    signupTitle: string;
    email: string;
    password: string;
    username: string;
  };
  /** 页脚文案 */
  footer: {
    tagline: string;
    copyright: string;
  };
  /** 特性区块（段落级：标题 + 特性列表） */
  features: {
    title: string;
    subtitle: string;
    items: { name: string; desc: string }[];
  };
  /** 定价区块（段落级：套系 + 每档特性列表） */
  pricing: {
    title: string;
    subtitle: string;
    plans: {
      name: string;
      price: string;
      period: string;
      desc: string;
      features: string[];
      cta: string;
    }[];
  };
  /** FAQ 区块 */
  faq: {
    title: string;
    subtitle: string;
    items: { q: string; a: string }[];
  };
  /** 数据指标区块 */
  stats: {
    title: string;
    items: { label: string; value: string }[];
  };
  /** 客户证言区块 */
  testimonials: {
    title: string;
    subtitle: string;
    items: { quote: string; name: string; role: string }[];
  };
  /** 落地流程区块 */
  process: {
    title: string;
    items: { name: string; desc: string }[];
  };
  /** 品牌/客户词标（marquee） */
  logos: string[];
  /** 仪表盘示例数据（各后台组件的标题/标签/代表行，供一键文案并替换） */
  dashboard: {
    title: string;
    greeting: string;
    kpis: { label: string; value: string; trend: string }[];
    chartTitle: string;
    tabs: string[];
    filters: string[];
    tasks: { title: string; meta: string; due: string }[];
    notifications: { text: string; time: string }[];
    activity: { text: string; time: string }[];
    permissions: string[];
    transfer: { name: string; meta: string; amount: string }[];
    table: { name: string; company: string; status: string }[];
    topbarTitle: string;
  };
  /** 博客（列表 + 单篇标题/正文） */
  blog: {
    title: string;
    subtitle: string;
    tags: string[];
    posts: { title: string; excerpt: string; date: string; tag: string }[];
    postTitle: string;
    postBody: string;
  };
  /** 作品集 */
  portfolio: {
    title: string;
    subtitle: string;
    projects: { title: string; desc: string; tag: string }[];
  };
  /** 电商类（商品页） */
  shop: {
    title: string;
    subtitle: string;
    galleryTitle: string;
    infoTitle: string;
    products: { name: string; price: string; desc: string }[];
  };
  /** 关于页 */
  about: {
    title: string;
    subtitle: string;
    story: string;
    values: { label: string; desc: string }[];
    team: { name: string; role: string }[];
  };
  /** 联系页 */
  contact: {
    title: string;
    subtitle: string;
    formTitle: string;
    formFields: string[];
    infoItems: { label: string; value: string }[];
  };
  /** 文档中心 */
  docs: {
    title: string;
    subtitle: string;
    nav: string[];
    searchTitle: string;
    sections: { title: string; body: string }[];
  };
  /** AI 对话（聊天组件示例） */
  chat: {
    title: string;
    placeholder: string;
    suggestions: string[];
    messages: { role: "user" | "bot"; text: string }[];
  };
  /** 杂项（404 / 即将上线） */
  misc: {
    notFound: { title: string; subtitle: string; button: string };
    coming: { title: string; subtitle: string; button: string; date: string };
  };
}

export const DEMO_CONTENT: DemoContent = {
  brand: "Acme",
  product: "Acme Cloud",
  tagline: "为现代团队打造的一体化云平台",
  cta: {
    primary: "免费开始",
    secondary: "了解更多",
    title: "准备好开始了吗？",
    subheading: "免费体验，不绑定信用卡",
    button: "免费开始",
  },
  nav: {
    features: "功能",
    pricing: "定价",
    faq: "FAQ",
    docs: "文档",
    blog: "博客",
  },
  hero: {
    badge: "全新 2.0 已发布",
    heading: "更快地构建，更稳地交付",
    subheading: "Acme 把部署、监控与协作整合到同一个平台，让团队专注创造而非运维。",
  },
  auth: {
    loginTitle: "登录到 Acme",
    signupTitle: "创建你的 Acme 账户",
    email: "邮箱",
    password: "密码",
    username: "用户名",
  },
  footer: {
    tagline: "为现代团队打造的一体化云平台。",
    copyright: "© 2026 Acme, Inc. 保留所有权利。",
  },
  features: {
    title: "为什么选择 Acme",
    subtitle: "一个平台，一站式搞定",
    items: [
      { name: "一体化工作台", desc: "项目、任务、文档看板一处聚合" },
      { name: "AI 智能助手", desc: "长文提炼、任务拆解，减少重复劳动" },
      { name: "实时同步", desc: "多端秒级同步，团队无需来回拷贝" },
    ],
  },
  pricing: {
    title: "简单透明的定价",
    subtitle: "按需选择，随时升级",
    plans: [
      { name: "免费", price: "¥0", period: " / 月", desc: "个人与试用", features: ["3 个项目", "基础 AI", "社区支持"], cta: "免费开始" },
      { name: "专业", price: "¥79", period: " / 月", desc: "成长中团队", features: ["无限项目", "高级 AI", "优先支持"], cta: "开始试用" },
      { name: "企业", price: "定制", period: "", desc: "规模化交付", features: ["SSO 与审计", "专属客户成功", "SLA"], cta: "联系销售" },
    ],
  },
  faq: {
    title: "常见问题",
    subtitle: "没找到答案？联系我们的团队",
    items: [
      { q: "有免费试用吗？", a: "有，新用户可免费体验全部核心功能，无需绑定银行卡，试用期内不限制项目数。" },
      { q: "可以随时取消或升级吗？", a: "当然，套餐变更都由你自助完成，升级即时生效，退订后账户数据仍保留 30 天。" },
      { q: "我的数据安全吗？", a: "数据全程 TLS 加密传输、静态加密存储，支持 SSO 与审计日志，符合主流合规要求。" },
      { q: "支持与现有工具集成吗？", a: "内置飞书、钉钉、Slack、GitHub 等 30+ 集成，并提供开放 API 与 Webhook 对接自有系统。" },
      { q: "有企业版或私有化部署吗？", a: "提供企业版，支持私有化部署、专属客户成功经理与 SLA，具体可联系销售团队。" },
    ],
  },
  stats: {
    title: "备受信赖",
    items: [
      { label: "活跃团队", value: "50k+" },
      { label: "服务国家/地区", value: "40+" },
      { label: "满意度", value: "4.9/5" },
      { label: "已交付项目", value: "120k+" },
    ],
  },
  testimonials: {
    title: "客户怎么说",
    subtitle: "来自真实用户的反馈",
    items: [
      { quote: "让团队协作真正快起来了，需求、文档和进度再也不用来回拷贝。", name: "林女士", role: "某科技公司产品经理" },
      { quote: "几分钟就搭起一个可用原型，跑通演示比我之前快太多了。", name: "王先生", role: "独立开发者" },
      { quote: "改装落地页后转化率提升了近三成，A/B 测试也更顺手了。", name: "陈女士", role: "电商运营总监" },
      { quote: "从想法到可演示的 MVP 只用了两周，后面的融资路演全靠它撑场。", name: "张先生", role: "初创公司 CEO" },
      { quote: "非技术团队也能独立搭出课程落地页，省下了一大笔外包费用。", name: "李老师", role: "在线教育机构负责人" },
      { quote: "生成的代码干净可维护，评审和上线都毫无压力。", name: "赵先生", role: "SaaS 科技公司工程负责人" },
    ],
  },
  process: {
    title: "三步轻松上手",
    items: [
      { name: "创建项目", desc: "一句话生成完整骨架" },
      { name: "挑选组件", desc: "按风格可视化搭建" },
      { name: "一键上线", desc: "导出代码直接部署" },
    ],
  },
  logos: ["腾讯", "阿里巴巴", "Vercel", "Apple", "Google", "TikTok", "Meta", "X", "GitHub", "Slack", "Notion"],
  dashboard: {
    title: "控制台",
    greeting: "欢迎回来，今天想设计点什么？",
    kpis: [
      { label: "活跃用户", value: "12,847", trend: "+12%" },
      { label: "本月收入", value: "¥86,200", trend: "+8%" },
      { label: "转化率", value: "4.6%", trend: "+0.4%" },
      { label: "新增内容", value: "342", trend: "+21%" },
    ],
    chartTitle: "近 30 天趋势",
    tabs: ["总览", "分析", "设置"],
    filters: ["全部", "今天", "本周", "本月"],
    tasks: [
      { title: "完善登录流程", meta: "设计", due: "今天" },
      { title: "发布定价调整", meta: "产品", due: "明天" },
      { title: "整理数据口径", meta: "数据", due: "周五" },
    ],
    notifications: [{ text: "新的评论待审阅", time: "2 分钟前" }, { text: "版本 2.0 已发布", time: "1 小时前" }, { text: "有 3 条新消息", time: "今天" }],
    activity: [{ text: "李雷 编辑了首页文案", time: "3 分钟前" }, { text: "小组上线了新页面", time: "1 小时前" }, { text: "两名新成员加入", time: "昨天" }],
    permissions: ["管理员", "编辑者", "访客"],
    transfer: [{ name: "划转到设计组", meta: "设计预算", amount: "¥12,000" }, { name: "补充运营预算", meta: "运营", amount: "¥8,500" }, { name: "项目备用金", meta: "项目", amount: "¥5,000" }],
    table: [{ name: "织云官网", company: "市场部", status: "运行中" }, { name: "移动端改版", company: "产品部", status: "进行中" }, { name: "数据平台", company: "数据组", status: "待评审" }],
    topbarTitle: "仪表盘",
  },
  blog: {
    title: "来自团队的洞察",
    subtitle: "设计、产品与工程的一手笔记",
    tags: ["设计", "产品", "工程"],
    posts: [
      { title: "如何搭建可复用的设计系统", excerpt: "把 Token、组件与规范沉淀成单一事实源。", date: "2026-08-10", tag: "设计" },
      { title: "用数据驱动你的增长实验", excerpt: "从指标到行动的一整套方法。", date: "2026-07-28", tag: "产品" },
      { title: "前端工程的十个最佳实践", excerpt: "让代码更稳、更快、更易维护。", date: "2026-07-12", tag: "工程" },
    ],
    postTitle: "如何搭建可复用的设计系统",
    postBody: "把 Token、组件与规范沉淀成单一事实源，让设计到交付保持一致的视觉与体验。",
  },
  portfolio: {
    title: "精选作品",
    subtitle: "从想法到上线的完整案例",
    projects: [
      { title: "电商增长平台", desc: "重构了商品到支付的转化链路，GMV 提升 32%。", tag: "电商" },
      { title: "SaaS 协作套件", desc: "在 8 周内从 0 到 1 交付完整工作台。", tag: "SaaS" },
      { title: "品牌门户改版", desc: "统一品牌调性，访问时长提升 60%。", tag: "品牌" },
    ],
  },
  shop: {
    title: "热卖单品",
    subtitle: "为你挑选的高分好物",
    galleryTitle: "产品图集",
    infoTitle: "产品详情",
    products: [
      { name: "织云 Pro", price: "¥299", desc: "面向专业团队的旗舰方案" },
      { name: "轻量版", price: "¥99", desc: "上手即用的入门选择" },
      { name: "企业版", price: "定制", desc: "为规模化组织定制" },
    ],
  },
  about: {
    title: "我们是谁",
    subtitle: "一群相信「好工具改变效率」的搭建者",
    story: "我们相信，产品搭建应该像写文档一样直觉。「从一句话到可用产品」，是我们每天都在做的事。",
    values: [{ label: "用户至上", desc: "每一个决定都从真实场景出发" }, { label: "干净简单", desc: "克制而不复杂，专注核心价值" }, { label: "持续进化", desc: "小步快跑，让产品越用越好" }],
    team: [{ name: "林一", role: "联合创始人" }, { name: "王越", role: "设计负责人" }, { name: "陈阳", role: "技术负责人" }],
  },
  contact: {
    title: "联系我们",
    subtitle: "有任何问题？我们随时在",
    formTitle: "发送消息",
    formFields: ["姓名", "邮箱", "主题"],
    infoItems: [{ label: "邮箱", value: "hello@acme.com" }, { label: "电话", value: "+86 400-000-0000" }, { label: "地址", value: "上海市 · 徐汇区" }],
  },
  docs: {
    title: "文档中心",
    subtitle: "从入门到进阶，系统化了解平台",
    nav: ["快速开始", "指南", "API"],
    searchTitle: "搜索文档",
    sections: [
      { title: "三步快速上手", body: "创建项目、挑选组件、一键上线，几分钟就能看到成果。" },
      { title: "理解设计 Token", body: "颜色、字体、圆角与间距都沉淀为可复用变量，改一处全站同步。" },
      { title: "数据与集成", body: "通过开放 API 与 Webhook 和你的既有工具打通。" },
    ],
  },
  chat: {
    title: "AI 助手",
    placeholder: "问我任何关于产品的问题…",
    suggestions: ["帮我生成一个落地页", "对比 Pro 与免费版", "如何与飞书集成？"],
    messages: [
      { role: "bot", text: "你好～我是你的产品助手，想知道什么？" },
      { role: "user", text: "帮我梳理产品核心卖点" },
      { role: "bot", text: "可以：全站文案一键生成、数百组件可视化搭建、代码可直接落地。" },
    ],
  },
  misc: {
    notFound: { title: "找不到这个页面", subtitle: "链接可能已失效，去看看其他页面吧。", button: "返回首页" },
    coming: { title: "即将上线", subtitle: "我们正在全力打磨，敬请期待。", button: "了解更多", date: "正式发布 · 2026-09" },
  },
};

/** 占位符 → 人类可读含义（用于蓝图「内容映射表」章节） */
export const CONTENT_PLACEHOLDER_DOCS: { key: string; meaning: string }[] = [
  { key: "{{brand}}", meaning: "品牌名（Logo / 页脚版权 / 产品指代）" },
  { key: "{{product}}", meaning: "产品名（标题 / 副标题里的产品指代）" },
  { key: "{{tagline}}", meaning: "一句话定位" },
  { key: "{{cta.primary}}", meaning: "主行动按钮文案" },
  { key: "{{cta.secondary}}", meaning: "次行动按钮文案" },
  { key: "{{cta.title}}", meaning: "CTA 区块标题" },
  { key: "{{cta.subheading}}", meaning: "CTA 区块副标题" },
  { key: "{{cta.button}}", meaning: "CTA 区块行动按钮" },
  { key: "{{nav.features}}", meaning: "导航：功能" },
  { key: "{{nav.pricing}}", meaning: "导航：定价" },
  { key: "{{nav.faq}}", meaning: "导航：FAQ" },
  { key: "{{nav.docs}}", meaning: "导航：文档" },
  { key: "{{nav.blog}}", meaning: "导航：博客" },
  { key: "{{hero.badge}}", meaning: "首屏徽标文案" },
  { key: "{{hero.heading}}", meaning: "首屏主标题" },
  { key: "{{hero.subheading}}", meaning: "首屏副标题" },
  { key: "{{auth.loginTitle}}", meaning: "登录页标题" },
  { key: "{{auth.signupTitle}}", meaning: "注册页标题" },
  { key: "{{auth.email}}", meaning: "邮箱字段标签" },
  { key: "{{auth.password}}", meaning: "密码字段标签" },
  { key: "{{auth.username}}", meaning: "用户名字段标签" },
  { key: "{{footer.tagline}}", meaning: "页脚一句话描述" },
  { key: "{{footer.copyright}}", meaning: "页脚版权" },
  { key: "{{dashboard.title}}", meaning: "仪表盘标题" },
];
