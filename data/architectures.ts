// 架构知识库：为每个受支持的技术栈沉淀「科学、严谨」的工程架构规范。
// 这是流程工作台的「架构师」能力来源 —— 用户选定技术栈后，
// 生成端据此推导出权威目录树、分层边界、数据流与模式守则（见 ARCHITECTURE.md）。
//
// 每个条目基于该栈的主流最佳实践（官方模板 + 社区公认分层），
// layers.keywords 用于把骨架蓝图里的页面/区块映射到对应架构层。

export interface ArchLayer {
  id: string;
  name: string;
  /** 该层对应的挂载路径（在目录树里能找到） */
  path: string;
  /** 层职责 */
  responsibilities: string[];
  /** 页面/区块落点的关键词（用于蓝图 → 架构层映射） */
  keywords: string[];
}

export interface ArchitectureKnowledge {
  stackId: string;
  /** 总体架构模式一句话 */
  pattern: string;
  /** 权威目录树（markdown 代码块文本） */
  tree: string;
  /** 分层边界与职责 */
  layers: ArchLayer[];
  /** 一次典型读写/流式交互的数据流 */
  dataFlow: string[];
  /** 关键模式与守则（状态/认证/ORM/AI 集成落点等） */
  patterns: string[];
  /** 扩展性建议 / 何时拆分 */
  scaling: string[];
}

