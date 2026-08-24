import fs from 'fs';

const SRC = 'D:/workspace/wexo';
const OUT = 'D:/workspace/xiye/public/originkit/wexo';

fs.mkdirSync(OUT + '/images', { recursive: true });
fs.mkdirSync(OUT + '/fonts', { recursive: true });

const html = fs.readFileSync(SRC + '/index.html', 'utf8');

// 1. 提取共享 framer.css（所有 <style data-framer-*>）
const styleRe = /<style[^>]*data-framer-[^>]*>[\s\S]*?<\/style>/g;
let m, css = '';
while ((m = styleRe.exec(html))) {
  css += m[0].replace(/^<style[^>]*>/, '').replace(/<\/style>$/, '') + '\n';
}
fs.writeFileSync(OUT + '/framer.css', css);
console.log('framer.css bytes:', css.length);

// 2. 复制 images / fonts
fs.cpSync(SRC + '/images', OUT + '/images', { recursive: true });
if (fs.existsSync(SRC + '/fonts')) fs.cpSync(SRC + '/fonts', OUT + '/fonts', { recursive: true });
console.log('images copied');

// 3. 定位页面级锚点（低频/语义 data-framer-name）
const anchors = ['Hero', 'Product Overview', 'Unique Feature', 'How To Use', 'Comparison', 'Pricing', 'Testimonials', 'Blogs', 'About Us', 'Our Team', 'CTA', 'Footer'];
const openRe = /<div\b[^>]*data-framer-name="([^"]+)"[^>]*>/g;
let a, anchorPos = [];
while ((a = openRe.exec(html))) {
  if (anchors.includes(a[1])) anchorPos.push({ name: a[1], pos: a.index });
}
console.log('anchors:', anchorPos.map((x) => x.name).join(', '));

const hi = anchorPos.findIndex((x) => x.name === 'Hero');
if (hi < 0) { console.log('NO HERO anchor found'); process.exit(1); }
const start = anchorPos[hi].pos;
const end = anchorPos[hi + 1] ? anchorPos[hi + 1].pos : html.length;

// 4. 栈平衡校验 [start, end)
const voids = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr']);
let depth = 0, i = start;
while (i < end) {
  if (html[i] === '<') {
    if (html[i + 1] === '/') { depth--; i = html.indexOf('>', i) + 1; }
    else {
      const sp = html.indexOf(' ', i), gt = html.indexOf('>', i);
      const tag = html.substring(i + 1, (sp < gt && sp !== -1) ? sp : gt).toLowerCase();
      if (voids.has(tag) || html[gt - 1] === '/') { i = gt + 1; }
      else { depth++; i = gt + 1; }
    }
  } else i++;
}
console.log('balance depth at end:', depth, '(0 = balanced)');

// 5. 生成 hero.html（图片路径绝对化）
const heroBody = html.slice(start, end).replace(/images\//g, '/originkit/wexo/images/');
const out = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<link rel="stylesheet" href="/originkit/wexo/framer.css">
<style>:root{--wexo-accent: rgb(27,30,33)} body{margin:0}</style>
</head>
<body>
<div class="wexo-root">${heroBody}</div>
</body>
</html>`;
fs.writeFileSync(OUT + '/hero.html', out);
console.log('hero.html bytes:', out.length, '-> /originkit/wexo/hero.html');
