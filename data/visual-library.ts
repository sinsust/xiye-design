// 视觉/UI 库清单。
// 这些是当前业界真实流行、可落地的 UI 组件库与设计系统语言。
// 用途有二：
//  1) 作为 Step 4 类A「配色视觉风格」的来源之一（每个库抽 1-2 个代表风格进 VISUAL_STYLES）。
//  2) 作为「知识库」里的可查条目（省得忘记有哪些库可用、各自定位与官网）。
//
// 来源真实、官网链接均为各库官方地址。

import { VISUAL_STYLES } from "./visual-styles";

export type LibraryCategory = "ui-library" | "design-system";

export interface VisualLibrary {
  id: string; // 与 VISUAL_STYLES[].libraryId 对应
  name: string;
  officialUrl: string;
  description: string;
  category: LibraryCategory;
  tags: string[];
}

export const VISUAL_LIBRARY: VisualLibrary[] = [
  // ═══ 可落地组件库 ═══
  {
    id: "shadcn-ui",
    name: "shadcn/ui",
    officialUrl: "https://ui.shadcn.com",
    description:
      "基于 Radix + Tailwind 的可复制组件，New York / Default 两套风格，中性灰阶为主，可深度定制 token。",
    category: "ui-library",
    tags: ["React", "Tailwind", "Radix", "可复制"],
  },
  {
    id: "daisyui",
    name: "DaisyUI",
    officialUrl: "https://daisyui.com",
    description:
      "Tailwind CSS 组件库，30+ 内置主题（cyberpunk / synthwave / emerald / luxury / corporate 等），一行 class 切换主题。",
    category: "ui-library",
    tags: ["Tailwind", "主题", "多风格"],
  },
  {
    id: "material-ui",
    name: "Material UI (MUI)",
    officialUrl: "https://mui.com",
    description:
      "Google Material Design 的 React 实现，组件成熟丰富，蓝色主调 (#1976d2)，企业首选。",
    category: "ui-library",
    tags: ["React", "Material", "组件全"],
  },
  {
    id: "antd",
    name: "Ant Design",
    officialUrl: "https://ant.design",
    description:
      "企业级 React UI 库，蓝 (#1677ff) 主色，约定俗成的中后台首选，组件密度高。",
    category: "ui-library",
    tags: ["React", "中后台", "企业"],
  },
  {
    id: "aceternity-ui",
    name: "Aceternity UI",
    officialUrl: "https://ui.aceternity.com",
    description:
      "玻璃拟态 + 霓虹渐变的炫酷组件，Tailwind + Framer Motion，适合作品集与营销站。",
    category: "ui-library",
    tags: ["玻璃拟态", "动效", "炫酷"],
  },
  {
    id: "magic-ui",
    name: "Magic UI",
    officialUrl: "https://magicui.design",
    description:
      "Framer Motion 动效组件 + 渐变光效，暗色炫光风格，适合 landing 与 AI 产品。",
    category: "ui-library",
    tags: ["动效", "渐变", "暗色"],
  },
  {
    id: "heroui",
    name: "HeroUI",
    officialUrl: "https://www.heroui.com",
    description:
      "原 NextUI，Tailwind 驱动的现代化 React 组件，干净蓝青调，主题开箱即用。",
    category: "ui-library",
    tags: ["React", "Tailwind", "现代"],
  },
  {
    id: "flowbite",
    name: "Flowbite",
    officialUrl: "https://flowbite.com",
    description:
      "基于 Tailwind 的组件与模板，蓝 (#1A56DB) 主调，文档型 / 后台型设计友好。",
    category: "ui-library",
    tags: ["Tailwind", "模板", "后台"],
  },
  {
    id: "radix-themes",
    name: "Radix Themes",
    officialUrl: "https://www.radix-ui.com",
    description:
      "Radix 官方设计系统，灰阶 token + 一致组件，理性克制，无框架绑架。",
    category: "ui-library",
    tags: ["Radix", "设计系统", "灰阶"],
  },
  {
    id: "tailwind-ui",
    name: "Tailwind UI",
    officialUrl: "https://tailwindui.com",
    description:
      "Tailwind 官方付费组件库，中性 + indigo 点缀，极简商务风，结构清晰。",
    category: "ui-library",
    tags: ["Tailwind", "商务", "极简"],
  },

  // ═══ 设计系统语言 ═══
  {
    id: "fluent-2",
    name: "Microsoft Fluent 2",
    officialUrl: "https://fluent2.microsoft.design",
    description:
      "Microsoft Fluent 2 设计系统，企业级，蓝 (#0078D4) + Segoe 字体 + 圆角，跨平台一致。",
    category: "design-system",
    tags: ["微软", "企业", "跨平台"],
  },
  {
    id: "carbon",
    name: "IBM Carbon",
    officialUrl: "https://carbondesignsystem.com",
    description:
      "IBM Carbon 设计系统，工业理性，蓝 (#0F62FE) + 密集网格，数据密集型应用首选。",
    category: "design-system",
    tags: ["IBM", "工业", "数据密集"],
  },
  {
    id: "apple-hig",
    name: "Apple HIG",
    officialUrl: "https://developer.apple.com/design",
    description:
      "Apple Human Interface Guidelines，银白 + 系统蓝 (#007AFF) + 大圆角 SF，精致克制。",
    category: "design-system",
    tags: ["Apple", "精致", "大圆角"],
  },
  {
    id: "vercel-geist",
    name: "Vercel Geist",
    officialUrl: "https://vercel.com/geist",
    description:
      "Vercel Geist 设计语言，纯黑白极简 + Geist 字体，开发者审美标杆。",
    category: "design-system",
    tags: ["Vercel", "极简", "黑白"],
  },
  {
    id: "material-3",
    name: "Material Design 3",
    officialUrl: "https://m3.material.io",
    description:
      "Material Design 3，动态色彩 (Dynamic Color) + 大圆角，紫 (#6750A4) 为默认种子色。",
    category: "design-system",
    tags: ["Google", "动态色彩", "大圆角"],
  },
  {
    id: "github-primer",
    name: "GitHub Primer",
    officialUrl: "https://primer.style",
    description:
      "GitHub Primer 设计系统，灰 + 绿 (#2DA44E) + 系统字体，工程社区风。",
    category: "design-system",
    tags: ["GitHub", "工程", "社区"],
  },
];

export const LIBRARY_CATEGORY_LABELS: Record<LibraryCategory, string> = {
  "ui-library": "UI 组件库",
  "design-system": "设计系统语言",
};

// 由 VISUAL_STYLES 动态反查某库贡献的风格（避免维护两份数据）。
export function getLibraryStyles(libraryId: string) {
  return VISUAL_STYLES.filter((s) => s.libraryId === libraryId);
}
