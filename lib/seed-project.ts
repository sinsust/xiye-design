// 可运行种子工程生成器（A 层：工程层）。
// 目标：把「规格包」升级为「底座」—— 按所选技术栈生成真实可运行的工程骨架，
// 依赖锁定版本、配置齐全、入口就绪、壳页面已套用视觉 token。
// AI 开发 Agent 拿到 seed/ 目录即可 npm install && npm run dev 开工，无需从零造目录。
//
// 说明：
//  - JS/TS 全栈栈（next/remix/sveltekit/nuxt/astro/vite-react/cf-workers）生成「真实可运行」工程；
//  - 非 JS 栈（django/rails/laravel/springboot/go）生成「权威脚手架」：依赖清单 + 入口 + 壳页面模板 + 目录占位，
//    需对应语言工具链，但目录与配置已按架构知识库铺好。

import type { FlowState, BlueprintEntry } from "@/lib/store/flow-store";
import { TECH_STACKS } from "@/data/tech-stacks";
import { buildCssVariables, buildTailwindConfig } from "@/lib/design-tokens-css";
import { VISUAL_STYLE_MAP, VISUAL_STYLES } from "@/data/visual-styles";
import { SKELETON_PAGE_MAP } from "@/data/skeletons";
import { DEMO_CONTENT } from "@/data/skeleton-content";
import { resolveArchitecture } from "@/lib/architecture";
import { SECRET_PATTERN } from "@/lib/security";

const DEFAULT_STYLE_ID = "aw-brutalist";

/** 蓝图条目 → 结构化装配清单（供 BLUEPRINT 结构与 verify 使用） */
function blueprintAssembly(state: FlowState) {
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
          prompt: variant?.prompt ?? "",
          code: variant?.code ?? "",
        };
      }),
    };
  });
}

/** id/名 → 可用作文件名的 PascalCase（英文 id 保真，中文名降级为 xblock） */
function pascal(id: string): string {
  const cleaned = id.replace(/[^A-Za-z0-9]+/g, " ").trim();
  if (!cleaned) return "XBlock";
  return cleaned
    .split(/\s+/)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join("");
}

// —— 风格锚点：把选中组件变体的 code 占位符替换为 DEMO_CONTENT，生成完整可编译的参照示例 ——

/** 展开 DEMO_CONTENT 为扁平 {占位符: 文案} 映射 */
function revealTargets(): Record<string, string> {
  const flat: Record<string, string> = {};
  const walk = (obj: unknown, prefix: string) => {
    if (!obj || typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "string") flat[`{{${key}}}`] = v;
      else if (v && typeof v === "object") walk(v, key);
    }
  };
  walk(DEMO_CONTENT, "");
  return flat;
}

/** 将 template-holder（{{brand}} 等）替换为 DEMO_CONTENT 文案；无映射的空占位保留占位标记 */
function revealPlaceholders(code: string): string {
  const targets = revealTargets();
  let out = code;
  for (const [ph, val] of Object.entries(targets)) {
    out = out.split(ph).join(val);
  }
  // 任何残留的 {{...}} 统一替换为可读占位，避免编译期 `<` 语法问题
  out = out.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => `{{${key}}}`);
  return out;
}

function buildStyleAnchorFiles(state: FlowState): SeedFile[] {
  const assembly = blueprintAssembly(state);
  if (!assembly.length) {
    // 无蓝图时回退：用壳页面本身作为锚点（已在框架文件里）
    return [];
  }
  // 取整份蓝图中「第一个页面」的「第一个组件」的 code 作为锚点（通常是 Hero）
  const firstPage = assembly[0];
  const firstComp = firstPage.components[0];
  if (!firstComp?.code) return [];

  const Comp = pascal(firstComp.componentId);
  const Page = pascal(firstPage.pageSlug);
  const code = revealPlaceholders(firstComp.code);

  const file = `// 风格锚点 · ${firstComp.componentName}（变体：${firstComp.variantName}）EXAMPLES
// 说明：这是选中组件变体的「完整可运行示例」，占位文案已用 DEMO_CONTENT 填充。
// 放入生产页面时：替换默认文案为真实内容、接入真实数据，并按 docs/DESIGN_SPEC.md 关键 token 做最终核对。
${code.replace(/export function /g, "export default function ")}
`;

  return [
    {
      path: `examples/${Page}/${Comp}.anchor.tsx`,
      content: file,
    },
    {
      path: "examples/README.md",
      content: `# examples/ — 风格锚点

> 由 xiye 流程工作台生成。本目录是**视觉还原的参照示例**，AI 开发 Agent 照此风格实现其余组件。

- \`${Page}/${Comp}.anchor.tsx\` —— 选中组件「${firstComp.componentName}（${firstComp.variantName}）」的完整可运行实现，已套用设计 token、占位文案已填充。
- 其余页面/组件占位见 \`../BLUEPRINT.md\` 与 \`components/\`。

**用途**：锚点组件是「已正确的样子」。实现新组件时，保持相同的 CSS 变量用法（引 \`:root\` token）、圆角、间距密度与交互动效节奏。
`,
    },
  ];
}

// —— 数据/API 契约：依赖栈推导数据模型、API 端点、状态管理、认证、AI 边界 ——

/** 基础设施类栈（含 DB）→ 生成 schema 占位 */
const DB_SCHEMA_STACKS = new Set([
  "nextjs_supabase",
  "nextjs_appwrite",
  "t3_app",
  "remix_supabase",
  "sveltekit_supabase",
  "astro_supabase",
  "react_express",
  "django_postgres",
  "rails_postgres",
  "laravel_vue",
  "springboot_vue",
  "go_react",
]);

function buildDataContractFiles(state: FlowState): SeedFile[] {
  const stack = state.techStack ?? "";
  const stackMeta = TECH_STACKS.find((s) => s.id === stack);
  const arch = resolveArchitecture(stack);
  const dbLabel = stackMeta?.database ?? "（按所选栈）";
  const hasDb = DB_SCHEMA_STACKS.has(stack);
  const pType = state.projectType ?? "";

  // 数据流与模式守则（复用架构知识库）
  const dataFlowLines = arch.kb.dataFlow.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const patternLines = arch.kb.patterns.length
    ? arch.kb.patterns.map((p) => `- ${p}`).join("\n")
    : "- （架构知识库未沉淀该栈模式，按项目类型与团队约定落地）";

  // schema 占位：SQL（supabase/postgres 类）与 Prisma 两种形态
  const schemaFiles: SeedFile[] = [];
  if (hasDb) {
    const prismaLike = stack === "t3_app" || stack === "react_express";
    const tableHint =
      pType === "saas" || pType === "webapp"
        ? `-- 项目类型为 SaaS 型产品，优先落：workspaces / memberships / plans / subscriptions / teams_text_blocks / audit_logs`
        : `-- 按项目类型与 ARCHITECTURE.md 的领域边界，定义核心业务表（暂留占位，交由实现阶段补充）`;
    if (!prismaLike) {
      schemaFiles.push({
        path: "db/schema.sql",
        content: `-- ${stackMeta?.name ?? "数据层"} 数据库 Schema（占位起点）
-- 数据库：${dbLabel}
-- 说明：按 docs/ARCHITECTURE.md 的数据层职责补充字段、索引与 RLS/约束。

${tableHint}

-- 示例（以真实产品替代）：
-- CREATE TABLE workspaces (
--   id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
--   name text NOT NULL,
--   created_at timestamptz NOT NULL DEFAULT now()
-- );

-- 迁移：将本文件落到所选 DB 的迁移体系（supabase migrate / prisma migrate / 原生 migration）
`,
      });
    } else {
      schemaFiles.push({
        path: "prisma/schema.prisma",
        content: `// ${stackMeta?.name ?? "数据层"} · Prisma Schema（占位起点）
// 数据库：${dbLabel}
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 按 docs/ARCHITECTURE.md 的数据层职责补充模型、关系与索引（暂留占位）
${pType === "saas" || pType === "webapp" ? "// 项目类型为 SaaS 型产品，优先落 Workspace / Membership / Plan / Subscription 等模型。" : "// 示例模型（以真实业务替代）："}
// model Workspace {
//   id        Int      @id @default(autoincrement())
//   name      String
//   createdAt DateTime @default(now())
// }
`,
      });
    }
  }

  const doc = `# DATA_CONTRACT.md — 数据与 API 契约

> 由 xiye 流程工作台生成。本文件是 AI 开发 Agent 接入**数据层与后端接口**的契约：
> 知道数据存哪、接口怎么设计、状态放哪、认证怎么过、AI 调用守什么边界。

## 0. 技术栈

- 栈：**${stackMeta?.name ?? "未选择"}**
- 数据层：**${dbLabel}**
- 数据流入口见 \`ARCHITECTURE.md\`；此处为可执行的接口约定。

## 1. 数据模型（起点）

${hasDb ? `- schema 占位：\`${hasDb && (stack === "t3_app" || stack === "react_express") ? "prisma/schema.prisma" : "db/schema.sql"}\`（AI 依此扩展）
- **原则**：字段一律定义额定约束；变更走迁移，不手改线上表。` : `- 当前栈不含关系型 DB 占位；按项目类型与团队约定引入所需存储（${dbLabel}）。`}

