// 把 Originkit Wexo 整站 Framer 导出（public/originkit/wexo/wexo-hero.html）
// 拆解为 12 个独立区块，并生成：
//  - public/originkit/wexo/sections/<slug>.html   （预览用，资源走绝对路径 /originkit/wexo/...）
//  - components/originkit/wexo/shared.tsx          （fetch + 链接 framer.css 的渲染器）
//  - components/originkit/wexo/<slug>.tsx          （12 个薄封装区块组件）
//  - wexo/index.html                               （品牌包用，资源走相对路径 ./...）
//  - 复制 framer.css / images / fonts 到 wexo/      （品牌包自包含）
// 纯 CSS 动画（HTML 内 0 个 <script>），嵌入原 HTML 片段 + framer.css 即 100% 还原视觉与动效。
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "public/originkit/wexo/wexo-hero.html");
const PUB = path.join(ROOT, "public/originkit/wexo");
const SEC_PUB = path.join(PUB, "sections");
const COMP = path.join(ROOT, "components/originkit/wexo");
const PKG = path.join(ROOT, "wexo");

// DOM 顺序的 12 个页面级区块（取自 wexo-hero.html 的 data-framer-name 直接子节点）
const SECTIONS = [
  { name: "Hero", slug: "hero" },
  { name: "Product Overview", slug: "product-overview" },
  { name: "How To Use", slug: "how-to-use" },
  { name: "User Feedback", slug: "user-feedback" },
  { name: "Pricing", slug: "pricing" },
  { name: "Unique Feature", slug: "unique-feature" },
  { name: "About Us", slug: "about-us" },
  { name: "Comparison", slug: "comparison" },
  { name: "Our Team", slug: "our-team" },
  { name: "Blogs", slug: "blogs" },
  { name: "Testimonials", slug: "testimonials" },
  { name: "CTA", slug: "cta" },
];

const html = fs.readFileSync(SRC, "utf8");
const VOIDS = new Set([
  "img", "br", "hr", "input", "meta", "link", "source",
  "area", "base", "col", "embed", "param", "track", "wbr",
]);

function depthAt(pos) {
  let d = 0, i = 0;
  while (i < pos) {
    if (html[i] === "<") {
      if (html[i + 1] === "/") { d = Math.max(0, d - 1); i = html.indexOf(">", i) + 1; }
      else {
        const sp = html.indexOf(" ", i), gt = html.indexOf(">", i);
        const tag = html.substring(i + 1, (sp < gt && sp !== -1) ? sp : gt).toLowerCase();
        if (VOIDS.has(tag) || html[gt - 1] === "/") i = gt + 1;
        else { d++; i = gt + 1; }
      }
    } else i++;
  }
  return d;
}

function findClose(openPos) {
  let depth = 0, i = openPos;
  while (i < html.length) {
    if (html[i] === "<") {
      if (html[i + 1] === "/") { depth--; i = html.indexOf(">", i) + 1; if (depth === 0) return i; }
      else {
        const sp = html.indexOf(" ", i), gt = html.indexOf(">", i);
        const tag = html.substring(i + 1, (sp < gt && sp !== -1) ? sp : gt).toLowerCase();
        if (VOIDS.has(tag) || html[gt - 1] === "/") i = gt + 1;
        else { depth++; i = gt + 1; }
      }
    } else i++;
  }
  return html.length;
}

// 取每个区块首 occurring 开放标签 + 平衡闭合
function extractSection(name) {
  const re = new RegExp(`<div\\b[^>]*data-framer-name="${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`, "g");
  const m = re.exec(html);
  if (!m) throw new Error("section not found: " + name);
  const open = m.index;
  const close = findClose(open);
  return html.slice(open, close);
}

