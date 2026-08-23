import fs from "node:fs";

const file = "lib/project-generator.ts";
const s = fs.readFileSync(file, "utf8");
const lines = s.split("\n");

// 打印 L634 完整字节
const l = lines[633];
console.log("L634 chars:", [...l].map((c) => `${c}=U+${c.codePointAt(0).toString(16)}`).join(" "));

// 测试替换行为
const test = "\\`（abc\\`（（def";
console.log("test replaceAll \\`（ -> `:", JSON.stringify(test.replaceAll("\\`（", "`")));