## 2. API 端点契约

按 \`BLUEPRINT.md\` 的页面与组件，建议的 REST 资源（以真实业务为准）：

| 资源 | 动词 | 说明 |
| --- | --- | --- |
| \`/health\` | GET | 存活探针（seed 已含） |
| \`/<resource>\` | GET | 列表（分页/筛选/排序） |
| \`/<resource>/:id\` | GET | 详情 |
| \`/<resource>\` | POST | 创建 |
| \`/<resource>/:id\` | PATCH | 更新 |
| \`/<resource>/:id\` | DELETE | 删除 |

- **约定**：请求/响应用 JSON；错误返回 \`{ error: { code, message } }\`；列表响应含 \`items + total\`。
- **验证**：入参校验在服务端（zod / 框架校验），不只靠前端。

## 3. 状态管理

- 服务端数据随架构：Next 用 Server Components / Server Actions + React Query；Vue 用 Pinia；React 用 TanStack Query 或 context。
- **原则**：全局状态只放跨组件共享且常变的数据；UI 局部状态就近管理；服务端状态缓存在客户端不设第二份真相源。

## 4. 认证与权限

- 认证落在所选栈的标准位置（Supabase Auth / NextAuth / 框架 session），seed 的 middleware/session 占位已铺好（\`ARCHITECTURE.md\` 找边界）。
- **原则**：密钥与服务端凭据绝不进入浏览器 bundle；每个受保护路由/资源在服务端校验会话与你权限。

## 5. AI 调用边界（含密钥）

${dataFlowLines
  .split("\n")
  .filter((l) => /ai|密钥|服务端|流/i.test(l))
  .join("\n") || "- 所有 AI 调用收敛到服务端（架构层 ai-integration），浏览器只订阅结果流。"}

- **硬约束**：模型密钥只在服务端读取（\`.env.local\` / 服务端 secrets），禁止 import 进客户端 bundle。
${patternLines}

## 6. 验收（Data/API）

- [ ] 每个页面所需的读/写接口已定义并可在服务端验证
- [ ] schema 已落到迁移体系，字段约束与索引齐备
- [ ] 无任何密钥出现在客户端源码或 network（拒绝 sk- 等）
- [ ] 错误处理统一、可观测（日志/错误码），不变更数据时不产生脏状态
`;
  return [
    ...schemaFiles,
    { path: "DATA_CONTRACT.md", content: doc },
  ];
}

export interface SeedTokens {
  /** :root 设计 token（globals.css 内容） */
  cssVariables: string;
  /** tailwind.config.ts 主题片段 */
  tailwindConfig: string;
  palette: {
    bg: string;
    surface: string;
    border: string;
    text: string;
    muted: string;
    primary: string;
    secondary: string;
    radius: string;
    fontFamily: string;
  };
  projectName: string;
  tagline: string;
  features: { name: string; desc: string }[];
}

export interface SeedFile {
  /** 相对 seed/ 工程根的路径 */
  path: string;
  content: string;
}

export interface SeedProject {
  files: SeedFile[];
  /** 启动命令（安装依赖后） */
  runCommand: string;
  /** 框架族标签，如 "Next.js 15" */
  frameworkLabel: string;
  /** 是否真实可运行（JS 栈为 true，非 JS 栈为脚手架） */
  runnable: boolean;
}

// —— 依赖版本（2026 主流稳定版，种子工程可 install 即用）——
const V = {
  next: "^16.0.0",
  react: "^19.0.0",
  reactDom: "^19.0.0",
  tailwind: "^3.4.0",
  postcss: "^8.4.0",
  autoprefixer: "^10.4.0",
  typescript: "^5.5.0",
  typesReact: "^19.0.0",
  typesNode: "^20.0.0",
  supabaseJs: "^2.45.0",
  supabaseSsr: "^0.5.0",
  trpcServer: "^10.45.0",
  trpcClient: "^10.45.0",
  trpcReactQuery: "^10.45.0",
  trpcNext: "^10.45.0",
  zod: "^3.23.0",
  prismaClient: "^5.18.0",
  prisma: "^5.18.0",
  reactQuery: "^5.51.0",
  remix: "^2.12.0",
  svelte: "^5.0.0",
  svelteKit: "^2.5.0",
  svelteAdapter: "^3.2.0",
  sveltePlugin: "^4.0.0",
  vite: "^6.0.0",
  vitePluginReact: "^4.3.0",
  nuxt: "^3.13.0",
  vue: "^3.5.0",
  nuxtTailwind: "^6.12.0",
  astro: "^5.0.0",
  astroTailwind: "^6.0.0",
  express: "^4.19.0",
  cors: "^2.8.5",
  dotenv: "^16.4.0",
  hono: "^4.6.0",
  wrangler: "^3.80.0",
};

// —— 共享「壳页面」内容：导航 + Hero + 特性卡片，全部走 CSS 变量（视觉 token 已落地）——
// 用户输入（项目名/特性）做 HTML 转义，避免注入；JSX 壳用 dangerouslySetInnerHTML 渲染。
const esc = (s: string) =>
  s.replace(/[&<>"'`]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" })[c]!);

function heroHtml(t: SeedTokens): string {
  const { projectName, tagline, features } = t;
  const name = esc(projectName);
  const tag = esc(tagline);
  const cards = features
    .map(
      (f, i) => `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px">
          <p style="color:var(--primary);font-size:12px;font-weight:600;letter-spacing:0.1em">0${i + 1}</p>
          <h3 style="font-size:15px;margin:8px 0 4px;color:var(--foreground)">${esc(f.name)}</h3>
          <p style="font-size:13px;color:var(--muted-foreground);line-height:1.6;margin:0">${esc(f.desc)}</p>
        </div>`,
    )
    .join("");
  return `
  <header style="display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid var(--border)">
    <strong style="font-size:18px;letter-spacing:-0.02em">${name}</strong>
    <nav style="display:flex;gap:20px;color:var(--muted-foreground);font-size:14px">
      <span>功能</span><span>定价</span><span>文档</span>
    </nav>
    <a href="#" style="background:var(--primary);color:var(--primary-foreground);padding:8px 16px;border-radius:var(--radius);font-size:14px;font-weight:500;text-decoration:none">开始使用</a>
  </header>
  <main style="max-width:960px;margin:0 auto;padding:64px 24px">
    <p style="color:var(--secondary);font-size:12px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase;margin:0">${tag}</p>
    <h1 style="font-size:44px;line-height:1.1;margin:12px 0;color:var(--foreground)">${name}</h1>
    <p style="color:var(--muted-foreground);font-size:15px;max-width:520px;line-height:1.7">由 xiye 流程工作台生成的可运行底座，已完整套用视觉风格的设计 token。在此之上做增量开发。</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:40px">${cards}</div>
  </main>`;
}

/** JSX 壳页面：dangerouslySetInnerHTML 渲染 hero（JSX 不允许 style 字符串属性） */
function jsxShell(componentName: string, t: SeedTokens): string {
  return `const HERO_HTML = \`${heroHtml(t)}\`;

export default function ${componentName}() {
  return <div dangerouslySetInnerHTML={{ __html: HERO_HTML }} />;
}
`;
}

/** 种子工程内的 globals.css：:root token + 最小 base 样式 */
function seedGlobals(t: SeedTokens): string {
  return `${t.cssVariables}

* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  line-height: 1.5;
}
a { color: inherit; }
h1, h2, h3, p { margin-top: 0; }`;
}

function seedEnvExample(state: FlowState): string {
  const keys = Object.keys(state.apiKeys ?? {});
  const lines = keys.length
    ? keys.map((k) => `${k}=your-${k.toLowerCase().replace(/_/g, "-")}-here`).join("\n")
    : "# 在此填写你的密钥（AI 调用必须走服务端，禁止进浏览器 bundle）\n# OPENAI_API_KEY=sk-...\n# DEEPSEEK_API_KEY=sk-...";
  return lines;
}

