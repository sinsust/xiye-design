import { extractPrimaryColor } from "../lib/visual-match";

const cases = [
  "PATTERN: Hero-Centric\nSTYLE: Glassmorphism\nCOLORS\nPrimary #2563EB（科技蓝） · CTA #2563EB\nBackground #F8FAFC · Text #0F172A",
  "深色运营后台，霓虹青色点缀\n主色：#22D3EE\nBackground #0B0B0C",
  "风格方向：Minimalism 极简\nAccent #F59E0B（暖橙）\nBackground #FFFDF5",
  "没有明确配色的描述文本，只聊了风格",
];
for (const c of cases) {
  console.log("=== spec:", c.split("\n")[0].slice(0, 30));
  console.log("  primary →", extractPrimaryColor(c));
}
