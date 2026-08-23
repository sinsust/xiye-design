// 文档站（Docs）页面骨架数据。

import type { SkeletonPage } from "./types";

export const DOCS_PAGE: SkeletonPage = {
  id: "docs",
  name: "文档站",
  icon: "BookOpenText",
  description: "开发者文档：侧栏导航、章节内容、搜索，产品深度服务的门面",
  components: [
    {
      id: "docs-nav",
      name: "文档导航",
      icon: "PanelLeft",
      description: "左侧栏导航结构",
      variants: [
        {
          id: "dnav_sidebar",
          name: "标准侧栏",
          description: "分组链接 + 当前项高亮",
          tags: ["侧栏", "标准"],
          prompt:
            "Build a docs sidebar: version pill on top, grouped nav links (Getting Started / Guides / API) with nested items, active item highlighted with primary tint, bottom link for GitHub. Scrollable column.",
          code: `export function DocsSidebar() {
  const groups = [
    { g: "快速开始", items: ["安装", "首个应用", "配置"] },
    { g: "指南", items: ["路由", "数据获取", "部署"] },
    { g: "API", items: ["REST", "Webhook"] },
  ];
  return (
    <aside className="w-60 shrink-0 border-r px-4 py-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">{{brand}}</span>
        <span className="rounded-full border px-2 py-0.5 text-[10px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>v2.0</span>
      </div>
      {groups.map((grp) => (
        <div key={grp.g} className="mt-6">
          <p className="px-2 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{grp.g}</p>
          <nav className="mt-2 space-y-0.5">
            {grp.items.map((it, i) => (
              <a key={it} href={"#" + it} className={["block rounded-md px-2.5 py-1.5 text-sm transition", i === 0 && grp.g === "快速开始" ? "font-medium" : "hover:bg-muted"].join(" ")} style={i === 0 && grp.g === "快速开始" ? { background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" } : { color: "var(--muted-foreground)" }}>
                {it}
              </a>
            ))}
          </nav>
        </div>
      ))}
    </aside>
  );
}`,
          interaction: "当前项主色浅底；版本胶囊",
        },
        {
          id: "dnav_tree",
          name: "树形分组",
          description: "可折叠分组树，大文档",
          tags: ["树形", "大文档"],
          prompt:
            "Build a collapsible docs tree: groups with chevron icons that expand/collapse, leaf items indented, active leaf highlighted, 'New' badge on one item. For large documentation sets.",
          code: `export function DocsTree() {
  const [open, setOpen] = useState(["指南"]);
  const tree = [
    { g: "快速开始", items: ["安装", "配置"] },
    { g: "指南", items: ["路由", "数据获取", "部署"] },
    { g: "参考", items: ["CLI", "配置项"] },
  ];
  return (
    <aside className="w-64 shrink-0 border-r px-4 py-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <p className="px-2 text-sm font-bold">{{brand}} Docs</p>
      <div className="mt-4 space-y-1">
        {tree.map((grp) => {
          const expanded = open.includes(grp.g);
          return (
            <div key={grp.g}>
              <button onClick={() => setOpen(expanded ? open.filter((x) => x !== grp.g) : [...open, grp.g])} className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm font-medium hover:bg-muted">
                {grp.g}
                <span className={"text-xs transition-transform " + (expanded ? "rotate-90" : "")} style={{ color: "var(--muted-foreground)" }}>▸</span>
              </button>
              {expanded && (
                <nav className="ml-2.5 mt-0.5 space-y-0.5 border-l pl-3" style={{ borderColor: "var(--border)" }}>
                  {grp.items.map((it, i) => (
                    <a key={it} href={"#" + it} className="block rounded-md px-2 py-1 text-sm" style={i === 0 && grp.g === "指南" ? { background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" } : { color: "var(--muted-foreground)" }}>
                      {it}
                    </a>
                  ))}
                </nav>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}`,
          interaction: "组折叠 ▸ 旋转；叶子缩进",
        },
      ],
    },
    {
      id: "docs-content",
      name: "文档内容",
      icon: "FileText",
      description: "章节正文排版",
      variants: [
        {
          id: "dcont_article",
          name: "章节正文",
          description: "标题层级 + 列表 + 提示块",
          tags: ["正文", "标准"],
          prompt:
            "Build a docs article: h1 + breadcrumb, intro paragraph, h2 section with paragraph + bullet list, a callout/note box (primary tint), and a code block. Max-width 70ch, clean hierarchy.",
          code: `export function DocContent() {
  return (
    <article className="mx-auto max-w-3xl px-8 py-10">
      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>指南 / 快速开始</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">安装 {{brand}}</h1>
      <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>跟着下面几步，几分钟内跑起你的第一个应用。</p>
      <h2 className="mt-8 text-xl font-bold">前置要求</h2>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
        <li>Node.js 18+</li>
        <li>npm 或 pnpm</li>
      </ul>
      <div className="mt-6 rounded-lg border-l-2 p-4 text-sm" style={{ borderColor: "var(--primary)", background: "color-mix(in srgb, var(--primary) 6%, transparent)" }}>
        <b>提示：</b>Windows 用户请使用 Git Bash 运行安装命令。
      </div>
      <h2 className="mt-8 text-xl font-bold">安装</h2>
      <pre className="mt-3 overflow-x-auto rounded-lg border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
{\`npm create {{brand}}@latest my-app
cd my-app
npm run dev\`}
      </pre>
    </article>
  );
}`,
          interaction: "提示块主色边；代码块等宽",
        },
        {
          id: "dcont_api",
          name: "API 参考",
          description: "端点表格 + 参数 + 示例",
          tags: ["API", "表格"],
          prompt:
            "Build an API reference layout: endpoint header with method badge (GET/POST), description, params table (name/type/required/description), and a curl example in a code block. Monospace accents, dense but organized.",
          code: `export function ApiDoc() {
  const params = [
    { n: "name", t: "string", r: "是", d: "项目名称" },
    { n: "description", t: "string", r: "否", d: "项目描述" },
    { n: "visibility", t: "enum", r: "否", d: "public / private" },
  ];
  return (
    <article className="mx-auto max-w-3xl px-8 py-10">
      <div className="flex items-center gap-3">
        <span className="rounded-md bg-green-600 px-2 py-0.5 text-xs font-bold text-white">POST</span>
        <code className="text-sm font-semibold">/v1/projects</code>
      </div>
      <p className="mt-3 text-sm" style={{ color: "var(--muted-foreground)" }}>创建一个新项目。</p>
      <h3 className="mt-8 text-lg font-bold">参数</h3>
      <table className="mt-3 w-full overflow-hidden rounded-lg border text-sm" style={{ borderColor: "var(--border)" }}>
        <thead>
          <tr className="border-b text-left" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
            <th className="p-2.5 font-medium">名称</th><th className="p-2.5 font-medium">类型</th><th className="p-2.5 font-medium">必填</th><th className="p-2.5 font-medium">说明</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p) => (
            <tr key={p.n} className="border-b last:border-0" style={{ borderColor: "var(--border)" }}>
              <td className="p-2.5 font-mono text-xs">{p.n}</td><td className="p-2.5 text-xs">{p.t}</td><td className="p-2.5 text-xs">{p.r}</td><td className="p-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{p.d}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="mt-8 text-lg font-bold">示例</h3>
      <pre className="mt-3 overflow-x-auto rounded-lg border p-4 text-xs" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
{\`curl -X POST https://api.example.com/v1/projects \\
  -H "Authorization: Bearer TOKEN" \\
  -d '{"name": "my-project"}\`}
      </pre>
    </article>
  );
}`,
          interaction: "方法徽章 + 参数表 + curl 示例",
        },
      ],
    },
    {
      id: "docs-search",
      name: "文档搜索",
      icon: "Search",
      description: "站内搜索入口",
      variants: [
        {
          id: "dsearch_bar",
          name: "顶部搜索条",
          description: "圆角搜索条 + 快捷键提示",
          tags: ["搜索", "极简"],
          prompt:
            "Build a docs search bar: rounded input with search icon, placeholder 'Search docs...', a ⌘K shortcut kbd on the right. Clean, on surface background.",
          code: `export function DocSearch() {
  return (
    <div className="flex w-full max-w-sm items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <span style={{ color: "var(--muted-foreground)" }}>⌕</span>
      <input placeholder="搜索文档…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      <kbd className="rounded border px-1.5 py-0.5 text-[10px]" style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--muted-foreground)" }}>⌘K</kbd>
    </div>
  );
}`,
          interaction: "⌘K 快捷键提示；回车聚焦",
        },
        {
          id: "dsearch_panel",
          name: "搜索结果面板",
          description: "搜索输入 + 结果分组",
          tags: ["搜索", "面板"],
          prompt:
            "Build a docs search panel: input on top, below grouped results (Pages / API) with title + breadcrumb + match highlight, a 'no results' hint at bottom. Dropdown card look.",
          code: `export function SearchPanel() {
  const results = [
    { t: "快速开始", p: "指南 / 快速开始", hit: "安装 <b>{{brand}}</b>" },
    { t: "配置项", p: "参考 / 配置项", hit: "自定义端口与<b>配置</b>" },
  ];
  return (
    <div className="w-full max-w-md overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-center gap-2 border-b px-3 py-2.5" style={{ borderColor: "var(--border)" }}>
        <span style={{ color: "var(--muted-foreground)" }}>⌕</span>
        <input defaultValue="配置" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        <kbd className="rounded border px-1.5 py-0.5 text-[10px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>Esc</kbd>
      </div>
      <div className="p-2">
        {results.map((r) => (
          <a key={r.t} href={"#" + r.t} className="block rounded-lg px-3 py-2.5 hover:bg-muted">
            <p className="text-sm font-medium">{r.t}</p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{r.p}</p>
            <p className="mt-0.5 text-xs" style={{ color: "var(--muted-foreground)" }} dangerouslySetInnerHTML={{ __html: r.hit }} />
          </a>
        ))}
        <p className="px-3 py-2 text-xs" style={{ color: "var(--muted-foreground)" }}>按 Enter 打开第一条结果</p>
      </div>
    </div>
  );
}`,
          interaction: "命中高亮 + Esc 关闭",
        },
      ],
    },
  ],
};