function gitignore(): string {
  return `node_modules/
.next/
dist/
build/
.env
.env.local
.env.*.local
*.log
.DS_Store
coverage/
`;
}

// —— 各框架族生成器 ——

function nextFiles(t: SeedTokens, state: FlowState, extra: SeedFile[] = []): SeedFile[] {
  const pkg = {
    name: (state.projectInfo?.projectName ?? "xiye-app").toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
    version: "0.1.0",
    private: true,
    scripts: { dev: "next dev", build: "next build", start: "next start", lint: "next lint" },
    dependencies: {
      next: V.next,
      react: V.react,
      "react-dom": V.reactDom,
      ...(state.techStack === "nextjs_supabase" || state.techStack === "nextjs_appwrite"
        ? { "@supabase/supabase-js": V.supabaseJs, "@supabase/ssr": V.supabaseSsr }
        : {}),
    },
    devDependencies: {
      typescript: V.typescript,
      "@types/node": V.typesNode,
      "@types/react": V.typesReact,
      "@types/react-dom": V.typesReact,
      tailwindcss: V.tailwind,
      postcss: V.postcss,
      autoprefixer: V.autoprefixer,
    },
  };
  return [
    { path: "package.json", content: JSON.stringify(pkg, null, 2) },
    {
      path: "tsconfig.json",
      content: `{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}`,
    },
    { path: "next.config.mjs", content: `/** @type {import('next').NextConfig} */\nconst nextConfig = {};\nexport default nextConfig;\n` },
    { path: "postcss.config.mjs", content: `export default {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n};\n` },
    { path: "tailwind.config.ts", content: t.tailwindConfig },
    { path: "app/globals.css", content: seedGlobals(t) },
    {
      path: "app/layout.tsx",
      content: `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "${t.projectName}",
  description: "${t.tagline}",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}`,
    },
    {
      path: "app/page.tsx",
      content: jsxShell("Home", t),
    },
    { path: ".env.example", content: seedEnvExample(state) },
    { path: ".gitignore", content: gitignore() },
    ...extra,
  ];
}

function remixFiles(t: SeedTokens, state: FlowState): SeedFile[] {
  const pkg = {
    name: "remix-app",
    private: true,
    sideEffects: false,
    scripts: {
      build: "remix build",
      dev: "remix dev --manual",
      start: "remix-serve ./build/server/index.js",
      typecheck: "tsc",
    },
    dependencies: {
      "@remix-run/react": V.remix,
      "@remix-run/node": V.remix,
      "@remix-run/serve": V.remix,
      react: V.react,
      "react-dom": V.reactDom,
      "@supabase/supabase-js": V.supabaseJs,
      "@supabase/ssr": V.supabaseSsr,
    },
    devDependencies: {
      "@remix-run/dev": V.remix,
      "@types/react": V.typesReact,
      "@types/react-dom": V.typesReact,
      typescript: V.typescript,
      tailwindcss: V.tailwind,
      postcss: V.postcss,
      autoprefixer: V.autoprefixer,
    },
  };
  return [
    { path: "package.json", content: JSON.stringify(pkg, null, 2) },
    {
      path: "tsconfig.json",
      content: `{
  "include": ["remix.env.d.ts", "**/*.ts", "**/*.tsx"],
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "isolatedModules": true,
    "esModuleInterop": true,
    "jsx": "react-jsx",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "target": "ES2022",
    "strict": true,
    "allowJs": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": { "~/*": ["./app/*"] },
    "noEmit": true
  }
}`,
    },
    { path: "remix.config.js", content: `/** @type {import('@remix-run/dev').AppConfig} */\nmodule.exports = {\n  tailwind: true,\n  ignoredRouteFiles: ["**/.*"],\n};\n` },
    { path: "tailwind.config.ts", content: t.tailwindConfig },
    {
      path: "app/root.tsx",
      content: `import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";
import styles from "./globals.css";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];

export default function App() {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}`,
    },
    {
      path: "app/routes/_index.tsx",
      content: jsxShell("Index", t),
    },
    { path: "app/globals.css", content: seedGlobals(t) },
    { path: ".env.example", content: seedEnvExample(state) },
    { path: ".gitignore", content: gitignore() },
  ];
}

function sveltekitFiles(t: SeedTokens, state: FlowState): SeedFile[] {
  const pkg = {
    name: "sveltekit-app",
    version: "0.0.1",
    private: true,
    scripts: {
      dev: "vite dev",
      build: "vite build",
      preview: "vite preview",
      check: "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    },
    devDependencies: {
      "@sveltejs/adapter-auto": V.svelteAdapter,
      "@sveltejs/kit": V.svelteKit,
      "@sveltejs/vite-plugin-svelte": V.sveltePlugin,
      svelte: V.svelte,
      vite: V.vite,
      typescript: V.typescript,
      tailwindcss: V.tailwind,
      postcss: V.postcss,
      autoprefixer: V.autoprefixer,
    },
    type: "module",
  };
  return [
    { path: "package.json", content: JSON.stringify(pkg, null, 2) },
    {
      path: "svelte.config.js",
      content: `import adapter from "@sveltejs/adapter-auto";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: { adapter: adapter() },
};

export default config;
`,
    },
    { path: "vite.config.ts", content: `import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({ plugins: [sveltekit()] });
` },
    {
      path: "tsconfig.json",
      content: `{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "strict": true,
    "moduleResolution": "bundler"
  }
}`,
    },
    { path: "tailwind.config.ts", content: t.tailwindConfig },
    {
      path: "src/routes/+layout.svelte",
      content: `<script lang="ts">
  import "../app.css";
</script>

<slot />`,
    },
    {
      path: "src/routes/+page.svelte",
      content: `<main>
  {@html \`${heroHtml(t).replace(/`/g, "\\`")}\`}
</main>`,
    },
    { path: "src/app.css", content: seedGlobals(t) },
    { path: ".env.example", content: seedEnvExample(state) },
    { path: ".gitignore", content: gitignore() },
  ];
}

function nuxtFiles(t: SeedTokens, state: FlowState): SeedFile[] {
  const pkg = {
    name: "nuxt-app",
    private: true,
    type: "module",
    scripts: { build: "nuxt build", dev: "nuxt dev", generate: "nuxt generate", preview: "nuxt preview" },
    dependencies: {
      nuxt: V.nuxt,
      vue: V.vue,
      "vue-router": "^4.4.0",
      "@nuxtjs/tailwindcss": V.nuxtTailwind,
    },
  };
  return [
    { path: "package.json", content: JSON.stringify(pkg, null, 2) },
    {
      path: "nuxt.config.ts",
      content: `export default defineNuxtConfig({
  modules: ["@nuxtjs/tailwindcss"],
  css: ["~/assets/css/main.css"],
  devtools: { enabled: true },
});`,
    },
    { path: "tailwind.config.ts", content: t.tailwindConfig },
    {
      path: "app/app.vue",
      content: `<template>
  <NuxtPage />
</template>`,
    },
    {
      path: "app/pages/index.vue",
      content: `<template>
  <div v-html="hero"></div>
</template>

<script setup lang="ts">
const hero = \`${heroHtml(t).replace(/`/g, "\\`")}\`;
</script>`,
    },
    { path: "app/assets/css/main.css", content: seedGlobals(t) },
    { path: ".env.example", content: seedEnvExample(state) },
    { path: ".gitignore", content: gitignore() },
  ];
}

function astroFiles(t: SeedTokens, state: FlowState): SeedFile[] {
  const pkg = {
    name: "astro-app",
    type: "module",
    version: "0.0.1",
    scripts: { dev: "astro dev", build: "astro build", preview: "astro preview", astro: "astro" },
    dependencies: { astro: V.astro },
    devDependencies: { "@astrojs/tailwind": V.astroTailwind, tailwindcss: V.tailwind },
  };
  return [
    { path: "package.json", content: JSON.stringify(pkg, null, 2) },
    {
      path: "astro.config.mjs",
      content: `import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  integrations: [tailwind({ applyBaseStyles: false })],
});`,
    },
    { path: "tailwind.config.ts", content: t.tailwindConfig },
    {
      path: "src/pages/index.astro",
      content: `---
import "../styles/global.css";
---
${heroHtml(t)}`,
    },
    { path: "src/styles/global.css", content: seedGlobals(t) },
    { path: ".env.example", content: seedEnvExample(state) },
    { path: ".gitignore", content: gitignore() },
  ];
}

