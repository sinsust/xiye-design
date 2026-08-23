// 服务商（Step 8 服务接入数据层）。
// 商业级字段：用途 / 免费额度 / 配置步骤 / 安全注意。

export type ServiceCategory =
  | "llm"
  | "database"
  | "vector"
  | "auth"
  | "payment"
  | "observability"
  | "email"
  | "search"
  | "storage"
  | "other";

export interface ServiceProvider {
  id: string;
  name: string;
  category: ServiceCategory;
  website: string;
  keys: { key: string; label: string; required: boolean }[];
  description: string;
  purpose: string; // 在项目中承担什么职责
  freeTier: string; // 免费额度
  configSteps: string[]; // 配置步骤（3-4 步）
  security: string; // 安全注意
}

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  llm: "大模型",
  database: "数据库",
  vector: "向量库",
  auth: "认证",
  payment: "支付",
  observability: "可观测",
  email: "邮件",
  search: "搜索",
  storage: "文件存储",
  other: "其他",
};

export const SERVICE_PROVIDERS: ServiceProvider[] = [
  // ── LLM ──
  {
    id: "openai",
    name: "OpenAI",
    category: "llm",
    website: "https://platform.openai.com/api-keys",
    description: "GPT-4o, GPT-4o-mini 等模型",
    purpose: "对话/文本/多模态核心模型，也可用于 Embedding",
    freeTier: "新账户赠送 $5 信用额度（一次性）",
    configSteps: [
      "登录 platform.openai.com → API Keys 创建 Key",
      "设置组织 ID（多组织时必填）",
      "填入 OPENAI_API_KEY 环境变量",
    ],
    security: "Key 仅存服务端环境变量，前端严禁暴露；启用 Usage 告警防超支",
    keys: [{ key: "OPENAI_API_KEY", label: "API Key", required: true }],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    category: "llm",
    website: "https://console.anthropic.com/settings/keys",
    description: "Claude 3.5 Sonnet, Opus 等模型",
    purpose: "长上下文对话、代码生成、Agent 场景的强模型",
    freeTier: "新账户赠送 $5 信用额度（一次性）",
    configSteps: [
      "登录 console.anthropic.com → Settings → API Keys 创建",
      "填入 ANTHROPIC_API_KEY 环境变量",
      "生产环境建议开启 Rate Limit 告警",
    ],
    security: "Key 服务端保存；Claude 请求走代理时注意不落第三方日志",
    keys: [{ key: "ANTHROPIC_API_KEY", label: "API Key", required: true }],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    category: "llm",
    website: "https://platform.deepseek.com/api_keys",
    description: "DeepSeek V3, R1 等模型（高性价比）",
    purpose: "成本敏感场景的主力模型（中文效果优、价格低）",
    freeTier: "按量付费，无固定免费额度（新用户有少量赠送）",
    configSteps: [
      "登录 platform.deepseek.com → API Keys 创建",
      "填入 DEEPSEEK_API_KEY 环境变量",
      "与 OpenAI SDK 兼容（base_url 指向 DeepSeek）",
    ],
    security: "与 OpenAI 同样策略：仅服务端使用，设置消费上限",
    keys: [{ key: "DEEPSEEK_API_KEY", label: "API Key", required: true }],
  },
  // ── 数据库 ──
  {
    id: "supabase",
    name: "Supabase",
    category: "database",
    website: "https://supabase.com/dashboard/project/_/settings/database",
    description: "PostgreSQL 数据库 + Auth + Storage",
    purpose: "一体化后端：数据库、认证、存储、实时订阅、Edge Functions",
    freeTier: "免费 500MB 数据库 / 50MB 存储 / 5 万 MAU",
    configSteps: [
      "创建项目 → 复制 Project URL 与 Anon Key",
      "填入 NEXT_PUBLIC_SUPABASE_URL / ANON_KEY",
      "需要服务端权限时另配 Service Role Key（严禁前端使用）",
    ],
    security: "Anon Key 仅用于前端（配合 RLS 策略）；Service Role Key 只在服务端",
    keys: [
      { key: "NEXT_PUBLIC_SUPABASE_URL", label: "Project URL", required: true },
      { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", label: "Anon Key", required: true },
    ],
  },
  {
    id: "neon",
    name: "Neon",
    category: "database",
    website: "https://console.neon.tech/",
    description: "Serverless PostgreSQL",
    purpose: "免运维 Postgres，自动扩缩容与分支能力",
    freeTier: "免费 0.5GB 存储 / 每月 190 计算小时",
    configSteps: [
      "创建项目 → 复制 Connection String",
      "填入 DATABASE_URL 环境变量",
      "Prisma/ORM 按官方模板接入",
    ],
    security: "连接串含密码，仅服务端环境变量；生产建议启用 IP 白名单",
    keys: [{ key: "DATABASE_URL", label: "Connection String", required: true }],
  },
  // ── 向量库 ──
  {
    id: "pinecone",
    name: "Pinecone",
    category: "vector",
    website: "https://app.pinecone.io/",
    description: "托管向量数据库",
    purpose: "RAG 检索：向量索引、相似度查询、混合检索",
    freeTier: "免费 1 个 Serverless 索引 / 10 万向量",
    configSteps: [
      "创建 Index（选好维度，与 Embedding 模型一致）",
      "复制 API Key 与 Host",
      "填入 PINECONE_API_KEY / PINECONE_INDEX 环境变量",
    ],
    security: "索引级访问控制；生产按租户分索引或加元数据过滤",
    keys: [{ key: "PINECONE_API_KEY", label: "API Key", required: true }],
  },
  // ── 认证 ──
  {
    id: "clerk",
    name: "Clerk",
    category: "auth",
    website: "https://dashboard.clerk.com/",
    description: "托管认证与用户管理",
    purpose: "登录注册、OAuth（Google/GitHub）、多因素、会话管理",
    freeTier: "免费 1 万 MAU，含标准社交登录",
    configSteps: [
      "创建应用 → 复制 Publishable Key / Secret Key",
      "填入 NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY",
      "配置 OAuth Provider（Google/GitHub）与回调域名",
    ],
    security: "Secret Key 仅服务端；登录态 Cookie 设 HttpOnly + SameSite",
    keys: [
      { key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", label: "Publishable Key", required: true },
      { key: "CLERK_SECRET_KEY", label: "Secret Key", required: true },
    ],
  },
  // ── 支付 ──
  {
    id: "stripe",
    name: "Stripe",
    category: "payment",
    website: "https://dashboard.stripe.com/apikeys",
    description: "订阅与在线支付",
    purpose: "订阅计费、一次性支付、发票与对账",
    freeTier: "按交易抽佣（2.9% + $0.3/笔，国际卡）；无固定月费",
    configSteps: [
      "创建账户 → API Keys 复制 Publishable / Secret Key",
      "Webhook 端点接收 payment_intent / subscription 事件",
      "填入 STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET",
    ],
    security: "Secret Key 仅服务端；Webhook 验签；PCI 由 Stripe 托管，前端不要碰卡号",
    keys: [
      { key: "STRIPE_PUBLISHABLE_KEY", label: "Publishable Key", required: true },
      { key: "STRIPE_SECRET_KEY", label: "Secret Key", required: true },
      { key: "STRIPE_WEBHOOK_SECRET", label: "Webhook Secret", required: false },
    ],
  },
  {
    id: "paypal",
    name: "PayPal",
    category: "payment",
    website: "https://developer.paypal.com/dashboard/",
    description: "订阅与 PayPal 钱包支付",
    purpose: "欧美用户熟悉的钱包支付与订阅（Billing Plans）",
    freeTier: "按交易抽佣（约 3.49% + 固定费，地区不同）",
    configSteps: [
      "Developer Dashboard 创建 App → 复制 Client ID / Secret",
      "配置 Webhook（订阅/支付事件）",
      "填入 PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET",
    ],
    security: "Secret 仅服务端；Webhook 验签；沙盒与生产环境分开管理",
    keys: [
      { key: "PAYPAL_CLIENT_ID", label: "Client ID", required: true },
      { key: "PAYPAL_CLIENT_SECRET", label: "Client Secret", required: true },
    ],
  },
  // ── 可观测 ──
  {
    id: "sentry",
    name: "Sentry",
    category: "observability",
    website: "https://sentry.io/settings/account/api/auth-tokens/",
    description: "错误监控与性能追踪",
    purpose: "前端/后端错误上报、崩溃率、性能(APM)监控",
    freeTier: "免费 5 万错误事件/月 + 少量性能采样",
    configSteps: [
      "创建项目 → 复制 DSN",
      "前端 init(Sentry.init({ dsn }))",
      "后端接入 SDK 并配置 release/环境标签",
    ],
    security: "DSN 可公开（仅上报入口）；Sentry 内禁用敏感字段采集（PII 脱敏）",
    keys: [{ key: "SENTRY_DSN", label: "DSN", required: true }],
  },
  // ── 邮件 ──
  {
    id: "resend",
    name: "Resend",
    category: "email",
    website: "https://resend.com/api-keys",
    description: "开发友好的邮件发送 API",
    purpose: "验证码、欢迎邮件、账单与通知邮件",
    freeTier: "免费 100 封/天 / 3000 封/月（需验证域名）",
    configSteps: [
      "添加并验证发送域名（SPF/DKIM）",
      "复制 API Key 填入 RESEND_API_KEY",
      "服务端调用 emails.send 模板",
    ],
    security: "Key 仅服务端；防滥用：验证码限流 + 模板变量转义（防注入）",
    keys: [{ key: "RESEND_API_KEY", label: "API Key", required: true }],
  },
  // ── 搜索 ──
  {
    id: "algolia",
    name: "Algolia",
    category: "search",
    website: "https://www.algolia.com/dashboard/",
    description: "托管搜索与推荐",
    purpose: "全文搜索、即时过滤、相关性排序（社区/电商/内容）",
    freeTier: "免费 1 万记录 / 10 万搜索操作每月",
    configSteps: [
      "创建 Index → 复制 Application ID / Search-Only Key / Admin Key",
      "前端用 Search-Only Key（安全可暴露）",
      "服务端用 Admin Key 同步数据，配置 faceting",
    ],
    security: "Search-Only Key 可公开但受限；Admin Key 仅服务端；配置安全规则防数据泄露",
    keys: [
      { key: "NEXT_PUBLIC_ALGOLIA_APP_ID", label: "Application ID", required: true },
      { key: "NEXT_PUBLIC_ALGOLIA_SEARCH_KEY", label: "Search-Only Key", required: true },
      { key: "ALGOLIA_ADMIN_KEY", label: "Admin Key", required: false },
    ],
  },
  // ── 文件存储 ──
  {
    id: "uploadthing",
    name: "UploadThing",
    category: "storage",
    website: "https://uploadthing.com/dashboard",
    description: "文件上传托管（Next.js 友好）",
    purpose: "用户头像、图片、附件上传与 CDN 分发",
    freeTier: "免费 2GB 存储 / 1000 次上传每月",
    configSteps: [
      "创建 App → 复制 App ID / Token",
      "后端配置文件路由（uploadthing/router）",
      "填入 UPLOADTHING_TOKEN 环境变量",
    ],
    security: "上传加文件类型/大小限制；Token 仅服务端；图片类做内容审核可选",
    keys: [{ key: "UPLOADTHING_TOKEN", label: "Token", required: true }],
  },
  // ── 其他 ──
  {
    id: "agno",
    name: "Agno",
    category: "other",
    website: "https://www.agno.com/",
    description: "Python Agent 框架",
    purpose: "Agent 工作流：工具调用、多步任务编排（Python 后端）",
    freeTier: "框架开源免费，托管服务按量",
    configSteps: [
      "pip install agno 接入项目",
      "按文档配置模型 Provider 与工具",
      "填入 AGNO_API_KEY（如用托管）",
    ],
    security: "工具调用需沙箱与权限白名单；Agent 日志不落敏感信息",
    keys: [{ key: "AGNO_API_KEY", label: "Agno API Key (Optional)", required: false }],
  },
];