export const ARCHITECTURES: Record<string, ArchitectureKnowledge> = {
  nextjs_supabase: {
    stackId: "nextjs_supabase",
    pattern: "一体化全栈（App Router）＋ 后端即服务(PaaS)。页面、接口、数据访问在同一 Next.js 应用内，靠 Server/Client 边界划分职责。",
    tree: `project/
├─ app/                     # 路由与页面（App Router）
│  ├─ (marketing)/          # 官网组：主页/定价/关于（多数为 RSC）
│  ├─ (auth)/               # 登录/注册
│  ├─ (app)/                # 登录后的产品工作台（受保护）
│  │  └─ dashboard/
│  ├─ api/                  # 服务端 Route Handlers（DB / AI 代理）
│  └─ layout.tsx
├─ components/              # 可复用 UI（server 组件在上，client 用 "use client"）
│  ├─ ui/                   # 基础组件（shadcn）
│  └─ features/             # 业务组件（按域分目录）
├─ lib/                     # 纯逻辑/工具（不含 React 状态）
│  ├─ db/                   # Supabase 客户端与查询
│  ├─ ai/                   # AI 调用封装
│  └─ session/              # 会话与鉴权工具
├─ middleware.ts            # 边缘鉴权（保护 (app) 目录）
├─ .env.local               # 密钥（SUPABASE_URL / ANON_KEY / AI_KEY）
├─ tailwind.config.ts
└─ globals.css`,
    layers: [
      { id: "presentation", name: "表现层（RSC + Client 组件）", path: "app/* + components/", responsibilities: ["渲染页面与交互", "Server Components 优先，动态交互才用 Client 组件", "用 UI 组件组装页面，不直接写数据层"], keywords: ["home", "landing", "pricing", "about", "login", "signup", "dashboard", "主页", "定价", "登录", "仪表盘"] },
      { id: "edge-auth", name: "边界鉴权（Middleware）", path: "middleware.ts", responsibilities: ["在边缘判定登录态并保护 (app) 目录", "校验 Supabase session / JWT"], keywords: ["auth", "session", "guard", "鉴权", "权限"] },
      { id: "server-data", name: "服务端数据访问（Server Actions + Route Handlers）", path: "app/api/ + lib/db/", responsibilities: ["所有数据库读写走服务端", "Server Actions 处理变更，Route Handler 处理 AI/三方代理", "任何含密钥的调用绝不进入客户端 bundle"], keywords: ["api", "action", "query", "mutation", "数据", "接口"] },
      { id: "database", name: "数据层（PostgreSQL / Supabase）", path: "Supabase 控制台 + lib/db/", responsibilities: ["表结构/RLS 行级安全", "迁移与索引", "实时订阅"], keywords: ["db", "postgres", "table", "存储", "数据"] },
      { id: "ai-integration", name: "AI 集成（服务端代理）", path: "app/api/ai/ + lib/ai/", responsibilities: ["在服务端持有 AI 密钥并转发", "做流式 SSE、超时与兜底", "不在浏览器暴露模型密钥"], keywords: ["ai", "chat", "llm", "agent", "rag", "智能"] },
    ],
    dataFlow: [
      "用户输入 → Client 组件本地状态（不下发）",
      "提交/查询 → Server Action 或 GET Route Handler（服务端持 Supabase 服务端密钥）",
      "可附 middleware 于边缘校验 session，非法即 307 回登录",
      "Server 完成 DB 读写 / AI 转发 → 返回 RSC payload 或 JSON",
      "浏览器收到结构化结果增量渲染（无需整页刷新）",
    ],
    patterns: [
      "组件：Server Component 默认，可交互处下放 Client（明确 'use client' 边界）",
      "数据：Server Actions 写、RSC 直查读；避免客户端直连数据库",
      "鉴权：Supabase Auth + JWT，middleware 保护业务目录",
      "安全：所有密钥只存在于 .env.local / 服务端；API 层做入参校验",
      "AI：放在服务端 API 代理，前端只读流",
    ],
    scaling: [
      "默认单体全栈即可；登录与营销页靠 RSC 静态化/CDN 提速",
      "RSC 直查变慢时，把热点查询下沉为 Route Handler + 缓存/分页",
      "数据量大后启用 Supabase 的视图/物化/分区，而非提前拆服务",
    ],
  },

  t3_app: {
    stackId: "t3_app",
    pattern: "端到端类型安全的 Next.js 全栈：tRPC 把前后端粘合成一个强类型 RPC 通道，Prisma 管数据，鉴权在 tRPC 中间件。",
    tree: `project/
├─ app/                 # 路由（App Router）
├─ server/
│  ├─ api/              # tRPC router 与 procedure 定义
│  │  ├─ root.ts
│  │  └─ routers/       # 按域拆分：auth / post / ai ...
│  ├─ db.ts             # Prisma client 单例
│  └─ auth.ts           # NextAuth / Lucia 配置
├─ trpc/                # 客户端 + RSC 的 tRPC 封装
│  ├─ server.ts         # 服务端 caller / 中间件
│  └─ client.tsx        # 客户端 provider
├─ components/
├─ lib/
├─ prisma/
│  ├─ schema.prisma
│  └─ seed.ts
├─ middleware.ts
└─ tailwind.config.ts`,
    layers: [
      { id: "presentation", name: "表现层（RSC + tRPC 客户端调用）", path: "app/ + components/", responsibilities: ["渲染与交互", "通过 tRPC hooks 取数，不直接碰 Prisma"], keywords: ["home", "login", "dashboard", "主页", "登录", "仪表盘"] },
      { id: "api-layer", name: "RPC 层（tRPC procedures）", path: "server/api/routers/", responsibilities: ["类型安全的路由与过程", "在 procedure 中间件做鉴权与限流"], keywords: ["api", "procedure", "query", "mutation", "接口", "数据"] },
      { id: "data-layer", name: "数据层（Prisma + PostgreSQL）", path: "prisma/ + server/db.ts", responsibilities: ["Schema 迁移、种子数据", "类型安全的查询"], keywords: ["db", "prisma", "table", "存储"] },
      { id: "auth", name: "鉴权（tRPC 中间件 + Auth）", path: "server/auth.ts", responsibilities: ["session 管理与 provider", "按身份保护 procedures"], keywords: ["auth", "session", "role", "鉴权", "权限"] },
      { id: "ai-integration", name: "AI 集成（tRPC procedure 转发）", path: "server/api/routers/ai.ts", responsibilities: ["服务端转发 AI SDK", "流式 SSE", "不透出密钥"], keywords: ["ai", "chat", "llm", "agent", "智能"] },
    ],
    dataFlow: [
      "客户端 tRPC hook → 类型安全请求",
      "tRPC server 中间件校验登录态 → 进入 router procedure",
      "procedure 用 Prisma 读写 DB 或转发 AI",
      "返回强类型数据 → 客户端自动推断类型",
    ],
    patterns: [
      "一处定义类型，前后端共享，杜绝手写接口/客户端",
      "鉴权做成 procedure 中间件，业务路由复用",
      "DB 单例 Prisma.js（避免热更新重复连接）",
      "AI 走 procedure 流式返回，密钥在服务端",
    ],
    scaling: [
      "tRPC 天然类型安全，适合中早期全栈 TS 团队",
      "分域 router 便于按业务拆分",
      "对外服务第三方客户端时，再为 tRPC 加一层 REST/GraphQL 网关",
    ],
  },

  remix_supabase: {
    stackId: "remix_supabase",
    pattern: "Remix 全栈数据流（Loader/Action 服务端优先）＋ Supabase。SEO 与交互并重，表单与乐观更新靠 Action 收口。",
    tree: `project/
├─ app/
│  ├─ routes/           # 文件路由 + 每个路由的 loader/action
│  ├─ components/
│  ├─ lib/              # Supabase server/client 工具
│  │  ├─ server/supabase.ts
│  │  └─ client/supabase.ts
│  └─ root.tsx
├─ middleware.ts
├─ supabase/
└─ tailwind.config.ts`,
    layers: [
      { id: "route", name: "路由层（Loader/Action）", path: "app/routes/", responsibilities: ["每个页面一个路由：loader 取数、action 写库", "服务端渲染与重验证（seo/局部刷新）"], keywords: ["home", "login", "dashboard", "pricing", "主页", "登录", "定价", "仪表盘"] },
      { id: "presentation", name: "表现层（Route 组件）", path: "app/routes/ + components/", responsibilities: ["渲染 UI 与表单", "用 useFetcher/Form 驱动 action"], keywords: ["page", "form", "ui", "页面", "表单"] },
      { id: "data-layer", name: "数据访问 + Supabase", path: "app/lib/", responsibilities: ["服务端用 supabase-js 服务端密钥", "客户端仅用 anon key + RLS"], keywords: ["data", "db", "query", "数据", "存储"] },
      { id: "auth", name: "鉴权（Supabase Auth + Cookie）", path: "middleware.ts + app/lib/", responsibilities: ["session cookie 刷新与保护", "route 级鉴权跳转"], keywords: ["auth", "session", "login", "鉴权", "权限"] },
      { id: "ai-integration", name: "AI 集成（Action 转发）", path: "app/routes/api.ai.* + app/lib/ai/", responsibilities: ["Action 内持密钥调用 AI SDK", "流式响应"], keywords: ["ai", "chat", "llm", "agent", "智能"] },
    ],
    dataFlow: [
      "请求命中 route → loader 在服务端取数（含 Supabase）",
      "表单提交 → action 服务端校验与写库 → 触发重验证",
      "useFetcher 做局部提交/乐观更新",
      "AI 在 action 内流式返回",
    ],
    patterns: [
      "数据加载全部在 loader，客户端尽量无状态",
      "表单用 action + useActionData 收口校验/错误",
      "Supabase 分 server/client 两个客户端，密钥只进 server",
      "middleware 负责 session 更新与路由保护",
    ],
    scaling: [
      "Remix 嵌套路由天然利于内容+交互产品",
      "复杂页面按路由细粒度假设，控制重新验证范围",
      "热点查询下沉 API 或加缓存，避免 loader 全量重跑",
    ],
  },

  sveltekit_supabase: {
    stackId: "sveltekit_supabase",
    pattern: "SvelteKit 编译期零框架运行时 + Server Load/Hooks 服务端能力 + Supabase。极致体积与 DX。",
    tree: `project/
├─ src/
│  ├─ routes/           # 文件路由
│  │  ├─ +page.svelte
│  │  ├─ +page.server.ts   # loader（服务端取数）
│  │  ├─ +layout.svelte
│  │  └─ api/              # server endpoints
│  ├─ lib/
│  │  ├─ server/           # 服务端工具（supabase server client）
│  │  ├─ supabaseClient.ts
│  │  └─ ai/               # AI 封装
│  └─ hooks.server.ts   # 会话/鉴权 hooks
├─ static/
├─ supabase/
├─ .env
└─ tailwind.config.ts`,
    layers: [
      { id: "route", name: "路由 + Server Load", path: "src/routes/**/+page.server.ts", responsibilities: ["每个页面在服务端 load 数据", "表单用 +page.server.ts actions 写库"], keywords: ["home", "login", "dashboard", "pricing", "主页", "登录", "定价", "仪表盘"] },
      { id: "presentation", name: "表现层（Svelte 组件）", path: "src/routes/**/+page.svelte + src/lib", responsibilities: ["渲染与本地交互", "组件级状态由 Svelte 管理"], keywords: ["page", "ui", "form", "页面", "表单"] },
      { id: "data-layer", name: "数据访问 + Supabase", path: "src/lib/server/", responsibilities: ["服务端读取用服务端密钥", "客户端订阅用 anon + RLS"], keywords: ["db", "query", "data", "数据", "存储"] },
      { id: "auth", name: "鉴权（Hooks.server）", path: "src/hooks.server.ts", responsibilities: ["在 handle hook 里读 session", "保护受保护路由"], keywords: ["auth", "session", "login", "鉴权", "权限"] },
      { id: "ai-integration", name: "AI 集成（Server Endpoint）", path: "src/routes/api/ai/+server.ts", responsibilities: ["服务端转发 AI SDK 并流式返回"], keywords: ["ai", "chat", "llm", "agent", "智能"] },
    ],
    dataFlow: [
      "页面导航 → +page.server.ts load 在服务端取数 → 组件可读 $data",
      "表单提交 → +page.server.ts actions 校验写库并返回",
      "AI 请求 → server endpoint 流式 SSE",
      "会话由 hooks.server 注入 layout store",
    ],
    patterns: [
      "数据获取都放 +page.server load；客户端只消费",
      "Server Hooks 统一鉴权，避免逐页重复",
      "Supabase 服务端 client 只 import 自 server 目录",
      "编译期零运行时，包体优先",
    ],
    scaling: [
      "SvelteKit 适合中小型高 DX 产品",
      "服务端负载均衡/边缘适配器可横向扩容",
      "数据热点转独立 API 或缓存",
    ],
  },

  nuxt_firebase: {
    stackId: "nuxt_firebase",
    pattern: "Nuxt 3 全栈数据流（useAsyncData/Server Routes）＋ Firebase（Auth/Firestore/Functions）。Vue 生态一体化。",
    tree: `project/
├─ app/
│  ├─ pages/            # 文件路由 + Nuxt 页面
│  ├─ layouts/
│  ├─ components/
│  ├─ server/
│  │  ├─ api/           # Nitro 服务端路由（Functions 之外）
│  │  └─ utils/         # 服务端 Firebase admin
│  └─ app.vue
├─ middleware/          # 路由鉴权中间件
├─ lib/
│  ├─ firebase.client.ts # 客户端 SDK（anon + rules）
│  └─ firebase.server.ts # admin SDK（仅服务端）
├─ stores/              # Pinia（可选，需要全局共享时）
├─ .env
└─ tailwind.config.ts`,
    layers: [
      { id: "presentation", name: "表现层（Nuxt 页面）", path: "app/pages/ + app/components/", responsibilities: ["渲染与组合式 API 交互", "useAsyncData 在服务端取数"], keywords: ["home", "login", "dashboard", "pricing", "主页", "登录", "定价", "仪表盘"] },
      { id: "server-route", name: "服务端路由（Nitro / Cloud Functions）", path: "app/server/api/", responsibilities: ["Nitro server 路由处理逻辑与三方转发", "重逻辑可下放 Cloud Functions"], keywords: ["api", "server", "function", "接口"] },
      { id: "data-layer", name: "数据层（Firestore）", path: "Firebase + lib/firebase.*.ts", responsibilities: ["实时文档读写", "security rules 权限（客户端只走规则）", "服务端用 admin 绕过规则或做批量"], keywords: ["db", "firestore", "data", "数据", "存储"] },
      { id: "auth", name: "鉴权（Firebase Auth）", path: "lib/firebase.client.ts + middleware/", responsibilities: ["邮箱/Google 登录", "路由中间件保护"], keywords: ["auth", "login", "session", "鉴权", "权限"] },
      { id: "ai-integration", name: "AI 集成（Functions 转发）", path: "app/server/api/ai/ 或 Cloud Functions", responsibilities: ["服务端持密钥调 AI", "流式返回"], keywords: ["ai", "chat", "llm", "agent", "智能"] },
    ],
    dataFlow: [
      "页面挂载 → useAsyncData 经 Nitro 服务端取数",
      "实时文档用 onSnapshot 订阅",
      "写操作经 security rules 校验",
      "AI 走 Nitro server route / Cloud Function",
    ],
    patterns: [
      "数据收敛到 Nitro 服务端 + Firebase admin",
      "客户端只用 anon SDK 依赖 security rules",
      "全局状态按需用 Pinia，不过度",
      "开放前先完善 Firestore security rules",
    ],
    scaling: [
      "Firestore 适合中小型实时/协作产品",
      "重查询做聚合与分页，避免全表扫描",
      "规模上来后可把热逻辑迁到独立后端服务",
    ],
  },

  astro_supabase: {
    stackId: "astro_supabase",
    pattern: "Astro Islands：默认零 JS 静态输出 + 按需岛屿交互，内容与 SEO 优先；Supabase 做后端与数据。",
    tree: `project/
├─ src/
│  ├─ pages/            # 内容页（静态生成）
│  ├─ layouts/
│  ├─ components/       # 含需要交互时才有岛屿
│  │  └─ islands/       # 客户端交互（+client:load）
│  ├─ content/          # 内容集合（collections）
│  └─ lib/
│     ├─ supabase.server.ts
│     └─ ai/
├─ astro.config.ts
├─ .env
└─ tailwind.config.ts`,
    layers: [
      { id: "content", name: "内容层（Content Collections）", path: "src/content/", responsibilities: ["以 Markdown/数据定义内容", "静态生成首页/文章/页面"], keywords: ["docs", "blog", "content", "contentful", "文章", "文档"] },
      { id: "presentation", name: "表现层（Astro 页面 + 岛屿）", path: "src/pages/ + src/components/", responsibilities: ["默认零 JS 页面", "仅交互模块做岛屿（client:*)", "SEO 站内元数据"], keywords: ["home", "about", "pricing", "docs", "主页", "定价", "文档"] },
      { id: "islands", name: "交互岛屿（Islands）", path: "src/components/islands/", responsibilities: ["需要交互的局部组件（搜索/表单/图表）", "懒加载，最小 JS"], keywords: ["search", "form", "chat", "search", "搜索", "表单"] },
      { id: "data-layer", name: "数据层 + Supabase", path: "src/lib/supabase.server.ts + 项目 API", responsibilities: ["静态内容走构建期", "动态数据在 SSR/API 读 Supabase，或页面提交写库"], keywords: ["db", "data", "query", "数据", "存储"] },
      { id: "ai-integration", name: "AI 集成（SSR / Integration）", path: "src/lib/ai/ + SSR 端点", responsibilities: ["构建期生成 AI 内容，或按需 Serverless 调用"], keywords: ["ai", "llm", "chat", "智能"] },
    ],
    dataFlow: [
      "内容静态生成 → CDN 预热最快首屏",
      "岛屿按需 hydrate，交互才下载 JS",
      "动态操作走 Supabase / Serverless 端点",
      "AI 内容可构建期预生成，减少运行时成本",
    ],
    patterns: [
      "默认静态、内容用 collections 建模",
      "交互收敛到岛屿，避免全站 JS",
      "SEO 优先：每页 meta/OG/结构化数据",
      "动态写操作为数不多，走服务端端点",
    ],
    scaling: [
      "内容型完全静态，成本与延迟极低",
      "岛屿化控制在局部，保持轻量",
      "交互加重后局部迁移到全栈栈（如再引 App Router）",
    ],
  },

  react_express: {
    stackId: "react_express",
    pattern: "前后端彻底分离：React SPA(客户端渲染)＋ Node/Python 后端 API。后端负责业务、数据库与 AI，前端只管渲染与调用。",
    tree: `frontend/                  # React SPA (Vite)
├─ src/
│  ├─ pages/
│  ├─ components/
│  ├─ api/               # 前端 API client（Axios/Fetch 封装）
│  ├─ stores/            # 状态管理（Redux/Zustand/Pinia）
│  └─ router.tsx
backend/                   # Express / FastAPI
├─ src/
│  ├─ routes/            # API 路由
│  ├─ controllers/       # 请求处理
│  ├─ services/          # 业务逻辑
│  ├─ repository/        # 数据访问（Prisma/ORM）
│  ├─ middleware/        # 鉴权/校验/日志
│  └─ ai/                # AI 调用
├─ prisma/schema.prisma  # 或 SQLAlchemy 模型
├─ .env
└─ requirements.txt / package.json`,
    layers: [
      { id: "frontend", name: "前端（React SPA）", path: "frontend/src/", responsibilities: ["页面渲染与交互", "统一 API client 调后端", "局部状态管理"], keywords: ["home", "login", "dashboard", "pricing", "主页", "登录", "定价", "仪表盘"] },
      { id: "api-route", name: "API 层（路由 + 控制器）", path: "backend/src/routes/ + controllers/", responsibilities: ["HTTP 出入口、参数校验、状态码", "不写业务逻辑，仅编排"], keywords: ["api", "rest", "endpoint", "接口"] },
      { id: "service", name: "业务层（Services）", path: "backend/src/services/", responsibilities: ["核心业务逻辑", "编排 repository 与 AI 调用", "事务边界"], keywords: ["business", "logic", "业务", "service"] },
      { id: "data-layer", name: "数据访问层（Repository/ORM）", path: "backend/src/repository/ + prisma/", responsibilities: ["数据库 CRUD", "迁移与种子"], keywords: ["db", "query", "repository", "orm", "数据", "存储"] },
      { id: "auth", name: "鉴权中间件", path: "backend/src/middleware/", responsibilities: ["JWT/OAuth 校验", "RBAC 权限"], keywords: ["auth", "jwt", "role", "权限", "鉴权"] },
      { id: "ai-integration", name: "AI 集成（后端直接调用）", path: "backend/src/ai/", responsibilities: ["持密钥调 AI SDK", "流式 SSE，限流与兜底"], keywords: ["ai", "chat", "llm", "agent", "智能"] },
    ],
    dataFlow: [
      "前端 dispatch → API client → REST 请求",
      "后端 route 校验 → controller → service 编排",
      "service 调 repository（DB）或 AI",
      "返回 JSON → 前端更新状态与视图",
      "AI 走 SSE/流式，前端逐块渲染",
    ],
    patterns: [
      "MVC/分层：route → controller → service → repository，单向依赖",
      "前端不直连 DB，一切经后端 API",
      "鉴权统一在中间件，业务层无感知",
      "密钥全部在后端 .env，前端零密钥",
    ],
    scaling: [
      "前后端分离天然可独立扩容前端(CDN)与后端(多实例)",
      "service 层拆分边界清晰后可按域拆微服务",
      "加网关/限流/缓存即可平滑放大并发",
    ],
  },

  django_postgres: {
    stackId: "django_postgres",
    pattern: "Django「电池齐全」单体：ORM/Admin/Auth 开箱即用；内容与后台型产品首选。模板或 SPA 混合渲染。",
    tree: `project/                # Django project
├─ manage.py
├─ config/               # settings/urls/asgi
├─ apps/                 # Django apps（按业务域拆分）
│  ├─ core/              # 用户/通用
│  ├─ content/           # 内容模块
│  └─ ai/                # AI 模块
├─ templates/            # 服务端模板（如用模板渲染）
├─ static/
├─ requirements.txt
└─ .env`,
    layers: [
      { id: "presentation", name: "表现层（模板 / DRF）", path: "templates/ + apps/*/views/", responsibilities: ["服务端渲染或提供 REST API", "模板继承与组件化标签"], keywords: ["home", "dashboard", "admin", "主页", "模板", "dashboards"] },
      { id: "api-route", name: "API/视图层（Django REST Framework）", path: "apps/*/views.py + urls.py", responsibilities: ["序列化与视图集", "权限与版本控制"], keywords: ["api", "view", "serializer", "接口", "rest"] },
      { id: "service", name: "业务层（Services）", path: "apps/*/services.py", responsibilities: ["把重逻辑从视图抽出", "事件/订阅触发"], keywords: ["logic", "business", "service", "业务"] },
      { id: "data-layer", name: "数据层（Django ORM + Migrations）", path: "apps/*/models.py + migrations/", responsibilities: ["模型与迁移", "Admin 注册", "PostgreSQL 查询优化"], keywords: ["db", "model", "query", "orm", "数据", "存储"] },
      { id: "ai-integration", name: "AI 集成（Celery + SDK）", path: "apps/ai/ + 异步任务", responsibilities: ["Celery 异步调用 AI", "防阻塞请求；结果回写/通知"], keywords: ["ai", "llm", "celery", "async", "智能"] },
      { id: "auth", name: "认证（Django Auth / 三方）", path: "config + apps/core/", responsibilities: ["用户/会话/权限", "OAuth 第三方登录"], keywords: ["auth", "login", "user", "鉴权", "权限"] },
    ],
    dataFlow: [
      "请求 → url 路由 → view（校验权限）→ service 编排",
      "service 用 ORM 查询/写库，或派发 Celery 异步 AI 任务",
      "异步任务结果回写 DB → 页面/通知读最新状态",
      "API 走 DRF 序列化返回",
    ],
    patterns: [
      "业务逻辑放 service，视图只做编排",
      "重计算/长任务放 Celery，保持请求响应快",
      "权限（RBAC/OAuth）用 Django 内置 + 自定义中间件",
      "模板项目性能优先考虑缓存页/模型",
    ],
    scaling: [
      "单体足以支撑内容/后台型产品",
      "用 DB 连接池/缓存与只读副本提升吞吐",
      "按 app 边界可渐进拆分为多服务",
    ],
  },

  rails_postgres: {
    stackId: "rails_postgres",
    pattern: "Rails 约定优于配置：MVP 快速成型、全栈单体（MVC）、自带 ORM/认证/Job/实时。",
    tree: `project/
├─ app/
│  ├─ models/            # 模型与领域逻辑
│  ├─ controllers/       # 控制器
│  ├─ views/             # ERB/ViewComponent
│  ├─ jobs/              # 后台任务（AI/邮件）
│  ├─ channels/          # ActionCable 实时
│  └─ services/          # 领域服务（粗逻辑）
├─ config/               # routes/database 等
├─ db/migrate/           # 迁移
├─ lib/                  # 复用代码
└─ Gemfile`,
    layers: [
      { id: "presentation", name: "表现层（Views + ViewComponent）", path: "app/views/", responsibilities: ["页面渲染", "Hotwire/Stimulus 增强交互"], keywords: ["home", "login", "dashboard", "pricing", "主页", "登录", "定价", "仪表盘"] },
      { id: "controller", name: "控制器（Controllers）", path: "app/controllers/", responsibilities: ["路由编排与参数清理", "调模型/服务，不写业务"], keywords: ["controller", "route", "api", "接口"] },
      { id: "model", name: "领域层（Models + Services）", path: "app/models/ + app/services/", responsibilities: ["业务逻辑、校验、关联", "服务对象收敛复杂流程"], keywords: ["model", "logic", "business", "业务", "数据"] },
      { id: "data-layer", name: "数据层（ActiveRecord 迁移）", path: "db/migrate/ + app/models/", responsibilities: ["表结构与迁移", "查询与索引"], keywords: ["db", "migration", "query", "数据", "存储"] },
      { id: "job", name: "异步层（Active Job）", path: "app/jobs/", responsibilities: ["AI/邮件/数据处理后台队列"], keywords: ["job", "async", "queue", "异步", "任务"] },
      { id: "real-time", name: "实时层（ActionCable）", path: "app/channels/", responsibilities: ["WebSocket 推送与协作"], keywords: ["cable", "websocket", "realtime", "实时", "协作"] },
    ],
    dataFlow: [
      "请求 → routes → controller",
      "controller 调 model/service，DB 读写经 ActiveRecord",
      "重任务进 Active Job 队列；AI 结果异步回写",
      "实时用 ActionCable 推送，前端 channel 订阅",
    ],
    patterns: [
      "约定优于配置，减少样板；领域逻辑放模型/Service",
      "异步任务统一 Active Job（Sidekiq 驱动）",
      "前端交互走 Hotwire，SPA 化另接 Stimulus",
      "测试优先（model/request）保证重构安全",
    ],
    scaling: [
      "单体 MVP 极快；Rails 7 可支撑相当规模",
      "先做缓存/DB 优化，必要时按领域拆",
      "共享代码抽 gem，多服务也可复用",
    ],
  },

  laravel_vue: {
    stackId: "laravel_vue",
    pattern: "Laravel 全栈 MVC ＋ Vue/Inertia：无 SPA 割裂的前后端一体开发，认证/队列/邮件开箱即用，Inertia 传递页面组件数据。",
    tree: `project/
├─ app/
│  ├─ Http/
│  │  ├─ Controllers/
│  │  └─ Middleware/
│  ├─ Models/            # Eloquent ORM 模型
│  ├─ Services/          # 领域服务
│  └─ Jobs/              # 队列任务（AI/邮件）
├─ routes/web.php
├─ resources/
│  ├─ js/                # Vue 页面组件（Inertia）
│  │  ├─ Pages/
│  │  └─ Components/
│  └─ views/             # 入口模板
├─ database/migrations/
├─ config/
└─ .env`,
    layers: [
      { id: "presentation", name: "表现层（Vue + Inertia）", path: "resources/js/Pages/", responsibilities: ["页面组件渲染", "Inertia 共享数据与导航"], keywords: ["home", "login", "dashboard", "pricing", "主页", "登录", "定价", "仪表盘"] },
      { id: "controller", name: "控制器（Controllers）", path: "app/Http/Controllers/", responsibilities: ["请求编排、表单验证", "返回 Inertia 响应"], keywords: ["controller", "route", "api", "接口"] },
      { id: "service", name: "业务层（Services）", path: "app/Services/", responsibilities: ["复杂业务逻辑", "与队列/三方协作"], keywords: ["logic", "service", "business", "业务"] },
      { id: "data-layer", name: "数据层（Eloquent）", path: "app/Models/ + database/migrations/", responsibilities: ["模型/关系/迁移", "查询与索引"], keywords: ["db", "model", "eloquent", "数据", "存储"] },
      { id: "job", name: "异步层（Queues）", path: "app/Jobs/", responsibilities: ["AI/邮件/报表后台队列"], keywords: ["job", "queue", "async", "异步", "任务"] },
      { id: "auth", name: "认证（Laravel Auth + Sanctum）", path: "app/Http/Middleware/", responsibilities: ["登录与会话", "API token 与权限"], keywords: ["auth", "login", "api_token", "权限", "鉴权"] },
    ],
    dataFlow: [
      "浏览器 Inertia 请求 → 路由 → controller",
      "controller 校验并调 service/Eloquent 写读",
      "返回 Inertia 数据 → Vue 组件拿到 props 渲染",
      "重任务进队列异步执行并回写",
    ],
    patterns: [
      "Inertia 一体化：无需接口文档与前端数据层",
      "领域逻辑收进 Service，控制器保持薄",
      "队列统一驱动（Redis/DB），AI 走 Job",
      "表单验证集中在 FormRequest",
    ],
    scaling: [
      "Laravel 适合交付快、托管低成本的商业站",
      "用缓存与队列平滑上升期流量",
      "规模大后业务层可拆独立服务",
    ],
  },

  springboot_vue: {
    stackId: "springboot_vue",
    pattern: "企业级前后端分离：Spring Boot(Java) 分层架构 + Vue3 SPA。稳定、事务、安全体系完整，适合政企/金融/complex 业务。",
    tree: `backend/               # Spring Boot
├─ src/main/java/com/xxx/
│  ├─ controller/        # REST API 层
│  ├─ service/           # 业务层（事务 boundary）
│  ├─ repository/        # 数据访问（MyBatis/JPA）
│  ├─ entity/dto/vo/     # 模型与传输对象
│  ├─ config/            # 安全/异常/跨域
│  ├─ security/          # Spring Security + JWT
│  └─ aop/               # 切面（日志/权限）
├─ src/main/resources/
│  ├─ application.yml
│  └─ mapper/            # (MyBatis XML)
├─ pom.xml
frontend/               # Vue3 + Vite
├─ src/
│  ├─ api/               # 后端 API client
│  ├─ views/             # 页面
│  ├─ components/
│  ├─ stores/            # Pinia
│  └─ router.ts`,
    layers: [
      { id: "frontend", name: "前端（Vue3 SPA）", path: "frontend/src/", responsibilities: ["页面渲染与交互", "统一 API client、Pinia 状态"], keywords: ["home", "login", "dashboard", "pricing", "主页", "登录", "定价", "仪表盘"] },
      { id: "controller", name: "API 层（Controller + DTO/VO）", path: "backend/.../controller/", responsibilities: ["REST 出入参、状态码", "DTO/VO 隔离内外模型"], keywords: ["api", "controller", "rest", "接口"] },
      { id: "service", name: "业务层（Service + 事务）", path: "backend/.../service/", responsibilities: ["核心业务逻辑", "@Transactional 事务边界"], keywords: ["service", "logic", "business", "业务", "事务"] },
      { id: "data-layer", name: "数据访问层（Repository/MyBatis/JPA）", path: "backend/.../repository/ + mapper/", responsibilities: ["SQL/ORM CRUD", "分页与防注入"], keywords: ["db", "repository", "mapper", "sql", "数据"] },
      { id: "security", name: "安全层（Spring Security + JWT）", path: "backend/.../security/", responsibilities: ["身份认证、RBAC 鉴权", "接口放行策略"], keywords: ["auth", "security", "jwt", "rba", "鉴权", "权限"] },
      { id: "ai-integration", name: "AI 集成（RestTemplate/WebClient）", path: "backend/.../service/ai/", responsibilities: ["服务端转发 AI API", "流式与重试"], keywords: ["ai", "llm", "chat", "agent", "智能"] },
    ],
    dataFlow: [
      "Vue 调 API client → REST 请求 → Spring Controller",
      "Controller 转 DTO → Service 事务编排 → Repository 读写 DB",
      "Security 过滤器先于 Controller 校验 JWT",
      "结果包装统一返回 → 前端渲染",
      "AI 在 Service 内转发并流式回传",
    ],
    patterns: [
      "严格分层：Controller→Service→Repository 单向依赖",
      "统一异常处理/参数校验/返回包装（杜绝泄漏栈）",
      "安全优先：JWT + RBAC + 防注入（预编译 SQL）",
      "事务放在 Service 方法边界，不做长事务",
    ],
    scaling: [
      "Java 生态适合复杂业务与大型团队协作",
      "Service 边界清晰后可拆分模块/服务",
      "用网关、限流、缓存支撑高并发政企/金融量级",
    ],
  },

  go_react: {
    stackId: "go_react",
    pattern: "高并发后端优先：Go(短小精悍 API 服务) + 前端 React SPA。适合网关/实时/平台型产品。",
    tree: `backend/               # Go (Gin/Echo), cmd+internal 布局
├─ cmd/server/main.go   # 入口
├─ internal/
│  ├─ handler/          # HTTP handlers
│  ├─ service/          # 业务逻辑
│  ├─ repository/       # 数据访问
│  ├─ model/            # 领域模型/DTO
│  ├─ middleware/       # 鉴权/日志/CORS/限流
│  └─ ai/               # AI 调用（SSE）
├─ migrations/
├─ go.mod
├─ .env
frontend/               # React + Vite
├─ src/
│  ├─ api/
│  ├─ pages/
│  ├─ components/
│  ├─ stores/
│  └─ router.tsx`,
    layers: [
      { id: "frontend", name: "前端（React SPA）", path: "frontend/src/", responsibilities: ["页面渲染与交互", "API client + 状态管理"], keywords: ["home", "login", "dashboard", "pricing", "主页", "登录", "定价", "仪表盘"] },
      { id: "handler", name: "Handler 层", path: "internal/handler/", responsibilities: ["HTTP 出入参、状态码", "调用 service"], keywords: ["http", "api", "handler", "接口"] },
      { id: "service", name: "业务层（Service）", path: "internal/service/", responsibilities: ["核心逻辑与并发编排", "事务/一致性"], keywords: ["service", "logic", "business", "业务"] },
      { id: "data-layer", name: "数据访问层（Repository）", path: "internal/repository/", responsibilities: ["DB 查询（PostgreSQL/ClickHouse）", "连接池与索引"], keywords: ["db", "repository", "query", "数据", "存储"] },
      { id: "middleware", name: "中间件（鉴权/限流/日志）", path: "internal/middleware/", responsibilities: ["JWT 校验、RBAC", "限流、链路追踪、CORS"], keywords: ["auth", "jwt", "rate", "日志", "鉴权", "流量"] },
      { id: "ai-integration", name: "AI 集成（SSE 流式）", path: "internal/ai/", responsibilities: ["流式转发 AI API", "SSE 逐块下发"], keywords: ["ai", "llm", "sse", "stream", "智能"] },
    ],
    dataFlow: [
      "前端请求 → Go 中间件链（鉴权/限流）→ Handler",
      "Handler → Service 业务编排 → Repository 读写 DB",
      "服务并发模型（goroutine）承载高吞吐",
      "AI 走 SSE 流式，Handler 逐块写回响应",
    ],
    patterns: [
      "cmd + internal 标准布局，依赖单向",
      "中间件链统一处理横切关注点",
      "DB 预编译 SQL / 连接池，杜绝注入",
      "流式优先，Go 原生并发适合高吞吐",
    ],
    scaling: [
      "Go 单机吞吐高、部署为单二进制",
      "无状态多实例 + 负载均衡即扩容",
      "与 K8s 天然契合，适合平台/网关演进",
    ],
  },

  nextjs_appwrite: {
    stackId: "nextjs_appwrite",
    pattern: "一体化全栈 + 开源可自托管 BaaS（Appwrite）：认证/DB/存储/函数/实时一并在 BaaS，避免供应商锁定。",
    tree: `project/
├─ app/                 # 路由与页面（App Router）
│  ├─ (auth)/
│  ├─ (app)/dashboard/
│  └─ api/              # Server Actions / Route Handlers
├─ components/
├─ lib/
│  ├─ appwrite/         # Appwrite 客户端封装（server/client）
│  └─ ai/
├─ middleware.ts
├─ .env
└─ tailwind.config.ts`,
    layers: [
      { id: "rsc", name: "表现层（RSC + Client）", path: "app/ + components/", responsibilities: ["渲染页面", "Server Actions 处理变更"], keywords: ["home", "login", "dashboard", "pricing", "主页", "登录", "定价", "仪表盘"] },
      { id: "auth", name: "鉴权（Appwrite Auth）", path: "lib/appwrite/ + middleware.ts", responsibilities: ["邮箱/三方登录", "受保护路由"], keywords: ["auth", "login", "session", "鉴权", "权限"] },
      { id: "baas-data", name: "BaaS 数据层（Appwrite Database/Storage）", path: "lib/appwrite/", responsibilities: ["文档与存储", "权限与索引", "实时订阅"], keywords: ["db", "database", "storage", "collection", "数据", "存储"] },
      { id: "function", name: "函数层（Appwrite Functions）", path: "appwrite functions/ 或 Server Actions", responsibilities: ["三方转发与重逻辑", "定时任务"], keywords: ["function", "api", "server", "函数", "接口"] },
      { id: "ai-integration", name: "AI 集成（函数转发）", path: "lib/ai/ + functions/", responsibilities: ["服务端持密钥调 AI", "流式"], keywords: ["ai", "chat", "llm", "agent", "智能"] },
    ],
    dataFlow: [
      "页面交互 → Server Action 或 Appwrite SDK（客户端规则内）",
      "服务端操作走 Appwrite 服务端 SDK / Functions",
      "敏感逻辑收敛到 Functions，密钥不进 bundle",
      "实时订阅（chat/协作）用 Appwrite 实时",
    ],
    patterns: [
      "客户端仅用 Appwrite 权限规则内的操作",
      "密钥与重逻辑放 Functions 或服务端路由",
      "可自托管，迁移避免锁定",
      "AI 在服务端收敛，流式返回",
    ],
    scaling: [
      "BaaS + Next.js 适合独立开发者/小团队快速上线",
      "自托管可平滑扩容",
      "规模大后热逻辑迁独立后端",
    ],
  },

  cf_workers: {
    stackId: "cf_workers",
    pattern: "边缘优先、近零成本的轻量架构：静态站 + 边缘函数（Workers）＋ D1(SQLite)/R2 存储＋免费额度。",
    tree: `project/
├─ static/              # 构建产物/静态资源（CDN 分发）
├─ workers/             # 边缘函数
│  ├─ api/              # API Worker（Hono/裸）
│  └─ ai/               # AI 转发 Worker
├─ wrangler.toml        # 绑定 D1/R2/KV/AI
├─ d1/                  # migrations
├─ src/                 # 共享前端（可选 SPA 构建）
└─ .dev.vars            # 密钥（开发）`,
    layers: [
      { id: "static", name: "静态层（CDN 分发）", path: "static/", responsibilities: ["静态资源全球边缘分发", "SEO 站点"], keywords: ["home", "landing", "docs", "博客", "主页", "文档"] },
      { id: "edge-fn", name: "边缘函数（Workers API）", path: "workers/api/", responsibilities: ["轻量 API 逻辑", "读 D1/R2，限流"], keywords: ["api", "worker", "form", "endpoint", "接口", "表单"] },
      { id: "d1-storage", name: "存储层（D1/R2/KV）", path: "d1/ + workers/", responsibilities: ["结构化数据 D1", "文件 R2、缓存 KV"], keywords: ["db", "d1", "kv", "r2", "storage", "数据", "存储"] },
      { id: "ai-edge", name: "AI 层（Workers AI / 转发）", path: "workers/ai/", responsibilities: ["边缘调用 AI 或转发 OpenAI", "流式 SSE"], keywords: ["ai", "llm", "chat", "智能"] },
    ],
    dataFlow: [
      "静态站全球 CDN 直达，首屏极快",
      "API 请求就近命中边缘 Worker → 读 D1/R2",
      "AI 经 Workers AI 或转发，SSE 流式返回",
      "密钥在 .dev.vars / 环境绑定，不进客户端",
    ],
    patterns: [
      "优先静态，需动态才上边缘函数",
      "小数据用 D1(SQLite)，文件用 R2，缓存 KV",
      "按调用付费，冷启动快、免运维",
      "AI 收口在 Worker，配限流防滥用",
    ],
    scaling: [
      "全球边缘天然水平扩展",
      "受 CPU 时长限定，重计算要克制或下沉",
      "适合轻量/边缘/低成本产品，重业务再上大后端",
    ],
  },
};