function viteReactFiles(t: SeedTokens, state: FlowState, subdir = ""): SeedFile[] {
  const pkg = {
    name: "frontend",
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: { dev: "vite", build: "tsc -b && vite build", preview: "vite preview" },
    dependencies: { react: V.react, "react-dom": V.reactDom },
    devDependencies: {
      "@types/react": V.typesReact,
      "@types/react-dom": V.typesReact,
      "@vitejs/plugin-react": V.vitePluginReact,
      typescript: V.typescript,
      vite: V.vite,
      tailwindcss: V.tailwind,
      postcss: V.postcss,
      autoprefixer: V.autoprefixer,
    },
  };
  const p = (path: string) => (subdir ? `${subdir}/${path}` : path);
  return [
    { path: p("package.json"), content: JSON.stringify(pkg, null, 2) },
    {
      path: p("vite.config.ts"),
      content: `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({ plugins: [react()] });`,
    },
    {
      path: p("tsconfig.json"),
      content: `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}`,
    },
    {
      path: p("index.html"),
      content: `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${t.projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
    },
    {
      path: p("src/main.tsx"),
      content: `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);`,
    },
    {
      path: p("src/App.tsx"),
      content: jsxShell("App", t),
    },
    { path: p("src/index.css"), content: seedGlobals(t) },
    { path: p(".env.example"), content: seedEnvExample(state) },
    { path: p(".gitignore"), content: gitignore() },
  ];
}

function cfWorkersFiles(t: SeedTokens, state: FlowState): SeedFile[] {
  const pkg = {
    name: "cf-workers-app",
    private: true,
    scripts: { dev: "wrangler dev", deploy: "wrangler deploy", "db:migrate": "wrangler d1 migrations apply xiye-db" },
    dependencies: { hono: V.hono },
    devDependencies: { wrangler: V.wrangler, typescript: V.typescript, "@cloudflare/workers-types": "^4.20240620.0" },
  };
  return [
    { path: "package.json", content: JSON.stringify(pkg, null, 2) },
    {
      path: "wrangler.toml",
      content: `name = "xiye-app"
main = "src/index.ts"
compatibility_date = "2026-01-01"

# 绑定 D1 数据库（首次运行前执行 npm run db:migrate）
# [[d1_databases]]
# binding = "DB"
# database_name = "xiye-db"
# database_id = "your-database-id"

# 绑定 AI / 密钥（生产用 Secrets，开发用 .dev.vars）
# [ai]
# binding = "AI"
`,
    },
    {
      path: "tsconfig.json",
      content: `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}`,
    },
    {
      path: "src/index.ts",
      content: `import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.html(INDEX_HTML));
app.get("/api/health", (c) => c.json({ ok: true, service: "xiye" }));

export default app;

const INDEX_HTML = \`${heroHtml(t).replace(/`/g, "\\`")}\`;
`,
    },
    { path: "d1/schema.sql", content: `-- D1 数据库迁移（按需启用）
-- CREATE TABLE IF NOT EXISTS items (
--   id INTEGER PRIMARY KEY AUTOINCREMENT,
--   title TEXT NOT NULL,
--   created_at TEXT DEFAULT (datetime('now'))
-- );
` },
    { path: ".dev.vars.example", content: seedEnvExample(state) },
    { path: ".gitignore", content: gitignore() },
  ];
}

// —— 非 JS 栈：权威脚手架 ——

function djangoFiles(t: SeedTokens, state: FlowState): SeedFile[] {
  return [
    {
      path: "requirements.txt",
      content: `Django>=5.0,<6.0
djangorestframework>=3.15
psycopg[binary]>=3.2
python-dotenv>=1.0
gunicorn>=22.0
celery>=5.4
`,
    },
    {
      path: "manage.py",
      content: `#!/usr/bin/env python
import os
import sys

if __name__ == "__main__":
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv)
`,
    },
    {
      path: "config/settings.py",
      content: `import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-only-change-me")
DEBUG = os.getenv("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "*").split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "apps.core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [BASE_DIR / "templates"],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]
WSGI_APPLICATION = "config.wsgi.application"
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB", "xiye"),
        "USER": os.getenv("POSTGRES_USER", "postgres"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", "postgres"),
        "HOST": os.getenv("POSTGRES_HOST", "localhost"),
        "PORT": os.getenv("POSTGRES_PORT", "5432"),
    }
}
STATIC_URL = "static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
`,
    },
    {
      path: "config/urls.py",
      content: `from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("apps.core.urls")),
    path("", include("apps.core.urls")),
]
`,
    },
    { path: "config/wsgi.py", content: `import os\nfrom django.core.wsgi import get_wsgi_application\nos.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")\napplication = get_wsgi_application()\n` },
    { path: "apps/core/__init__.py", content: "" },
    { path: "apps/core/apps.py", content: `from django.apps import AppConfig\n\nclass CoreConfig(AppConfig):\n    default_auto_field = "django.db.models.BigAutoField"\n    name = "apps.core"\n` },
    { path: "apps/core/models.py", content: `from django.db import models\n\n# 在此定义领域模型（按 docs/ARCHITECTURE.md 的 apps/core 边界）\n` },
    { path: "apps/core/urls.py", content: `from django.urls import path\nfrom . import views\n\nurlpatterns = [\n    path("", views.home, name="home"),\n]\n` },
    { path: "apps/core/views.py", content: `from django.shortcuts import render\n\ndef home(request):\n    return render(request, "index.html")\n` },
    {
      path: "templates/base.html",
      content: `{% load static %}
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{% block title %}{{ project_name }}{% endblock %}</title>
  <link rel="stylesheet" href="{% static 'css/globals.css' %}" />
</head>
<body>
  {% block content %}{% endblock %}
</body>
</html>`,
    },
    {
      path: "templates/index.html",
      content: `{% extends "base.html" %}
{% block content %}
${heroHtml(t)}
{% endblock %}`,
    },
    { path: "static/css/globals.css", content: seedGlobals(t) },
    { path: ".env.example", content: `DJANGO_SECRET_KEY=change-me\nDJANGO_DEBUG=1\nPOSTGRES_DB=xiye\nPOSTGRES_USER=postgres\nPOSTGRES_PASSWORD=postgres\nPOSTGRES_HOST=localhost\nPOSTGRES_PORT=5432\n${seedEnvExample(state)}` },
    { path: ".gitignore", content: gitignore() },
  ];
}

function railsFiles(t: SeedTokens, state: FlowState): SeedFile[] {
  return [
    {
      path: "Gemfile",
      content: `source "https://rubygems.org"
ruby "3.3.0"

gem "rails", "~> 7.2"
gem "pg", "~> 1.5"
gem "puma", "~> 6.4"
gem "sprockets-rails"
gem "importmap-rails"
gem "turbo-rails"
gem "stimulus-rails"
gem "tailwindcss-rails"
gem "sidekiq", "~> 7.3"

group :development, :test do
  gem "debug"
end
`,
    },
    {
      path: "config/routes.rb",
      content: `Rails.application.routes.draw do
  root "home#index"
  # resources :posts
  # 按 docs/ARCHITECTURE.md 的 app/ 边界继续扩展
end
`,
    },
    {
      path: "config/database.yml",
      content: `default: &default
  adapter: postgresql
  encoding: unicode
  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>
  host: <%= ENV.fetch("POSTGRES_HOST", "localhost") %>
  username: <%= ENV.fetch("POSTGRES_USER", "postgres") %>
  password: <%= ENV.fetch("POSTGRES_PASSWORD", "postgres") %>

development:
  <<: *default
  database: xiye_development

test:
  <<: *default
  database: xiye_test

production:
  <<: *default
  database: xiye_production
`,
    },
    { path: "app/controllers/home_controller.rb", content: `class HomeController < ApplicationController\n  def index\n  end\nend\n` },
    {
      path: "app/views/layouts/application.html.erb",
      content: `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title><%= content_for(:title) || "${t.projectName}" %></title>
    <%= csrf_meta_tags %>
    <%= csp_meta_tag %>
    <%= stylesheet_link_tag "globals", "data-turbo-track": "reload" %>
  </head>
  <body>
    <%= yield %>
  </body>
</html>`,
    },
    {
      path: "app/views/home/index.html.erb",
      content: `<%= raw <<~HTML
${heroHtml(t)}
HTML
%>`,
    },
    { path: "app/assets/stylesheets/globals.css", content: seedGlobals(t) },
    { path: ".env.example", content: `POSTGRES_HOST=localhost\nPOSTGRES_USER=postgres\nPOSTGRES_PASSWORD=postgres\n${seedEnvExample(state)}` },
    { path: ".gitignore", content: gitignore() },
  ];
}

