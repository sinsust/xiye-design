import { matchVisualStyles } from "../lib/visual-match";
import { VISUAL_STYLES } from "../data/visual-styles";

const idToName = (ids: string[]) =>
  ids.map((id) => VISUAL_STYLES.find((s) => s.id === id)?.name ?? id);

const cases = [
  "风格方向：Glassmorphism 毛玻璃 + Minimalism 极简，科技蓝\n配色：Primary #2563EB · CTA #2563EB · Background #F8FAFC · Text #0F172A\n字体：Space Grotesk + Inter",
  "深色运营后台，霓虹青色点缀，终端感\n配色：Primary #22D3EE · Background #0B0B0C",
  "暖色编辑刊物风，衬线标题，杂志感",
  "高端奢侈品牌，深红金，沉稳",
  "品牌红中国风，大气",
];
for (const c of cases) {
  console.log("=== spec:", c.split("\n")[0]);
  console.log("  匹配 →", idToName(matchVisualStyles(c, 2)).join("、") || "无");
}
