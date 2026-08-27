import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // 覆盖：风格债与 react-hooks v6 新规则降为 warn（保留可见性、不阻塞构建）。
  // 说明：
  // - no-explicit-any：既有代码的类型严谨度风格债（多为 GSAP 回调/第三方库边界），
  //   逐条改代码工作量大且收益低，先保留提示、不阻断。
  // - react-hooks v6 新规则（set-state-in-effect/refs/immutability 等）：对既有
  //   「effect 同步状态 / 动画 ref 访问」模式多为保守误报，运行时安全，降 warn。
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/globals": "warn",
      "react-hooks/use-memo": "warn",
    },
  },
  // 骨架预览的装饰性引号（React 自动转义，渲染安全），关闭该规则
  {
    files: ["app/builder/previews.tsx"],
    rules: { "react/no-unescaped-entities": "off" },
  },
  // .cjs 脚本使用 require 是合法的 CommonJS 用法
  {
    files: ["**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // WorkBuddy 运行数据：浏览器 CDP profile（含扩展缓存 JS）、记忆/配置，非项目源码
    ".workbuddy/**",
    // 整站模板（第三方独立站点，含各自构建产物），非主应用源码
    "genius/**",
    "wexo/**",
    "outstand/**",
    // esbuild 打包产物（npm run validate:* 生成）：第三方依赖被内联后触发 no-this-alias 等
    // 规则误报，且产物非手写源码，不应被 lint。源 .mts 仍正常扫描。
    "scripts/.tmp-*.mjs",
  ]),
]);

export default eslintConfig;