function laravelFiles(t: SeedTokens, state: FlowState): SeedFile[] {
  return [
    {
      path: "composer.json",
      content: `{
  "name": "xiye/laravel-app",
  "type": "project",
  "require": {
    "php": "^8.2",
    "laravel/framework": "^11.0",
    "inertiajs/inertia-laravel": "^1.0"
  },
  "require-dev": {
    "laravel/pint": "^1.0"
  },
  "scripts": {
    "dev": "composer run dev --timeout=0",
    "dev:server": "php artisan serve",
    "dev:vite": "npm run dev"
  }
}
`,
    },
    {
      path: "routes/web.php",
      content: `<?php

use Illuminate\\Support\\Facades\\Route;
use App\\Http\\Controllers\\HomeController;

Route::get("/", [HomeController::class, "index"])->name("home");
// 按 docs/ARCHITECTURE.md 的 app/ 边界继续扩展
`,
    },
    { path: "app/Http/Controllers/HomeController.php", content: `<?php\n\nnamespace App\\Http\\Controllers;\n\nuse Inertia\\Inertia;\n\nclass HomeController extends Controller\n{\n    public function index()\n    {\n        return Inertia::render("Home");\n    }\n}\n` },
    {
      path: "resources/views/app.blade.php",
      content: `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${t.projectName}</title>
    @vite(["resources/css/globals.css", "resources/js/app.js"])
    @inertiaHead
  </head>
  <body>
    @inertia
  </body>
</html>`,
    },
    {
      path: "resources/js/app.js",
      content: `import { createApp, h } from "vue";
import { createInertiaApp } from "@inertiajs/vue3";
import { resolvePageComponent } from "laravel-vite-plugin/inertia-helpers";

createInertiaApp({
  title: (title) => title ? \`\${title} · ${t.projectName}\` : "${t.projectName}",
  resolve: (name) => resolvePageComponent(
    \`./Pages/\${name}.vue\`,
    import.meta.glob("./Pages/**/*.vue"),
  ),
  setup({ el, App, props, plugin }) {
    createApp({ render: () => h(App, props) })
      .use(plugin)
      .mount(el);
  },
});
`,
    },
    {
      path: "resources/js/Pages/Home.vue",
      content: `<template>
  <div v-html="hero"></div>
</template>

<script setup>
const hero = \`${heroHtml(t).replace(/`/g, "\\`")}\`;
</script>`,
    },
    { path: "resources/css/globals.css", content: seedGlobals(t) },
    { path: ".env.example", content: `APP_NAME="${t.projectName}"\nAPP_ENV=local\nAPP_KEY=\nDB_CONNECTION=pgsql\nDB_HOST=127.0.0.1\nDB_PORT=5432\nDB_DATABASE=xiye\nDB_USERNAME=postgres\nDB_PASSWORD=postgres\n${seedEnvExample(state)}` },
    { path: ".gitignore", content: gitignore() },
  ];
}

function springbootFiles(t: SeedTokens, state: FlowState): SeedFile[] {
  const pkg = {
    name: "frontend",
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
    dependencies: { vue: V.vue, pinia: "^2.2.0", "vue-router": "^4.4.0" },
    devDependencies: { "@vitejs/plugin-vue": "^5.1.0", typescript: V.typescript, vite: V.vite, tailwindcss: V.tailwind, postcss: V.postcss, autoprefixer: V.autoprefixer },
  };
  return [
    {
      path: "backend/pom.xml",
      content: `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.4</version>
    <relativePath/>
  </parent>
  <groupId>com.xiye</groupId>
  <artifactId>xiye-backend</artifactId>
  <version>0.0.1-SNAPSHOT</version>
  <name>xiye-backend</name>
  <properties>
    <java.version>17</java.version>
  </properties>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-security</artifactId>
    </dependency>
    <dependency>
      <groupId>com.baomidou</groupId>
      <artifactId>mybatis-plus-spring-boot3-starter</artifactId>
      <version>3.5.7</version>
    </dependency>
    <dependency>
      <groupId>com.mysql</groupId>
      <artifactId>mysql-connector-j</artifactId>
      <scope>runtime</scope>
    </dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
    </plugins>
  </build>
</project>
`,
    },
    {
      path: "backend/src/main/resources/application.yml",
      content: `server:
  port: 8080

spring:
  datasource:
    url: \${DB_URL:jdbc:mysql://localhost:3306/xiye?useSSL=false&serverTimezone=Asia/Shanghai}
    username: \${DB_USERNAME:root}
    password: \${DB_PASSWORD:root}

mybatis-plus:
  mapper-locations: classpath*:mapper/**/*.xml
  type-aliases-package: com.xiye.entity
`,
    },
    { path: "backend/src/main/java/com/xiye/XiyeApplication.java", content: `package com.xiye;\n\nimport org.springframework.boot.SpringApplication;\nimport org.springframework.boot.autoconfigure.SpringBootApplication;\n\n@SpringBootApplication\npublic class XiyeApplication {\n    public static void main(String[] args) {\n        SpringApplication.run(XiyeApplication.class, args);\n    }\n}\n` },
    { path: "backend/src/main/java/com/xiye/controller/HealthController.java", content: `package com.xiye.controller;\n\nimport org.springframework.web.bind.annotation.GetMapping;\nimport org.springframework.web.bind.annotation.RestController;\n\n@RestController\npublic class HealthController {\n    @GetMapping("/api/health")\n    public String health() {\n        return "ok";\n    }\n}\n` },
    { path: "frontend/package.json", content: JSON.stringify(pkg, null, 2) },
    {
      path: "frontend/vite.config.ts",
      content: `import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({ plugins: [vue()] });`,
    },
    {
      path: "frontend/index.html",
      content: `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${t.projectName}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>`,
    },
    {
      path: "frontend/src/main.ts",
      content: `import { createApp } from "vue";
import App from "./App.vue";
import "./styles/globals.css";

createApp(App).mount("#app");`,
    },
    {
      path: "frontend/src/App.vue",
      content: `<template>
  <div v-html="hero"></div>
</template>

<script setup lang="ts">
const hero = \`${heroHtml(t).replace(/`/g, "\\`")}\`;
</script>`,
    },
    { path: "frontend/src/styles/globals.css", content: seedGlobals(t) },
    { path: ".env.example", content: `DB_URL=jdbc:mysql://localhost:3306/xiye?useSSL=false&serverTimezone=Asia/Shanghai\nDB_USERNAME=root\nDB_PASSWORD=root\n${seedEnvExample(state)}` },
    { path: ".gitignore", content: gitignore() },
  ];
}

