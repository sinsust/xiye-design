// 动效资源清单（知识库「动效资源」Tab 的数据层）。
// 来源：本地 D:\workspace\gsap-snippets 的 11 个独立可运行片段 + 两个开源仓库。
// 目的：让用户不必记住本地片段路径与仓库地址，统一在此查阅。

export interface MotionResourceItem {
  name: string;
  scenario: string; // 归类到的动效场景
  file: string; // 本地文件名
}

export interface MotionResource {
  id: string;
  name: string;
  description: string;
  kind: "local" | "external";
  url?: string; // 外部仓库地址
  localPath?: string; // 本地目录
  tags: string[];
  items?: MotionResourceItem[]; // 本地片段清单
}

export const MOTION_RESOURCES: MotionResource[] = [
  {
    id: "gsap-snippets",
    name: "GSAP 动效片段库（本地）",
    description:
      "11 个独立可运行 HTML 片段，覆盖文字入场、滚动揭示、磁吸、3D 倾斜、数字滚动、跑马灯、平滑滚动等，双击即可在浏览器预览。",
    kind: "local",
    localPath: "D:\\workspace\\gsap-snippets",
    tags: ["GSAP", "ScrollTrigger", "SplitText", "Lenis", "本地"],
    items: [
      { name: "文字逐字/逐词入场", scenario: "文字入场", file: "01-text-reveal.html" },
      { name: "滚动渐显 + 交错", scenario: "滚动揭示", file: "02-scroll-fade-up.html" },
      { name: "横向滚动吸顶", scenario: "滚动揭示", file: "03-horizontal-scroll.html" },
      { name: "无限跑马灯", scenario: "数据/品牌", file: "04-marquee.html" },
      { name: "磁吸按钮", scenario: "交互反馈", file: "05-magnetic-button.html" },
      { name: "3D 卡片倾斜", scenario: "交互反馈", file: "06-3d-card-tilt.html" },
      { name: "数字滚动计数", scenario: "数据/品牌", file: "07-count-up.html" },
      { name: "图片 clip 揭示", scenario: "滚动揭示", file: "08-image-clip-reveal.html" },
      { name: "视差 Hero", scenario: "视差/转场", file: "09-parallax-hero.html" },
      { name: "旋转轮播词", scenario: "文字入场", file: "10-rotating-words.html" },
      { name: "Lenis 平滑滚动", scenario: "视差/转场", file: "11-smooth-scroll.html" },
    ],
  },
  {
    id: "zentry",
    name: "Zentry（Awwwards 克隆）",
    description:
      "React + Tailwind + GSAP 的 Awwwards 级网站克隆，核心动效：图片遮罩揭示、滚动钉住叙事、文字遮罩、横向滚动、光标效果。",
    kind: "external",
    url: "https://github.com/33Krishna/zentry",
    tags: ["React", "Tailwind", "GSAP", "Awwwards", "滚动叙事"],
  },
  {
    id: "truus",
    name: "Truus.co（Awwwards 站点）",
    description:
      "Awwwards 风格站点，核心动效：图片悬停揭示、光标跟随高亮、平滑滚动、页面转场。可作为高端动效参考。",
    kind: "external",
    url: "https://github.xm233.cn/Thakuma07/Truus.co-Awwward-Website.git",
    tags: ["Awwwards", "GSAP", "WebGL", "平滑滚动", "光标跟随"],
  },
];
