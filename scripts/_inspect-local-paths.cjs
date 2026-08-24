const fs = require("node:fs");
const path = require("node:path");
const cat = path.join(process.cwd(), "knowledge/categories");
const hits = [];
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) walk(fp);
    else if (f.endsWith(".md")) {
      const lines = fs.readFileSync(fp, "utf8").split("\n");
      lines.forEach((line, i) => {
        // 匹配盘符绝对路径（正/反斜杠）或常见本地目录起点
        if (/(?:[A-Za-z]:[/\\]|\/Users\/|\/home\/|C:\\|D:\\)/.test(line)) {
          hits.push({ file: path.relative(cat, fp), line: i + 1, text: line.trim().slice(0, 140) });
        }
      });
    }
  }
}
walk(cat);
console.log("命中本地路径的条目：");
let byFile = {};
for (const h of hits) byFile[h.file] = (byFile[h.file] || 0) + 1;
for (const k of Object.keys(byFile)) console.log("  " + k + "  (" + byFile[k] + " 处)");
console.log("\n明细：");
for (const h of hits) console.log("  " + h.file + ":" + h.line + "  → " + h.text);