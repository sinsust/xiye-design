// 对比度保护实测：列出所有 VISUAL_STYLES 在新 resolveStyleVars 下的
// --foreground 实际值，标出原 palette.text 与 bg 对比度 < 4.5:1 的风格（被保护）。
import { VISUAL_STYLES } from "../data/visual-styles";
import { resolveStyleVars, contrastRatio } from "../lib/style-resolver";

console.log("风格名 | 原 text | 原 contrast | → 新 foreground (保护)");
console.log("-".repeat(80));
for (const s of VISUAL_STYLES) {
  const v = resolveStyleVars(s, null) as Record<string, string>;
  const c = contrastRatio(s.palette.bg, s.palette.text).toFixed(2);
  const protectedFlag = s.palette.text.toLowerCase() !== v["--foreground"].toLowerCase();
  const mark = protectedFlag ? "  [被保护]" : "";
  console.log(`${s.name} | ${s.palette.text} | ${c} | ${v["--foreground"]}${mark}`);
}
