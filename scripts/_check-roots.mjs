import { readFileSync } from "node:fs";
const files = [
  "public/originkit/wexo/sections/hero.html",
  "public/originkit/wexo/sections/product-overview.html",
  "public/originkit/wexo/sections/how-to-use.html",
  "public/originkit/wexo/sections/pricing.html",
  "public/originkit/wexo/sections/about-us.html",
  "public/originkit/wexo/sections/comparison.html",
  "public/originkit/wexo/sections/blogs.html",
  "public/originkit/wexo/sections/cta.html",
  "public/originkit/wexo/wexo-hero.html",
  "wexo/index.html",
];
for (const f of files) {
  const t = readFileSync(f, "utf8");
  const m = t.match(/^<div[^>]*class="([^"]+)"/);
  const hasJzUpW = /framer-JzUpW/.test(t) ? "含JzUpW" : "不含JzUpW";
  console.log(`${f}\n   根class: ${m ? m[1] : "(无div开头)"}   ${hasJzUpW}`);
}
// 统计 framer.css 中带 / 不带 framer-JzUpW 前缀的选择器数量
const css = readFileSync("public/originkit/wexo/framer.css", "utf8");
const withJz = (css.match(/framer-JzUpW/g) || []).length;
const selCount = (css.match(/\.framer-/g) || []).length;
console.log(`\nframer.css: framer-JzUpW 出现 ${withJz} 次, .framer- 选择器出现 ${selCount} 次`);