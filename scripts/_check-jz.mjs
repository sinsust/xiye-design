import { readFileSync } from "node:fs";
const css = readFileSync("public/originkit/wexo/framer.css", "utf8");

// 提取 framer-JzUpW 兜底基线（不带子选择器）
const m = css.match(/\.framer-JzUpW\s*\{([^}]*)\}/);
console.log("=== .framer-JzUpW{...} 基线 ===");
console.log(m ? m[0].slice(0, 500) : "(无纯粹 framer-JzUpW 基线块)");

// 统计带 framer-JzUpW 前缀的规则里，选择器形如 .framer-JzUpW .framer-xxx 与 .framer-JzUpW.X 的数量
const countNested = (css.match(/\.framer-JzUpW\s+\.framer-/g) || []).length;
const countCombined = (css.match(/\.framer-[A-Za-z0-9]+\.framer-JzUpW|\.framer-JzUpW\.framer-/g) || []).length;
console.log(`\n.framer-JzUpW .framer- (后代) 规则数: ${countNested}`);
console.log(`.framer-JzUpW.X 组合 规则数: ${countCombined}`);

// framer.css 里 framer-xt4fo0 的前缀 100% 是 framer-JzUpW 吗？
const heroMentions = css.match(/\.framer-JzUpW\s+\.framer-xt4fo0/g) || [];
const boardMentions = css.match(/([^}\s,]+)\s*\.framer-xt4fo0/g) || [];
console.log(`\n.framer-JzUpW .framer-xt4fo0 : ${heroMentions.length} 处`);
console.log(`所有 .framer-xt4fo0 出现: ${(css.match(/framer-xt4fo0/g)||[]).length} 处`);
// 找出非 JzUpW 的 framer-xt4fo0 选择器前缀
const sels = Array.from(css.matchAll(/([^};,{}]*\.framer-xt4fo0)/g));
const nonJz = sels.map(s=>s[1].trim()).filter(x=>!x.includes("framer-JzUpW"));
console.log("不带 framer-JzUpW 的 xt4fo0 选择器片段:", nonJz.length ? nonJz.slice(0,10) : "(全部带前缀)");