/** 未收录实录时的兜底（避免生成端拿不到架构而报错） */
export const FALLBACK_ARCHITECTURE: ArchitectureKnowledge = {
  stackId: "fallback",
  pattern: "分层全栈（通用）：表现层 + 服务端层 + 数据层，职责单向依赖，密钥只进服务端。",
  tree: `project/
├─ app/            # 页面与路由
├─ components/     # 可复用 UI
├─ lib/            # 业务/工具逻辑
├─ server/         # 服务端 API 与数据访问
├─ db/             # 迁移与模型
└─ .env            # 密钥（不上前端）`,
  layers: [
    { id: "presentation", name: "表现层", path: "app/ + components/", responsibilities: ["渲染与交互", "调服务端 API"], keywords: ["home", "login", "dashboard", "主页", "登录", "仪表盘"] },
    { id: "server", name: "服务端层", path: "server/", responsibilities: ["接口与业务逻辑", "密钥收敛、鉴权"], keywords: ["api", "server", "auth", "接口", "鉴权"] },
    { id: "data", name: "数据层", path: "db/ + lib/", responsibilities: ["存储与查询", "迁移与索引"], keywords: ["db", "data", "query", "数据", "存储"] },
  ],
  dataFlow: ["请求 → 服务端层校验鉴权 → 数据层读写 → 返回"],
  patterns: ["分层单向依赖", "密钥只进服务端", "外部调用收敛到服务层"],
  scaling: ["按层边界渐进拆分", "缓存与限流平滑放大"],
};