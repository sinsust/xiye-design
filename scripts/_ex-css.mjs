import { readFileSync } from "node:fs";

const css = readFileSync("public/originkit/wexo/framer.css", "utf8");

// 提取所有顶层媒体块及其内部规则
function extractRules(css, target) {
  const out = [];
  // 简单拆块：追踪 {}
  let i = 0, depth = 0, start = -1;
  const chunks = [];
  for (let k = 0; k < css.length; k++) {
    const ch = css[k];
    if (ch === "{") {
      if (depth === 0) start = k;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        chunks.push({ media: null, text: css.slice(0, start) });
        // 内部规则以 chunk 的起点之后的平衡块处理：简化——直接取整块
        chunks.pop();
        // 简化策略：找到包裹这个 } 的 media 声明
        out.push({ pos: k, media: findMedia(css, start) });
        // 重置以便继续——不完整，改用另一个方法
      }
    }
  }
  return out;
}

function findMedia(css, pos) {
  const before = css.slice(0, pos);
  const m = before.split("}").pop(); // 可能含 @media
  const mm = m.match(/@media[^{]*{/);
  if (mm) return mm[0].replace("{", "").trim();
  return null;
}

// 用更稳健方法：扫描所有平衡规则块，记录其所在 media
function collect(css) {
  const blocks = []; // {media, selector, body}
  const stack = [];
  let buf = "";
  let depth = 0;
  let curMedia = null;
  const opens = []; // 记录 { 前的串
  for (let k = 0; k < css.length; k++) {
    const ch = css[k];
    if (ch === "{") {
      const prefix = (buf + "").replace(/\/\*[^]*?\*\//g, "").replace(/\s+/g, " ").trim();
      opens.push({ prefix, media: curMedia, innerStart: buf.length + 1 });
      depth++;
      buf = "";
    } else if (ch === "}") {
      const o = opens.pop();
      depth = Math.max(0, depth - 1);
      if (o) {
        if (/^@media/.test(o.prefix)) {
          curMedia = o.prefix.replace(/^@media\s*/, "").replace(/\s*{$/, "").trim();
        } else if (!/^@/.test(o.prefix)) {
          const body = buf;
          blocks.push({ media: curMedia, selector: o.prefix, body });
        }
      }
      buf = "";
    } else {
      buf += ch;
    }
  }
  return blocks;
}

const blocks = collect(css);
const keys = ["framer-crksx4", "framer-1qsbvwn", "framer-xt4fo0", "framer-1aavm83", "framer-8d3gfo", "framer-1se3eef", "framer-6zmjm0", "framer-du3v5p"];
for (const key of keys) {
  console.log(`\n########## ${key} 共 ${blocks.filter(b => b.selector.includes(key)).length} 条 ##########`);
  for (const b of blocks) {
    if (b.selector.includes(key)) {
      const media = b.media ? `[media ${b.media}] ` : "";
      console.log(`${media}${b.selector}\n       → ${b.body.slice(0, 400)}`);
    }
  }
}