// 资源路径归一：先把 /originkit/wexo/{images,fonts,framer.css} 归一为裸路径，
// 再按 base 重写（预览 base="/originkit/wexo"，品牌包 base="."）。
function rewriteAsset(htmlStr, base) {
  let h = htmlStr
    .replace(/\/originkit\/wexo\/images\//g, "images/")
    .replace(/\/originkit\/wexo\/fonts\//g, "fonts/")
    .replace(/\/originkit\/wexo\/framer\.css/g, "framer.css");
  h = h
    .replace(/images\//g, `${base}/images/`)
    .replace(/fonts\//g, `${base}/fonts/`)
    .replace(/framer\.css/g, `${base}/framer.css`);
  return h;
}

// ---------- 1. 生成 public 预览片段（绝对路径） ----------
fs.mkdirSync(SEC_PUB, { recursive: true });
const previewParts = [];
for (const s of SECTIONS) {
  const raw = extractSection(s.name);
  const out = rewriteAsset(raw, "/originkit/wexo");
  fs.writeFileSync(path.join(SEC_PUB, `${s.slug}.html`), out, "utf8");
  previewParts.push(out);
  console.log(`preview section: ${s.slug}.html  (${out.length} bytes)`);
}

// ---------- 2. 生成 shared.tsx 渲染器 ----------
fs.mkdirSync(COMP, { recursive: true });
const shared = `'use client';

// Wexo 整站区块统一渲染器：fetch 对应片段 HTML，链接共享 framer.css，
// 用 dangerouslySetInnerHTML 还原 Originkit Framer 原版视觉与 CSS 动效/交互。
import { useEffect, useState } from "react";

const SECTION_BASE = "/originkit/wexo/sections";

export function WexoSection({ slug }: { slug: string }) {
  const [html, setHtml] = useState<string>("");
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    setHtml("");
    setErr(false);
    fetch(\`\${SECTION_BASE}/\${slug}.html\`)
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((t) => alive && setHtml(t))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [slug]);

  return (
    <>
      {/* 共享 framer.css：承载 Wexo 全部 CSS 动画与交互样式 */}
      <link rel="stylesheet" href="/originkit/wexo/framer.css" />
      <div
        className="wexo-section-root"
        style={{ width: "100%", minWidth: 1140, overflow: "hidden" }}
      >
        {err ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            区块加载失败：/originkit/wexo/sections/{slug}.html
          </div>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>
    </>
  );
}

export default WexoSection;
`;
fs.writeFileSync(path.join(COMP, "shared.tsx"), shared, "utf8");
console.log("generated shared.tsx");

// ---------- 3. 生成 12 个薄封装组件 ----------
const pascal = (slug) =>
  "Wexo" + slug.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");

for (const s of SECTIONS) {
  const comp = pascal(s.slug);
  const code = `'use client';

import WexoSection from "./shared";

// Wexo 整站区块「${s.name}」（Originkit 原版，CSS 动效忠实还原）。
export default function ${comp}() {
  return <WexoSection slug="${s.slug}" />;
}
`;
  fs.writeFileSync(path.join(COMP, `${s.slug}.tsx`), code, "utf8");
  console.log(`generated ${s.slug}.tsx -> ${comp}`);
}

// ---------- 4. 组装 wexo/index.html 品牌包（相对路径） ----------
fs.mkdirSync(PKG, { recursive: true });
const pkgSections = SECTIONS.map((s) => {
  const raw = extractSection(s.name);
  return rewriteAsset(raw, ".");
}).join("\n\n");

const indexHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Wexo — Framer Template</title>
<link rel="stylesheet" href="./framer.css" />
<style>
  :root { color-scheme: light; }
  body { margin: 0; }
  /* 让各区块在窄屏也能完整展示，不横向溢出 */
  .wexo-page > div { width: 100%; }
</style>
</head>
<body>
<div class="wexo-page">
${pkgSections}
</div>
</body>
</html>
`;
fs.writeFileSync(path.join(PKG, "index.html"), indexHtml, "utf8");
console.log("generated wexo/index.html");

// ---------- 5. 复制 framer.css / images / fonts 到 wexo/ 使品牌包自包含 ----------
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}
fs.copyFileSync(path.join(PUB, "framer.css"), path.join(PKG, "framer.css"));
copyDir(path.join(PUB, "images"), path.join(PKG, "images"));
copyDir(path.join(PUB, "fonts"), path.join(PKG, "fonts"));
console.log("copied framer.css + images + fonts into wexo/");

console.log("\\nDONE. 12 Wexo sections split.");
