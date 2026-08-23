import fs from "node:fs";

const s = fs.readFileSync("lib/project-generator.ts", "utf8");
const lines = s.split("\n");

// 找含裸反引号(U+60)或转义反引号(5c 60)的行
lines.forEach((l, i) => {
  const bare = [...l].filter((c) => c === "`").length;
  const esc = (l.match(/\\`/g) || []).length;
  if (bare > 0 || esc > 0) {
    console.log(`L${i + 1}: bare=${bare} esc=${esc} | ${JSON.stringify(l.slice(0, 90))}`);
  }
});