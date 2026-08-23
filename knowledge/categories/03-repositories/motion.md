---
type: repository
name: motion（动画引擎，含 framer-motion）
summary: 开源动画库：手势/弹簧/布局过渡/滚动关联动画/时间轴，支持 React/Vue/JS
useCase: 需要成熟动画 API 做页面过渡、滚动动效、手势交互时
repoUrl: https://github.com/motiondivision/motion
stack: [nextjs_supabase, react_express]
tags: [动画, 引擎, motion]
source: https://motion.dev/
status: active
updated: 2026-08-22
---
# motion（repository）

## 作用
**Motion**（原 Framer Motion）是成熟开源动画引擎：手势、弹簧、布局过渡、滚动关联动画、时间轴，支持 React/Vue/纯 JS，是"动画层"的首选其一。

## 适用场景
- **该用**：页面入场/过渡、滚动驱动动画、手势交互、需要声明式动画 API 时。
- **不要用 / 注意**：复杂长页滚动控制更多用 GSAP；与 GSAP 二选一做动画层，避免混装。
- **替代**：`gsap`（框架无关、更强时间线/ScrollTrigger）、`react-spring`（物理弹簧轻量）。

## 技术栈 / 要求
- React/Vue/JS；与 Tailwind 并存无冲突。

## 相关
- [gsap 相关：本地底座已用] · [react-bits](react-bits.md)