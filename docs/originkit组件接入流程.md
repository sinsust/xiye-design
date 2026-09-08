# Originkit 组件接入流程

把 Originkit（originkit.dev）的组件接入 xiye 组件库，暴露到 `/components` 预览页、
可调参数面板和源码复制。分**两种来源**：
- **单文件组件**（`components/originkit/ui/*`）：从官网复制的一段独立源码，如
  spotlight-frames、image-grid。
- **整站区块**（`components/originkit/outstand/*`）：Framer/Originkit 的 Outstand
  模板区块，`tsx + css module + 图片`，走 `intake-outstand-section` skill。

`npx originkit@latest add <name>` 是**官方 CLI**（需 `originkit login` 或 `--auth <key>` 鉴权）。它会产出组件到
`components/originkit/` + 素材到 `public/originkit/`，还可以通过生成的多文件目录结构理解组件——但**不会**自动登记进
本项目组件库/预览页，接入仍走下面的流程。

## 目录

- [背景与约定](#背景与约定)
- [单文件组件 · 四步接入](#单文件组件--四步接入)
  - [1. 落源码文件](#1-落源码文件)
  - [2. 登记数据](#2-登记数据)
  - [3. 接线预览](#3-接线预览)
  - [4. 检查与验证](#4-检查与验证)
- [整站区块（Outstand 模板）接入](#整站区块outstand-模板接入)
- [常见坑位](#常见坑位)
- [涉及文件清单](#涉及文件清单)

## 背景与约定

- 组件源码统一落在 `components/originkit/` 下：单文件组件放 `ui/`，整站模板放
  各自子目录。**目录结构不要改**，它与 `data/component-library.ts` 的来源映射一一对应。
- 官方源码默认 `import * as THREE from "three"`，但本项目统一用**具名导入**：
  `import { Scene, WebGLRenderer, ... } from "three"`。参照
  `components/originkit/ui/hero-19/particlesphere.tsx`。
- `three`。真实 `three` 包不带类型，也不装 `@types/three`。类型由本项目手写存根
  `lib/three.d.ts`（`declare module "three"`）提供。新组件用到存根里没有的导出时，
  必须同步补充，否则 tsc 报 `no exported member`。
- 每个导出符号除了 `export const X: any` 还要给 `export type X = any`，否则组件把
  它当类型标注（字段/参数 `x: WebGLRenderer`）时会报 `refers to a value`。
- 官方导出用 `__OriginkitBase_XXX`（双下划线）包内部实现会被
  `react-hooks/rules-of-hooks` lint 拦截，改名为常规大写开头（如 `ImageGridBase`）。
- 默认素材图：若走 `imagedelivery.net`（A 层精图）或 `picsum.photos`，CSP 已放行
  （`next.config.ts` 的 `img-src`）；若新组件默认图来自其他图床（如
  `images.unsplash.com`），必须同步加进 CSP，否则预览会因被拦而空白。

## 单文件组件 · 四步接入

### 1. 落源码文件

把官网复制到的源码写成新文件，例如 `components/originkit/ui/<id>.tsx`：

- 保留 `"use client"`。
- 顶部注释保留来源信息（网站 / 原作者 / 参考仓库），便于溯源。
- 按上文约定修正 three 导入、组件名、类型存根、CSP 域名。

### 2. 登记数据

编辑 `data/component-library.ts` 两处：

- **`SOURCE_FILES`**：把组件 id 映射到源码路径，供「复制源码」。

  ```ts
  "my-component": ["components/originkit/ui/my-component.tsx"],
  ```

- **`COMPONENT_LIB`** 数组追加条目（分类里选「特效」等）：

  ```ts
  {
    id: "my-component",
    name: "My Component",
    icon: "Orbit", // 必须是 page.tsx 已导入的 lucide 图标名
    description: "一句话说明效果 + （取自 Originkit xxx，驱动方式）",
    category: "特效",
    settings: [
      { key: "speed", label: "速度", kind: "range", default: 7, min: 1, max: 20, step: 1 },
      { key: "mode", label: "模式", kind: "select", default: "on",
        options: [{ label: "开", value: "on" }, { label: "关", value: "off" }] },
      { key: "bg", label: "画布底色", kind: "color", default: "#0f0f0f" },
    ],
  },
  ```

  `settings` 的 key 就是预览块里 `settings.<key>` 读取的字段名；`kind` 支持
  `range` / `select` / `color` 等。

### 3. 接线预览

编辑 `app/components/page.tsx` 两处：

- 顶部加动态导入（与既有组件平齐，用 `PreviewLoading`）：

  ```ts
  const MyComponent = dynamic(() => import("@/components/originkit/ui/my-component"), { loading: PreviewLoading });
  ```

- 在 `comp.id === "my-component" && (...)` 守卫块里渲染，把 `settings` 映射成组件
  props（组件是分组 props 就按组传，扁平 props 就平铺）：

  ```tsx
  {comp.id === "my-component" && (
    <div className="flex h-[440px] w-full items-center justify-center overflow-hidden py-4">
      <MyComponent speed={Number(settings.speed ?? 7)} bg={String(settings.bg ?? "#0f0f0f")} />
    </div>
  )}
  ```

### 4. 检查与验证

```bash
npx tsc --noEmit       # 必须 0 错误
npx eslint components/originkit/ui/<id>.tsx data/component-library.ts app/components/page.tsx
```

- tsc 0 错误、eslint 不新增 error（page.tsx 既有的 `set-state-in-effect` /
  `no-explicit-any` 是存量 warning，不归本次）。
- 若改了 `next.config.ts`（CSP），需重启 dev server 才生效；只改源文件/数据/页面
  则由 Turbopack 按需重编译，无需重启。
- 登录后到 `/components` 选该组件，拖参数看预览是否随设置变化。
- **多文件组件**（`SOURCE_FILES` 长度 > 1，含相对导入/素材）预览区会自动出现「下载完整包」
  按钮：走 `/api/component-zip`（登录 + 限流）把源码 + `public/originkit/<slug>/` 素材保目录结构打
  zip，方便直接搬进自己项目。单文件组件无此按钮，用「复制源码」即可。

---

## 整站区块（Outstand 模板）接入

与上面的「单文件组件」不同，整站区块来自 Framer/Originkit 的 **Outstand** 模板，
产出一组 `区块 tsx + css module + 图片资源`，要求在外观/动画上**像素级一致**，
同时以最小改造脱离开源模板独立运行。此流程已封装为 skill
`intake-outstand-section`，给定一个新区块源码或整页目录即自动执行。

### 适用与不适用

- 触发语：把某些区块加进来 / 开始拆某子页面的区块（source 为 `.tsx` + `.module.css` 或整页目录）。
- 不适用：用户要改造视觉/文案（非搬运）；复杂运行时依赖（自行评估）；只给模板名/链接没给源码。

### 产物（5 处）

1. `components/originkit/outstand/{slug}.tsx`
2. `components/originkit/outstand/{slug}.module.css`（顶部注入 **scoped Outstand tokens**）
3. `public/originkit/outstand/{slug}/` 图片资源
4. `data/component-library.ts`：`SOURCE_FILES` + `COMPONENT_LIB`
5. `app/components/page.tsx`：import + 渲染块

### 命名规范

- **slug** `{页面}-{语义名}` 小写连字符：首页直接 `hero/pricing/faq`；子页加前缀
  `services-hero`、`about-team-members`、`contact-faq`、`works-portfolio`
- **组件 id** `outstand-{slug}`；**import 变量** `Outstand{页面缩写+大驼峰}`（如 `OutstandServicesHero`）
- 不同页面同名区块（home/works 都有 `ContactUs`）必须用页面前缀区分；通用辅助组件（环形文字等）放
  `components/originkit/outstand/` 根部，`./xxx` 相对引用

### 依赖剥离（关键）

- `next/image` → 原生 `<img>`；`next/link` → `<a>`（删 import、去 placeholder/priority/fill）
- `@/config/site` → 只把被用到的字段内联替换（如地图 URL），不整包导入
- 本地 ui 依赖（如 `CircularText`）→ 一起搬进 `components/originkit/outstand/`，改 `./xxx`
- 图片：所有 `/assets/media/` 改写成 `/originkit/outstand/{slug}/`，并复制资源进 `public/`
- 转换脚本放 `scripts/conver-*.ps1`，**用完删除**

### scoped tokens

每个 `.module.css` 顶部注入一段 `:local({ROOT}) { --color-accent: ...; --font-*; --ease-out-framer; ... }`
（`{ROOT}` 用该组件根类名替换）。这让主题色/字体/动效曲线只作用于该组件，不污染全局；
`[data-border='true']::after` 规则负责区块内边框（`data-border`），别漏加。

### 组件库接线

`component-library.ts`：
```ts
"outstand-{slug}": ["components/originkit/outstand/{slug}.tsx", "components/originkit/outstand/{slug}.module.css"],
// COMPONENT_LIB：
{ id: "outstand-{slug}", name: "Outstand {中文名}", icon: "Sparkles",
  description: "深色{类型}区块：{标题} + {内容概要}（取自 Outstand {页面} 页面）。",
  category: "整站模板", site: "Outstand",
  settings: [{ key: "accentColor", label: "主题色", kind: "color", default: "#CDF140" }] }
```
description 的标题/内容从源码实际文案提取，不臆造；至少保留一个 `accentColor` 主题色设置。

`page.tsx` 渲染块：普通区块包 `<SectionScope accent={settings.accentColor}>` + `<WidePreviewFrame>`；
Hero 类用带 prop 模式（如 `<OutstandHero compact ...>`）；作品集类若 CSS 用视口级媒体查询会被
预览容器宽度骗到，用 `<SectionScope container ...>` + 把媒体查询改写为 `@container`。

### 验证与清理

- `npx tsc --noEmit` 干净（import 路径 / CSS 类名 / 残留 next·site 引用）
- 浏览器直连验证：`http://localhost:3200/components?comp=outstand-{slug}`
  检查渲染无溢出、图片加载无破图、主题色与 `data-border` 可见、FAQ/定价等交互正常（容器内固定宽
  区块内部 `overflow:auto` 属原设计，判断标准是「页面无横向滚动条」）
- 删临时转换脚本，向用户汇报

---

## 常见坑位

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `Namespace '"three"' has no exported member 'X'` | 用了 `import * as THREE` | 改成具名导入 |
| `Module '"three"' has no exported member 'X'` | `lib/three.d.ts` 存根缺该导出 | 补充 `export const X: any` + `export type X = any` |
| `'Mesh' refers to a value, but is used as a type` | 存根只有 const，无同名 type | 补 `export type Mesh = any` |
| `React Hook ... neither a component nor a custom Hook` | `__OriginkitBase_XXX` 双下划线命名 | 改 `XXXBase` |
| 默认图在预览里空白 | 图床不在 CSP `img-src` | 加域名到 `next.config.ts` 的 CSP | 

## 涉及文件清单

单文件组件：

| 文件 | 作用 |
| --- | --- |
| `components/originkit/ui/<id>.tsx` | 组件源码单文件 |
| `data/component-library.ts` | `SOURCE_FILES` 来源映射 + `COMPONENT_LIB` 条目 |
| `app/components/page.tsx` | 动态导入 + 预览渲染块 |
| `lib/three.d.ts` | three 类型存根（按需补导出） |
| `next.config.ts` | CSP `img-src`（按需放行新图床域名） |

整站区块（Outstand）额外涉及：

| 文件 | 作用 |
| --- | --- |
| `components/originkit/outstand/{slug}.tsx` + `.module.css` | 区块源码 + scoped tokens 样式 |
| `public/originkit/outstand/{slug}/` | 区块图片资源 |
| `scripts/conver-*.ps1` | 一次性转换脚本（用完删除） |
| skill `intake-outstand-section` | 封装整套自动搬运流程 |

已有范例：
- 单文件组件：`components/originkit/ui/spotlight-frames.tsx`（framer-motion）、
  `components/originkit/ui/image-grid.tsx`（three.js）、
  `components/originkit/ui/hover-image-reveal.tsx`（framer-motion）
- 整站区块：`components/originkit/outstand/`（hero/services-hero/about-team-members 等）