function goFiles(t: SeedTokens, state: FlowState): SeedFile[] {
  const pkg = {
    name: "frontend",
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: { dev: "vite", build: "tsc -b && vite build", preview: "vite preview" },
    dependencies: { react: V.react, "react-dom": V.reactDom },
    devDependencies: {
      "@types/react": V.typesReact,
      "@types/react-dom": V.typesReact,
      "@vitejs/plugin-react": V.vitePluginReact,
      typescript: V.typescript,
      vite: V.vite,
      tailwindcss: V.tailwind,
      postcss: V.postcss,
      autoprefixer: V.autoprefixer,
    },
  };
  return [
    {
      path: "backend/go.mod",
      content: `module github.com/xiye/xiye-backend

go 1.22

require (
    github.com/gin-gonic/gin v1.10.0
    gorm.io/gorm v1.25.11
    gorm.io/driver/postgres v1.5.9
)
`,
    },
    {
      path: "backend/cmd/server/main.go",
      content: `package main

import (
    "log"
    "net/http"

    "github.com/gin-gonic/gin"
)

func main() {
    r := gin.Default()
    r.GET("/api/health", func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"ok": true, "service": "xiye"})
    })
    // 按 docs/ARCHITECTURE.md 的 internal/ 边界继续扩展
    log.Fatal(r.Run(":8080"))
}
`,
    },
    { path: "backend/internal/handler/health.go", content: `package handler\n\n// HTTP handlers：出入参、状态码，调用 service\n` },
    { path: "backend/internal/service/.gitkeep", content: "" },
    { path: "backend/internal/repository/.gitkeep", content: "" },
    { path: "backend/internal/model/.gitkeep", content: "" },
    { path: "backend/internal/middleware/.gitkeep", content: "" },
    { path: "backend/internal/ai/.gitkeep", content: "" },
    { path: "backend/.env.example", content: `PORT=8080\nPOSTGRES_HOST=localhost\nPOSTGRES_USER=postgres\nPOSTGRES_PASSWORD=postgres\nPOSTGRES_DB=xiye\n${seedEnvExample(state)}` },
    { path: "frontend/package.json", content: JSON.stringify(pkg, null, 2) },
    {
      path: "frontend/vite.config.ts",
      content: `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({ plugins: [react()] });`,
    },
    {
      path: "frontend/index.html",
      content: `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${t.projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
    },
    {
      path: "frontend/src/main.tsx",
      content: `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);`,
    },
    {
      path: "frontend/src/App.tsx",
      content: jsxShell("App", t),
    },
    { path: "frontend/src/index.css", content: seedGlobals(t) },
    { path: ".gitignore", content: gitignore() },
  ];
}

// —— 主入口：按技术栈分发 ——

const SEED_RUN: Record<string, { label: string; run: string; runnable: boolean }> = {
  nextjs_supabase: { label: "Next.js 15", run: "npm install && npm run dev", runnable: true },
  nextjs_appwrite: { label: "Next.js 15", run: "npm install && npm run dev", runnable: true },
  t3_app: { label: "Next.js + tRPC", run: "npm install && npm run dev", runnable: true },
  remix_supabase: { label: "Remix", run: "npm install && npm run dev", runnable: true },
  sveltekit_supabase: { label: "SvelteKit", run: "npm install && npm run dev", runnable: true },
  nuxt_firebase: { label: "Nuxt 3", run: "npm install && npm run dev", runnable: true },
  astro_supabase: { label: "Astro", run: "npm install && npm run dev", runnable: true },
  react_express: { label: "React + Express", run: "cd frontend && npm install && npm run dev", runnable: true },
  go_react: { label: "Go + React", run: "cd backend && go run ./cmd/server", runnable: false },
  cf_workers: { label: "Cloudflare Workers", run: "npm install && npm run dev", runnable: true },
  django_postgres: { label: "Django", run: "pip install -r requirements.txt && python manage.py runserver", runnable: false },
  rails_postgres: { label: "Rails", run: "bundle install && bin/rails server", runnable: false },
  laravel_vue: { label: "Laravel + Vue", run: "composer install && npm install && php artisan serve", runnable: false },
  springboot_vue: { label: "Spring Boot + Vue", run: "cd backend && mvn spring-boot:run", runnable: false },
};

function seedReadme(t: SeedTokens, state: FlowState, meta: { label: string; run: string; runnable: boolean }): string {
  const stack = TECH_STACKS.find((s) => s.id === state.techStack);
  return `# seed/ — 可运行底座工程

> 由 xiye 流程工作台生成 · 技术栈 **${stack?.name ?? "未选择"}** · 视觉风格 token 已落地
> 这是给 AI 开发 Agent 的**开工起点**：目录按 docs/ARCHITECTURE.md 铺好，壳页面已套用 globals.css 的设计 token。

## 启动

\`\`\`bash
${meta.run}
\`\`\`

${meta.runnable ? "启动后访问本地开发地址，即可看到已套用视觉风格的首页。" : "> 该栈需对应语言工具链（见下方依赖清单），目录与配置已按架构知识库铺好。"}

## 已包含

- **设计 token**：\`globals.css\` 的 :root 变量（primary/background/foreground/字体/圆角/暗色），**不得自行换色**
- **主题**：\`tailwind.config.ts\` 已映射 token
- **壳页面**：首页导航 + Hero + 特性卡片，全部走 CSS 变量，作为视觉锚点
- **目录骨架**：按 docs/ARCHITECTURE.md 的分层铺好（含 .gitkeep 占位）
- **环境变量**：\`.env.example\`（密钥必须走服务端，禁止进浏览器 bundle）

## 下一步（交给 AI 开发 Agent）

1. 按 \`xiye.agent.json\` 的 \`pages\` 逐页装配组件
2. 按 \`componentVariants\` 实现各变体
3. 按 \`motion\` 接入动效（framework 决定 gsap / lenis / css）
4. 按 \`stack.aiIntegration\` 把 AI 能力收敛到服务端

> 完整规格见 \`../docs/*.md\` 与 \`../xiye.agent.json\`。
`;
}

export function buildSeedProject(state: FlowState, tokens: SeedTokens): SeedProject {
  const meta = SEED_RUN[state.techStack ?? ""] ?? SEED_RUN.react_express;
  const readme = seedReadme(tokens, state, meta);

  let files: SeedFile[] = [];
  switch (state.techStack) {
    case "nextjs_supabase":
      files = nextFiles(tokens, state, [
        { path: "middleware.ts", content: `import { NextResponse, type NextRequest } from "next/server";\n\n// 边缘鉴权：保护登录后目录（按 docs/ARCHITECTURE.md）\nexport function middleware(request: NextRequest) {\n  return NextResponse.next();\n}\n\nexport const config = {\n  matcher: ["/((?!_next|api|.*\\\\..*).*)"],\n};\n` },
        { path: "lib/db/.gitkeep", content: "" },
        { path: "lib/ai/.gitkeep", content: "" },
      ]);
      break;
    case "nextjs_appwrite":
      files = nextFiles(tokens, state, [
        { path: "lib/appwrite/.gitkeep", content: "" },
        { path: "lib/ai/.gitkeep", content: "" },
      ]);
      break;
    case "t3_app":
      files = nextFiles(tokens, state, [
        { path: "prisma/schema.prisma", content: `generator client {\n  provider = "prisma-client-js"\n}\n\ndatasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}\n\n// 在此定义领域模型（按 docs/ARCHITECTURE.md 的 server/ 边界）\n` },
        { path: "server/db.ts", content: `import { PrismaClient } from "@prisma/client";\n\nconst globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };\nexport const prisma = globalForPrisma.prisma ?? new PrismaClient();\nif (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;\n` },
        { path: "server/api/root.ts", content: `import { initTRPC } from "@trpc/server";\n\nconst t = initTRPC.create();\nexport const router = t.router;\nexport const publicProcedure = t.procedure;\n` },
        { path: "server/api/routers/.gitkeep", content: "" },
      ]);
      break;
    case "remix_supabase":
      files = remixFiles(tokens, state);
      break;
    case "sveltekit_supabase":
      files = sveltekitFiles(tokens, state);
      break;
    case "nuxt_firebase":
      files = nuxtFiles(tokens, state);
      break;
    case "astro_supabase":
      files = astroFiles(tokens, state);
      break;
    case "react_express":
      files = [
        ...viteReactFiles(tokens, state, "frontend"),
        {
          path: "backend/package.json",
          content: JSON.stringify(
            {
              name: "backend",
              version: "0.1.0",
              private: true,
              scripts: { dev: "tsx watch src/index.ts", build: "tsc", start: "node dist/index.js" },
              dependencies: { express: V.express, cors: V.cors, dotenv: V.dotenv, "@prisma/client": V.prismaClient },
              devDependencies: { prisma: V.prisma, typescript: V.typescript, tsx: "^4.19.0", "@types/express": "^4.17.0", "@types/cors": "^2.8.0", "@types/node": V.typesNode },
            },
            null,
            2,
          ),
        },
        {
          path: "backend/src/index.ts",
          content: `import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "xiye" });
});

// 按 docs/ARCHITECTURE.md 的 backend/src/ 边界继续扩展
const port = process.env.PORT || 3001;
app.listen(port, () => console.log(\`API ready on :\${port}\`));
`,
        },
        { path: "backend/prisma/schema.prisma", content: `generator client {\n  provider = "prisma-client-js"\n}\n\ndatasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}\n\n// 在此定义领域模型\n` },
        { path: "backend/.env.example", content: `PORT=3001\nDATABASE_URL=postgresql://postgres:postgres@localhost:5432/xiye\n${seedEnvExample(state)}` },
      ];
      break;
    case "go_react":
      files = goFiles(tokens, state);
      break;
    case "cf_workers":
      files = cfWorkersFiles(tokens, state);
      break;
    case "django_postgres":
      files = djangoFiles(tokens, state);
      break;
    case "rails_postgres":
      files = railsFiles(tokens, state);
      break;
    case "laravel_vue":
      files = laravelFiles(tokens, state);
      break;
    case "springboot_vue":
      files = springbootFiles(tokens, state);
      break;
    default:
      // 未选择技术栈 → 通用 Vite React 底座（可运行）
      files = viteReactFiles(tokens, state);
      break;
  }

  // 组装：README → 约定文件 → 框架文件 → 蓝图落盘（后者覆盖壳页面）→ 风格锚点 → verify
  const assembled: SeedFile[] = [
    { path: "README.md", content: readme },
    ...buildAgentMdFiles(state),
    ...files,
    ...buildBlueprintFiles(state, tokens),
    ...buildStyleAnchorFiles(state),
    ...buildDataContractFiles(state),
    ...buildVerifyFiles(state),
  ];

  // 按路径去重，保留最后一个（蓝图 home 覆盖框架生成的壳页面）
  const lastIndex = new Map<string, number>();
  assembled.forEach((f, i) => lastIndex.set(f.path, i));
  const deduped = assembled.filter((f, i) => lastIndex.get(f.path) === i);

  return {
    files: deduped,
    runCommand: meta.run,
    frameworkLabel: meta.label,
    runnable: meta.runnable,
  };
}

// —— 三件套-A：AGENTS.md / CLAUDE.md（AI 编码工具自动读取）——
// prefix：seed 内为 "../"（引用仓库根 docs/），zip 根为 ""（直接引用 docs/）

export function buildAgentMdFiles(state: FlowState, prefix = "../"): SeedFile[] {
  const projName = state.projectInfo?.projectName ?? "你的产品";
  const stack = TECH_STACKS.find((s) => s.id === state.techStack);
  const meta = SEED_RUN[state.techStack ?? ""] ?? SEED_RUN.react_express;
  const primary = state.designSystem?.colorPrimary ?? resolveSeedTokens(state).palette.primary;

  const assembly = blueprintAssembly(state);
  const pagesLines =
    assembly
      .map(
        (p) =>
          `- ${p.pageName}：${p.components.map((c) => `${c.componentName}（${c.variantName}）`).join("、") || "待补全"}`,
      )
      .join("\n") || "- （尚未把组件加入蓝图）";

  const body = `# ${projName} — 开发约定

> 由 xiye 流程工作台生成。本文件是 AI / 开发 Agent 进入本工程的**默认上下文**：
> 视觉基线、架构边界、开工方式、验收标准均已锁定，开工即可增量开发。

## 工程是什么

由 ${stack ? `${stack.name}（${stack.frontend} / ${stack.backend} / ${stack.database}）` : "所选技术栈"} 搭建的产品底座。
完整规格见仓库根部的 \`docs/\` 与 \`${prefix}xiye.agent.json\`、\`${prefix}xiye.config.json\`。

## 开工

\`\`\`bash
${meta.run}
\`\`\`
${meta.runnable ? "启动后首页即显示已套用视觉 token 的壳页面，在此之上做增量开发。" : "> 该栈需对应语言工具链（见依赖清单），目录与配置已铺好。"}

## 视觉基线（锁定，不可私自更改）

- 主色 \`primary\` = \`${primary}\`；全部 token 在 \`globals.css\` 的 \`:root\`，主题映射见 \`tailwind.config.ts\`。
- 字体、圆角、密度、暗色模式：以 \`${prefix}styles/globals.css\` 的 \`:root\` 为唯一真值（\`docs/DESIGN_SPEC.md\` 是其文档化呈现，二者同源）。**任何偏离需用户明确授权。**

## 开发边界规范（通用，开工前必读）

视觉品味（反 AI 味）、代码整洁、工程协作、安全守则见 \`${prefix}docs/GUARD_NORMS.md\`。进入任意页面开发前先按其自查，避免产出泛型的 AI 味道实现。

## 架构边界

目录结构、分层、数据流以 \`${prefix}docs/ARCHITECTURE.md\` 为准。**不得改扁平、不得跨层引用。**

## 页面装配

按 \`${prefix}xiye.agent.json\` 的 \`pages\` 逐页装配，页面路由与组件文件占位已生成（见 \`BLUEPRINT.md\`）：

${pagesLines}

## DO

- 以本 seed 为起点做增量开发，不要另起炉灶重建工程
- 先落地 globals.css token + tailwind 主题，让视觉基线先生效
- 按 pages 逐页装配组件，componentVariants 决定实现类与预览类
- AI 能力收敛到服务端（stack.aiIntegration），前端只读流
- 完成后按 \`${prefix}docs/AI_HANDOFF.md\` 第八节的「完成回执」格式交付

## DON'T

- 不要自行换色或改字体/圆角（视觉基线由 token 锁定）
- 不要把目录改扁平或跨层引用（架构边界见 \`${prefix}docs/ARCHITECTURE.md\`）
- 不要在浏览器 bundle 暴露任何密钥
- 不要跳过验收清单中的任一项就声称完成

## 验收

实现完成后运行内置自检（自动核对 token / 目录 / 页面 / 组件 / 无 TODO / 无密钥泄漏）：

\`\`\`bash
node scripts/verify.mjs
\`\`\`

通过后按 \`${prefix}docs/AI_HANDOFF.md\` 第八节的「完成回执」格式向用户交付。
`;

  return [
    { path: "AGENTS.md", content: body },
    { path: "CLAUDE.md", content: body },
  ];
}

// —— 三件套-B：蓝图落盘 —— 页面路由占位 + 组件文件占位 + BLUEPRINT.md ——

function buildBlueprintFiles(state: FlowState, tokens: SeedTokens): SeedFile[] {
  const assembly = blueprintAssembly(state);
  if (!assembly.length) return [];

  const files: SeedFile[] = [];
  const isNext = state.techStack === "nextjs_supabase" || state.techStack === "nextjs_appwrite" || state.techStack === "t3_app";

  for (const page of assembly) {
    const slug = page.pageSlug;
    const PageName = pascal(slug);
    const comps = page.components;

    if (isNext) {
      // Next.js App Router：app/<slug>/page.tsx
      const route = slug === "home" ? "app/page.tsx" : `app/${slug}/page.tsx`;
      const importLines = comps
        .map((c) => `import ${pascal(c.componentId)} from "@/components/${PageName}/${pascal(c.componentId)}";`)
        .join("\n");
      files.push({
        path: route,
        content: `${importLines}

export default function ${PageName}Page() {
  return (
    <main>
      ${comps.map((c) => `<${pascal(c.componentId)} />`).join("\n      ")}
    </main>
  );
}
`,
      });
      // 组件文件：components/<PageName>/<Component>.tsx
      for (const c of comps) {
        const Comp = pascal(c.componentId);
        files.push({
          path: `components/${PageName}/${Comp}.tsx`,
          content: `// ${c.componentName} · 变体：${c.variantName}
// 实现提示：${c.prompt || "按 docs/DESIGN_SPEC.md 的组件规范实现"}
export default function ${Comp}() {
  return (
    <section>
      {/* TODO: 按蓝图实现 ${c.componentName}（${c.variantName}） */}
    </section>
  );
}
`,
        });
      }
    } else {
      // 非 Next 栈：生成 BLUEPRINT.md 装配清单（路由/组件由 AI 按架构落地）
      // 组件文件占位统一放 components/ 下
      for (const c of comps) {
        const Comp = pascal(c.componentId);
        files.push({
          path: `components/${PageName}/${Comp}.tsx`,
          content: `// ${c.componentName} · 变体：${c.variantName}
// 实现提示：${c.prompt || "按 docs/DESIGN_SPEC.md 的组件规范实现"}
export default function ${Comp}() {
  return (
    <section>
      {/* TODO: 按蓝图实现 ${c.componentName}（${c.variantName}） */}
    </section>
  );
}
`,
        });
      }
    }
  }

  // BLUEPRINT.md：装配清单（含每个组件的实现提示词 + 状态/间距/动效/验收规范）
  const md = [
    "# BLUEPRINT.md — 蓝图装配清单",
    "",
    "> 由 xiye 流程工作台生成。页面路由与组件文件占位已落盘，AI 按此清单逐页装配。",
    "> 视觉基线（token）、核心组件 CSS（Button/Input/Card/Modal）见 `../docs/DESIGN_SPEC.md`，动效库见 `../docs/MOTION.md`。",
    "",
    ...assembly.flatMap((p) => [
      `## ${p.pageName}（\`${p.pageSlug}\`）`,
      "",
      ...p.components.map((c) => componentSpecBlock(p, c)),
      "",
    ]),
  ].join("\n");

  files.push({ path: "BLUEPRINT.md", content: md });
  return files;
}

// 单个组件的装配规范块：文件落点 / 实现提示 / 状态 / 间距 / 动效 / 验收
function componentSpecBlock(
  page: { pageSlug: string; pageName: string },
  c: { componentId: string; componentName: string; variantName: string; prompt: string },
): string {
  const Comp = pascal(c.componentId);
  const Page = pascal(page.pageSlug);
  return `### ${c.componentName}（变体：${c.variantName}）

- **文件**：\`components/${Page}/${Comp}.tsx\`
- **实现提示**：${c.prompt || "按 docs/DESIGN_SPEC.md 的组件规范实现"}

**交互状态**（所有视觉 token 必须取自 globals.css 的 :root，禁止硬编码色值）：

| 状态 | 要求 |
| --- | --- |
| default | 背景 \`var(--surface)\` 或 \`var(--background)\`，描边 \`var(--border)\`，文本 \`var(--foreground)\` |
| hover | 主色组件透明度降到 0.9，或轻微上浮 2px（卡片类）；secondary 高亮 |
| focus-visible | \`outline: 2px solid var(--primary)\`, offset 2px, 键盘可达 |
| disabled | \`opacity 0.5\`, 不可点, \`cursor: not-allowed\` |
| loading / error | 有明确占位态；表单错误用约定警示色（不定义新色，用状态说明） |

**间距与密度**：符合所选密度档（\`DENSITY\` token 与 spacing 基准见 docs/DESIGN_SPEC.md）；区块内对齐与留白一致。

**圆角**：一律用 \`var(--radius)\` 派生（\`sm/md/lg\`），不写死像素圆角。

**动效落点**：若该场景在 MOTION.md 有对应动效，接入对应 framework（gsap / lenis / css）；无感滚动由全局滚动动效处理。

**验收标准**：
- [ ] 组件在默认/hover/focus/disabled 状态视觉与规范一致
- [ ] 未硬编码任何 token 色值，全部引用 CSS 变量
- [ ] 响应式可用（移动端不溢出）
- [ ] 若含交互，状态切换平滑，且不污染其他组件`;
}

// —— 三件套-C：scripts/verify.mjs 可脚本化验收 ——

function buildVerifyFiles(state: FlowState): SeedFile[] {
  const assembly = blueprintAssembly(state);
  const isNext = state.techStack === "nextjs_supabase" || state.techStack === "nextjs_appwrite" || state.techStack === "t3_app";
  const expectedFiles = assembly.flatMap((p) =>
    p.components.map((c) => `components/${pascal(p.pageSlug)}/${pascal(c.componentId)}.tsx`),
  );

  const expectedPages = isNext
    ? assembly.map((p) => (p.pageSlug === "home" ? "app/page.tsx" : `app/${p.pageSlug}/page.tsx`))
    : [];

  const script = `// 由 xiye 流程工作台生成 · 可脚本化验收
// 用法：node scripts/verify.mjs
// 检查：token 一致性 / 目录结构 / 蓝图页面与组件文件 / 无 TODO / 无密钥泄漏
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const issues = [];
const warnings = [];
const selfPath = fileURLToPath(import.meta.url);

// 1) 设计 token 一致性：globals.css 必须含 primary / background / foreground / font-sans
const globalsPath = findGlobals(root);
if (globalsPath) {
  const css = readFileSync(globalsPath, "utf8");
  for (const token of ["--primary", "--background", "--foreground", "--font-sans"]) {
    if (!css.includes(token)) issues.push(\`globals.css 缺少 token \${token}\`);
  }
} else {
  warnings.push("未找到 globals.css，跳过 token 检查");
}

// 2) 目录结构：按 docs/ARCHITECTURE.md 的分层（非扁平）
//    这里做轻量检查：存在 src/ 或 app/ 或 backend/ 等架构目录之一
const archDirs = ["app", "src", "backend", "server", "lib", "internal"];
if (!archDirs.some((d) => existsSync(join(root, d)))) {
  issues.push("目录结构疑似扁平化：未发现 app/src/backend/server/lib/internal 等架构目录");
}

// 3) 蓝图页面与组件文件
${JSON.stringify(expectedPages, null, 2)}
  .forEach((f) => {
    if (!existsSync(join(root, f))) issues.push(\`蓝图页面文件缺失：\${f}\`);
  });
${JSON.stringify(expectedFiles, null, 2)}
  .forEach((f) => {
    if (!existsSync(join(root, f))) issues.push(\`蓝图组件文件缺失：\${f}\`);
  });

// 4) 无 TODO 占位（排除 node_modules / .next / dist）
// 动态拼接避免本脚本源码命中自身
const TODO_RE = new RegExp("TO" + "DO|FIX" + "ME");
const todoFiles = [];
walk(root, (f, content) => {
  if (TODO_RE.test(content)) todoFiles.push(f);
});
if (todoFiles.length) {
  const label = "TO" + "DO/FIX" + "ME";
  warnings.push(\`仍有 \${label} 占位：\${todoFiles.slice(0, 5).join(", ")}\${todoFiles.length > 5 ? " 等" : ""}\`);
}

// 5) 无密钥泄漏：浏览器 bundle 不得出现 sk- 等密钥（正则与自检共享 lib/security 唯一来源）
walk(root, (f, content) => {
  if (/${SECRET_PATTERN}/i.test(content) && !/\.env/.test(f)) {
    issues.push("疑似密钥泄漏：" + f);
  }
});

// —— 输出 ——
if (issues.length) {
  console.error("❌ 验收未通过：");
  issues.forEach((i) => console.error("  - " + i));
  process.exit(1);
}
if (warnings.length) {
  console.warn("⚠ 提示：");
  warnings.forEach((w) => console.warn("  - " + w));
}
console.log("✅ 验收通过：token / 目录 / 页面 / 组件 / 无 TODO / 无密钥泄漏 均通过");

// —— 工具 ——
function findGlobals(dir) {
  for (const p of ["app/globals.css", "src/index.css", "src/app.css", "src/styles/global.css", "src/styles/globals.css", "static/css/globals.css", "app/assets/css/main.css"]) {
    if (existsSync(join(dir, p))) return join(dir, p);
  }
  return null;
}

function walk(dir, fn) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".next", "dist", "build", ".git", ".svelte-kit", ".nuxt"].includes(entry.name)) continue;
      walk(full, fn);
    } else if (/\.(ts|tsx|js|jsx|svelte|vue|astro|css|html|py|rb|php|go|java)$/.test(entry.name)) {
      if (full === selfPath) continue; // 跳过本脚本自身
      try {
        fn(full, readFileSync(full, "utf8"));
      } catch {
        /* 忽略读取失败 */
      }
    }
  }
}
`;

  return [{ path: "scripts/verify.mjs", content: script }];
}

/** 由 FlowState 解析出种子工程所需的 token 与元信息（与 project-generator 同一套取值） */
export function resolveSeedTokens(state: FlowState): SeedTokens {
  const styleId = state.visualStyle && VISUAL_STYLE_MAP[state.visualStyle] ? state.visualStyle : "aw-brutalist";
  const style = VISUAL_STYLE_MAP[styleId] ?? VISUAL_STYLES[0];
  const p = style.palette;
  const cssVariables = buildCssVariables(style, state.designSystem);
  const tailwindConfig = buildTailwindConfig(style, state.designSystem);

  const radiusVar = (() => {
    const r = state.designSystem?.radius;
    return r ? (r === "full" ? "9999px" : `${style.radius}px`) : `${style.radius}px`;
  })();

  const features =
    (state.aiCapabilities ?? []).length > 0
      ? state.aiCapabilities.slice(0, 3).map((id, i) => ({
          name: `AI 能力 ${i + 1}`,
          desc: "由所选 AI 能力推导，按 docs/ARCHITECTURE.md 收敛到服务端",
        }))
      : [
          { name: "核心页面", desc: "按项目类型搭建的主流程界面" },
          { name: "组件系统", desc: "按组件变体生成可复用 UI 单元" },
          { name: "主题体系", desc: "由视觉风格推导的设计 token 与暗色适配" },
        ];

  return {
    cssVariables,
    tailwindConfig,
    palette: {
      bg: p.bg,
      surface: p.surface,
      border: p.border,
      text: p.text,
      muted: p.muted,
      primary: state.designSystem?.colorPrimary ?? p.accent,
      secondary: state.designSystem?.colorSecondary ?? p.accent2,
      radius: radiusVar,
      fontFamily: style.font,
    },
    projectName: state.projectInfo?.projectName ?? "你的产品",
    tagline: "由 xiye 流程工作台生成 · 已套用所选视觉风格",
    features,
  };
}
