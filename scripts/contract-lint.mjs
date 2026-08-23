// 视觉契约 lint（只读校验，不修改文件）。
// 扫描 data/skeletons/*.ts 中 code: 模板字符串里的硬编码颜色，
// 这些必须改为契约变量（--primary / --surface / --border / --radius …）。
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "data", "skeletons");
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const RGBA = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/g;

let total = 0;
const files = readdirSync(DIR).filter((f) => f.endsWith(".ts")).sort();
const report = [];

for (const f of files) {
  const lines = readFileSync(join(DIR, f), "utf8").split("\n");
  let inCode = false;
  let variant = null;
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const idMatch = line.match(/id:\s*"([^"]+)"/);
    if (idMatch && !inCode) variant = idMatch[1];

    if (/code:\s*`/.test(line)) inCode = true;

    if (inCode) {
      const hexes = [...line.matchAll(HEX)].map((m) => m[0]);
      const rgbs = [...line.matchAll(RGBA)].map((m) => m[0]);
      if (hexes.length || rgbs.length) {
        findings.push({ line: i + 1, variant, hexes, rgbs });
      }
    }

    if (inCode && /`\s*,?\s*$/.test(line)) inCode = false;
  }

  if (findings.length) {
    total += findings.length;
    report.push({ file: f, findings });
  }
}

for (const r of report) {
  console.log(`\n${r.file}  (${r.findings.length} 处硬编码色)`);
  for (const fnd of r.findings) {
    const parts = [];
    if (fnd.hexes.length) parts.push("hex=" + fnd.hexes.join(","));
    if (fnd.rgbs.length) parts.push("rgba=" + fnd.rgbs.join(","));
    console.log(`  L${fnd.line}  [${fnd.variant}]  ${parts.join("  ")}`);
  }
}
console.log(`\n=== 合计 ${total} 处硬编码色需改为契约变量 ===`);
