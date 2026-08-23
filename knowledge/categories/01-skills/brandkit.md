---
type: skill
name: brandkit · Premium 品牌视觉生成
summary: 一键产出品牌规范板、Logo 系统、视觉世界演示，覆盖极简/暗黑科技/奢华/开发者工具等风格
useCase: 需要在启动阶段快速拿到一个有完整设计基调的品牌视觉；但若要精细到像素级的定制 Brand 规范，仍要人工再设计
stack: [nextjs_supabase, nuxt_firebase, react_express, astro_supabase]
related: [one-shot-to-prd]
tags: [品牌, 视觉, logo, 设计系统]
status: active
updated: 2026-08-22
---
# brandkit（skill）

## 作用
给定品牌名或定位，生成一套 **Premium 品牌视觉**：品牌规范板、Logo 系统、视觉世界（Visual World）演示页。风格覆盖面广（极简 / 暗黑科技 / 奢华 / 开发者工具等），可直接作为新项目启动期的视觉地基，与 <code>docs/DESIGN_SPEC.md</code> 的设计 token 衔接。

## 适用场景
- **该用**：新项目/改版启动时，需要快速建立一个有辨识度的品牌基调；给 AI 一句话扩写后的产品愿景配套一套品牌视觉。
- **不要用 / 注意**：只把它当"帆样式演示"而不落成可复用的 token；对十位极致的商标/字体细节要人工再打磨，别盲信自动生成。
- **替代**：`brand-design-md`（从 getdesign.md 拉真实品牌规范）、`1688-sourcing-inquiry`（纯采购，非视觉）。

## 用法 / 接入
1. 通过 skill 仓库 `D:/workspace/skill/.agents/skills/brandkit` 复制到目标项目 `skills/`。
2. 输入品牌名/定位 → 生成品牌规范板 + Logo + 视觉世界。
3. 把产出回填进视觉 token，作为后续组件建模的依据。

## 依赖
- 支持任意 Web 框架（跨栈通用）。