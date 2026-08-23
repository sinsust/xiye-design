// 视觉风格预设。
// 内容从本地视觉类 skill（D:\workspace\skill）真实定义中提炼，非凭空设计：
//  - minimalist-ui       → 极简编辑风（暖色单色 + 点缀粉彩）
//  - brandkit            → 暗黑开发者 / 暗黑产品运营 / 暗黑自然静谧 / 暗黑安全 / 轻奢编辑 / 奢华质感
//  - high-end-visual-design → 空灵玻璃 / 编辑奢华 / 柔构主义
//  - design-presets 配色 → 科技蓝 / 自然绿 / 暗夜紫 / 暖橙 / 中国红 / 高级灰
// 每个预设携带真实色板（hex）、字体倾向、圆角，以及可直接复制的
// 「风格提示词」与「设计 Token 代码」，供 Step 4 与生成环节消费。

export type StyleFont = "serif" | "sans" | "mono" | "grotesk";

export interface VisualStyle {
  id: string;
  name: string;
  sourceSkill: string; // 来源 skill id
  description: string;
  prompt: string; // 可直接复制给 AI / 设计工具的风格提示词
  palette: {
    bg: string; // 页面背景
    surface: string; // 卡片/面板
    border: string; // 描边/分割
    text: string; // 主文字
    muted: string; // 次级文字
    accent: string; // 主强调色
    accent2: string; // 次强调色
    accents?: string[]; // 扩展强调色（多色/霓虹演示变体锚定到此，最多补到 6 档）
  };
  font: StyleFont;
  radius: number; // px
  blur?: boolean; // 毛玻璃效果（预览用）
  previewBg?: string; // 预览底板（玻璃风用渐变）
  libraryId?: string; // 关联 data/visual-library.ts 中的库 id（库风格预设才有）
}

const SERIF =
  "'PP Editorial New', 'Newsreader', 'Playfair Display', 'Lyon Text', Georgia, serif";
const SANS =
  "'Geist', 'Plus Jakarta Sans', 'Helvetica Neue', system-ui, sans-serif";
const MONO = "'Geist Mono', 'SF Mono', 'JetBrains Mono', monospace";
const GROTESK =
  "'Clash Display', 'Space Grotesk', 'Geist', system-ui, sans-serif";

export const FONT_STACK: Record<StyleFont, string> = {
  serif: SERIF,
  sans: SANS,
  mono: MONO,
  grotesk: GROTESK,
};

export const VISUAL_STYLES: VisualStyle[] = [
  {
    id: "minimalist-editorial",
    name: "极简编辑风",
    sourceSkill: "minimalist-ui",
    description: "暖色单色 + 点缀粉彩，衬线大标题、扁平 bento、克制阴影。",
    prompt:
      "Minimalist editorial visual style: warm ivory background (#F7F6F3), soft pastel accents (#1F6C9F blue, #9F2F2D red), serif display headings, flat bento layout with restrained shadows and generous whitespace.",
    palette: {
      bg: "#F7F6F3",
      surface: "#FFFFFF",
      border: "#EAEAEA",
      text: "#111111",
      muted: "#787774",
      accent: "#1F6C9F",
      accent2: "#9F2F2D",
    },
    font: "serif",
    radius: 10,
  },
  {
    id: "truus-aurora",
    name: "Truus 极光",
    sourceSkill: "truus-co-awwwards",
    description: "暖米色画布 + 多彩强调（蓝/橙/粉/绿），大胆活泼的创意机构风。",
    prompt:
      "Truus aurora visual style: warm beige canvas (#F0EBE6), white surfaces, bold multicolor accents (blue #4B69F0, orange #F5693C, pink #F0BEFA, green #29725F), grotesk display headings, playful rounded cards.",
    palette: {
      bg: "#F0EBE6",
      surface: "#FFFFFF",
      border: "#E3DDD5",
      text: "#1A1A1A",
      muted: "#6B6660",
      accent: "#4B69F0",
      accent2: "#F5693C",
      accents: ["#F0BEFA", "#29725F"],
    },
    font: "grotesk",
    radius: 10,
  },
  {
    id: "dark-developer",
    name: "暗黑开发者",
    sourceSkill: "brandkit",
    description: "近黑画布 + 青/珊瑚强调，等宽字体与终端质感，builder 原生。",
    prompt:
      "Dark developer visual style: near-black canvas (#0A0A0B), cyan (#22D3EE) and coral (#FB7185) accents, monospace typography, terminal-inspired surfaces with subtle borders.",
    palette: {
      bg: "#0A0A0B",
      surface: "#141416",
      border: "#262629",
      text: "#F5F5F5",
      muted: "#9A9AA2",
      accent: "#22D3EE",
      accent2: "#FB7185",
      accents: ["#F59E0B", "#34D399", "#A78BFA", "#F472B6"],
    },
    font: "mono",
    radius: 8,
  },
  {
    id: "dark-operator",
    name: "暗黑产品运营",
    sourceSkill: "brandkit",
    description: "黑 / 暗红 / 琥珀，发光芯片与卡片系统，运营工具质感。",
    prompt:
      "Dark operator visual style: black canvas (#0B0B0C), amber (#F59E0B) and red (#EF4444) accents, glowing chip and card system, ops-tool aesthetic.",
    palette: {
      bg: "#0B0B0C",
      surface: "#161618",
      border: "#2C2C30",
      text: "#F5F5F5",
      muted: "#A1A1AA",
      accent: "#F59E0B",
      accent2: "#EF4444",
    },
    font: "sans",
    radius: 8,
  },
  {
    id: "dark-nature",
    name: "暗黑自然静谧",
    sourceSkill: "brandkit",
    description: "深绿 + 柠檬绿 + 雾灰，静谧可信的安静高级感。",
    prompt:
      "Dark nature visual style: deep green canvas (#0C1410), lime (#A3E635) and emerald (#34D399) accents, misty gray text, calm and trustworthy premium feel.",
    palette: {
      bg: "#0C1410",
      surface: "#14201A",
      border: "#243A2E",
      text: "#E8F0EA",
      muted: "#8FA89A",
      accent: "#A3E635",
      accent2: "#34D399",
    },
    font: "sans",
    radius: 10,
  },
  {
    id: "dark-security",
    name: "暗黑安全",
    sourceSkill: "brandkit",
    description: "黑 / 海军蓝 + 红蓝告警芯片，严肃、警觉、精准。",
    prompt:
      "Dark security visual style: black-navy canvas (#080810), blue (#3B82F6) primary and red (#EF4444) alert accents, serious, alert, precise.",
    palette: {
      bg: "#080810",
      surface: "#12121F",
      border: "#232338",
      text: "#EDEDF5",
      muted: "#8B8BA7",
      accent: "#3B82F6",
      accent2: "#EF4444",
    },
    font: "mono",
    radius: 8,
  },
  {
    id: "light-editorial",
    name: "轻奢编辑",
    sourceSkill: "brandkit",
    description: "暖象牙 + 深蓝 / 红 / 金，衬线标签与信笺质感，机构感。",
    prompt:
      "Light editorial visual style: warm ivory background (#FBF7F0), deep navy (#1E3A8A) and gold/red (#B45309) accents, serif labels, letterpress institutional feel.",
    palette: {
      bg: "#FBF7F0",
      surface: "#FFFFFF",
      border: "#E8E0D4",
      text: "#1A1A1A",
      muted: "#6B6256",
      accent: "#1E3A8A",
      accent2: "#B45309",
    },
    font: "serif",
    radius: 8,
  },
  {
    id: "luxury",
    name: "奢华质感",
    sourceSkill: "brandkit",
    description: "象牙 / 石灰 / 浓缩咖，衬线字标与浮雕细节，成人、昂贵。",
    prompt:
      "Luxury visual style: ivory (#F5F1EA) and stone surfaces, concentrated coffee (#8B6F47) accents, serif wordmarks with embossed detail, expensive and mature.",
    palette: {
      bg: "#F5F1EA",
      surface: "#FFFFFF",
      border: "#E0D8CC",
      text: "#2B2620",
      muted: "#8C8273",
      accent: "#8B6F47",
      accent2: "#6B5B45",
    },
    font: "serif",
    radius: 6,
  },
  {
    id: "ethereal-glass",
    name: "空灵玻璃",
    sourceSkill: "high-end-visual-design",
    description: "OLED 黑 + 紫 / 绿光晕，毛玻璃面板与宽体无衬线。",
    prompt:
      "Ethereal glass visual style: OLED black canvas with purple (#A855F7) and green (#34D399) glow, frosted glass panels, wide grotesk sans-serif.",
    palette: {
      bg: "#050505",
      surface: "rgba(255,255,255,0.05)",
      border: "rgba(255,255,255,0.12)",
      text: "#FFFFFF",
      muted: "#A0A0A8",
      accent: "#A855F7",
      accent2: "#34D399",
    },
    font: "grotesk",
    radius: 20,
    blur: true,
    previewBg:
      "radial-gradient(60% 60% at 30% 20%, rgba(168,85,247,0.25), transparent), radial-gradient(50% 50% at 80% 80%, rgba(52,211,153,0.18), transparent), #050505",
  },
  {
    id: "editorial-luxury",
    name: "编辑奢华",
    sourceSkill: "high-end-visual-design",
    description: "暖奶油 + 鼠尾草绿，可变衬线巨标题 + 细微胶片颗粒。",
    prompt:
      "Editorial luxury visual style: warm cream (#FDFBF7) background, sage green (#6B7A5E) accents, variable serif display headings with subtle film grain.",
    palette: {
      bg: "#FDFBF7",
      surface: "#FFFFFF",
      border: "#ECE6DA",
      text: "#1C1A17",
      muted: "#7A736A",
      accent: "#6B7A5E",
      accent2: "#8A7B5C",
    },
    font: "serif",
    radius: 14,
  },
  {
    id: "soft-structuralism",
    name: "柔构主义",
    sourceSkill: "high-end-visual-design",
    description: "银灰 / 纯白，巨号无衬线 + 极柔弥散阴影，呼吸感强。",
    prompt:
      "Soft structuralism visual style: silver-gray (#F4F5F7) and pure white surfaces, oversized sans-serif, extremely soft diffuse shadows, strong sense of breathing room.",
    palette: {
      bg: "#F4F5F7",
      surface: "#FFFFFF",
      border: "#E5E7EB",
      text: "#111418",
      muted: "#6B7280",
      accent: "#2563EB",
      accent2: "#7C3AED",
    },
    font: "grotesk",
    radius: 16,
  },
  // —— 以下 2 个由 taste-skill（brutalist-skill）收编 ——
  {
    id: "swiss-industrial",
    name: "瑞士工业印刷",
    sourceSkill: "taste-skill-brutalist",
    description: "纸感浅底 + 碳墨 + 航空红，全直角机械排版，蓝图/瑞士印刷风。",
    prompt:
      "Swiss industrial print style: unbleached paper background (#F4F4F0), carbon ink (#111111), aviation hazard red (#E61919) as the ONLY accent, zero border-radius, rigid grid, huge uppercase grotesk headlines with tight tracking, monospace metadata.",
    palette: {
      bg: "#F4F4F0",
      surface: "#FFFFFF",
      border: "#D8D6D0",
      text: "#111111",
      muted: "#6B6B66",
      accent: "#E61919",
      accent2: "#111111",
    },
    font: "grotesk",
    radius: 0,
  },
  {
    id: "tactical-telemetry",
    name: "战术遥测终端",
    sourceSkill: "taste-skill-brutalist",
    description: "CRT 暗底 + 白磷文字 + 航空红 + 终端绿，等宽高密度遥测风。",
    prompt:
      "Tactical telemetry style: deactivated CRT background (#0A0A0A), white phosphor text (#EAEAEA), aviation red (#E61919) accent, optional terminal green (#4AF626) for a single readout, monospace everywhere, zero radius, high data density with scanline texture.",
    palette: {
      bg: "#0A0A0A",
      surface: "#121212",
      border: "#262626",
      text: "#EAEAEA",
      muted: "#8A8A8A",
      accent: "#E61919",
      accent2: "#4AF626",
    },
    font: "mono",
    radius: 0,
    previewBg:
      "radial-gradient(50% 50% at 30% 20%, rgba(74,246,38,0.08), transparent), radial-gradient(50% 50% at 80% 80%, rgba(230,25,25,0.10), transparent), #0A0A0A",
  },
  // —— 以下 6 个由 design-presets 配色延展为完整风格 ——
  {
    id: "tech-blue",
    name: "科技蓝",
    sourceSkill: "design-presets",
    description: "冷调蓝 + 青绿点缀，干净专业，科技/SaaS 通用。",
    prompt:
      "Tech blue visual style: cool blue (#2563EB) primary with cyan (#06B6D4) accent, clean professional surfaces, ideal for SaaS and tech products.",
    palette: {
      bg: "#F8FAFC",
      surface: "#FFFFFF",
      border: "#E2E8F0",
      text: "#0F172A",
      muted: "#64748B",
      accent: "#2563EB",
      accent2: "#06B6D4",
    },
    font: "sans",
    radius: 8,
  },
  {
    id: "nature-green",
    name: "自然绿",
    sourceSkill: "design-presets",
    description: "生机绿 + 柠檬绿，清新健康，环保/生活类偏好。",
    prompt:
      "Nature green visual style: vibrant green (#059669) primary with lime (#84CC16) accent, fresh and healthy, suited for eco and lifestyle products.",
    palette: {
      bg: "#F6FDF9",
      surface: "#FFFFFF",
      border: "#DCFCE7",
      text: "#0B2E1A",
      muted: "#4D7C5F",
      accent: "#059669",
      accent2: "#84CC16",
    },
    font: "sans",
    radius: 10,
  },
  {
    id: "night-purple",
    name: "暗夜紫",
    sourceSkill: "design-presets",
    description: "紫罗兰 + 粉红光晕，潮流创意，年轻化产品。",
    prompt:
      "Night purple visual style: violet (#7C3AED) primary with pink (#EC4899) accent glow, trendy and creative, for youthful products.",
    palette: {
      bg: "#0E0A14",
      surface: "#1A1320",
      border: "#2E2440",
      text: "#F3EEFA",
      muted: "#A48FBF",
      accent: "#7C3AED",
      accent2: "#EC4899",
    },
    font: "grotesk",
    radius: 12,
  },
  {
    id: "warm-orange",
    name: "暖橙",
    sourceSkill: "design-presets",
    description: "暖橙 + 琥珀，热情活力，电商/营销场景。",
    prompt:
      "Warm orange visual style: warm orange (#EA580C) primary with amber (#F59E0B) accent, energetic and inviting, for ecommerce and marketing.",
    palette: {
      bg: "#FFFCF7",
      surface: "#FFFFFF",
      border: "#FED7AA",
      text: "#2A1A0E",
      muted: "#9A6A3C",
      accent: "#EA580C",
      accent2: "#F59E0B",
    },
    font: "sans",
    radius: 10,
  },
  {
    id: "china-red",
    name: "中国红",
    sourceSkill: "design-presets",
    description: "正红 + 橙金，热烈喜庆，本土/节庆品牌。",
    prompt:
      "China red visual style: true red (#DC2626) primary with orange-gold (#F97316) accent, festive and bold, for local and celebratory brands.",
    palette: {
      bg: "#FDF7F6",
      surface: "#FFFFFF",
      border: "#FECACA",
      text: "#2A0E0C",
      muted: "#9B4540",
      accent: "#DC2626",
      accent2: "#F97316",
    },
    font: "serif",
    radius: 8,
  },
  {
    id: "slate-gray",
    name: "高级灰",
    sourceSkill: "design-presets",
    description: "中性石板灰 + 靛蓝点缀，冷静理性，企业/B 端。",
    prompt:
      "Slate gray visual style: neutral slate (#475569) primary with indigo (#6366F1) accent, calm and rational, for enterprise and B2B products.",
    palette: {
      bg: "#F8F9FB",
      surface: "#FFFFFF",
      border: "#E5E7EB",
      text: "#111418",
      muted: "#6B7280",
      accent: "#475569",
      accent2: "#6366F1",
    },
    font: "sans",
    radius: 8,
  },

  // —— 以下为真实 UI / 设计系统库的代表风格（libraryId 关联 data/visual-library.ts）——
  {
    id: "daisyui-cyberpunk",
    name: "DaisyUI · Cyberpunk",
    sourceSkill: "daisyui",
    libraryId: "daisyui",
    description: "霓虹青 + 粉，暗色高对比，终端 / 赛博质感。",
    prompt:
      "DaisyUI cyberpunk theme: neon cyan (#00F0FF) and hot pink (#FF3EA5) on near-black canvas, high-contrast, terminal/cyberpunk vibe, monospace accents.",
    palette: {
      bg: "#0B0C10",
      surface: "#12141C",
      border: "#2A2E3D",
      text: "#E6F7FF",
      muted: "#7FA6C9",
      accent: "#00F0FF",
      accent2: "#FF3EA5",
    },
    font: "mono",
    radius: 8,
    previewBg:
      "radial-gradient(50% 50% at 20% 10%, rgba(0,240,255,0.18), transparent), radial-gradient(50% 50% at 90% 90%, rgba(255,62,165,0.18), transparent), #0B0C10",
  },
  {
    id: "daisyui-emerald",
    name: "DaisyUI · Emerald",
    sourceSkill: "daisyui",
    libraryId: "daisyui",
    description: "生机绿 + 深绿底，清新自然，暗色护眼。",
    prompt:
      "DaisyUI emerald theme: vibrant green (#2DE38A) primary on deep green (#065F46) canvas, fresh and natural, dark eco vibe.",
    palette: {
      bg: "#052E1B",
      surface: "#0B3D26",
      border: "#14532D",
      text: "#DCFCE7",
      muted: "#6EE7B7",
      accent: "#2DE38A",
      accent2: "#A3E635",
    },
    font: "sans",
    radius: 12,
  },
  {
    id: "daisyui-luxury",
    name: "DaisyUI · Luxury",
    sourceSkill: "daisyui",
    libraryId: "daisyui",
    description: "香槟金 + 墨黑，奢华克制，精品品牌调。",
    prompt:
      "DaisyUI luxury theme: champagne gold (#D4AF37) on ink-black canvas, restrained and premium, boutique brand feel, serif headings.",
    palette: {
      bg: "#0C0B09",
      surface: "#16140F",
      border: "#2C2618",
      text: "#F5ECD8",
      muted: "#A8956B",
      accent: "#D4AF37",
      accent2: "#C9A227",
    },
    font: "serif",
    radius: 6,
  },
  {
    id: "shadcn-newyork",
    name: "shadcn/ui · New York",
    sourceSkill: "shadcn-ui",
    libraryId: "shadcn-ui",
    description: "中性锌灰阶，极淡边框 + 克制阴影，现代 SaaS 默认。",
    prompt:
      "shadcn/ui New York style: neutral zinc grayscale (#FAFAFA bg, #18181B foreground), hairline borders, restrained shadows, modern SaaS default, sans-serif.",
    palette: {
      bg: "#FAFAFA",
      surface: "#FFFFFF",
      border: "#E4E4E7",
      text: "#18181B",
      muted: "#71717A",
      accent: "#18181B",
      accent2: "#71717A",
    },
    font: "sans",
    radius: 8,
  },
  {
    id: "mui-material",
    name: "Material UI",
    sourceSkill: "material-ui",
    libraryId: "material-ui",
    description: "Google Material 蓝 + 警示红，圆角小、阴影立体，企业成熟。",
    prompt:
      "Material UI (MUI) style: Google Material blue (#1976D2) primary with red (#D32F2F) accent, small radius, elevation shadows, mature enterprise feel.",
    palette: {
      bg: "#F5F6FA",
      surface: "#FFFFFF",
      border: "#E0E3E7",
      text: "#1A1A1A",
      muted: "#5F6368",
      accent: "#1976D2",
      accent2: "#D32F2F",
    },
    font: "sans",
    radius: 4,
  },
  {
    id: "antd-pro",
    name: "Ant Design",
    sourceSkill: "antd",
    libraryId: "antd",
    description: "企业蓝 (#1677ff) + 中性灰，密度高、规整，中后台首选。",
    prompt:
      "Ant Design style: enterprise blue (#1677FF) primary with neutral gray, high density, grid-aligned, the default for admin/back-office dashboards.",
    palette: {
      bg: "#F5F5F5",
      surface: "#FFFFFF",
      border: "#D9D9D9",
      text: "#1F1F1F",
      muted: "#8C8C8C",
      accent: "#1677FF",
      accent2: "#52C41A",
    },
    font: "sans",
    radius: 6,
  },
  {
    id: "aceternity-glass",
    name: "Aceternity · Glass",
    sourceSkill: "aceternity-ui",
    libraryId: "aceternity-ui",
    description: "暗底 + 紫粉霓虹渐变，毛玻璃面板，炫酷作品集。",
    prompt:
      "Aceternity UI glass style: dark canvas with purple (#8B5CF6) to pink (#EC4899) neon gradients, frosted glass panels, flashy portfolio aesthetic.",
    palette: {
      bg: "#0A0A0F",
      surface: "rgba(255,255,255,0.06)",
      border: "rgba(255,255,255,0.12)",
      text: "#FFFFFF",
      muted: "#A1A1C2",
      accent: "#8B5CF6",
      accent2: "#EC4899",
    },
    font: "grotesk",
    radius: 16,
    blur: true,
    previewBg:
      "radial-gradient(55% 55% at 25% 15%, rgba(139,92,246,0.28), transparent), radial-gradient(50% 50% at 85% 85%, rgba(236,72,153,0.22), transparent), #0A0A0F",
  },
  {
    id: "magic-glow",
    name: "Magic UI · Glow",
    sourceSkill: "magic-ui",
    libraryId: "magic-ui",
    description: "暗紫光晕 + 青边，渐变炫光，AI 产品 landing 风。",
    prompt:
      "Magic UI glow style: dark violet (#7C3AED) aura with cyan (#22D3EE) edges, gradient glow effects, AI-product landing-page aesthetic.",
    palette: {
      bg: "#0B0710",
      surface: "rgba(124,58,237,0.10)",
      border: "rgba(124,58,237,0.30)",
      text: "#F5F3FF",
      muted: "#B9A7E0",
      accent: "#7C3AED",
      accent2: "#22D3EE",
    },
    font: "grotesk",
    radius: 14,
    blur: true,
    previewBg:
      "radial-gradient(50% 50% at 30% 20%, rgba(124,58,237,0.30), transparent), radial-gradient(50% 50% at 80% 80%, rgba(34,211,238,0.18), transparent), #0B0710",
  },
  {
    id: "heroui-modern",
    name: "HeroUI · Modern",
    sourceSkill: "heroui",
    libraryId: "heroui",
    description: "蓝青双调 + 纯白，干净通透，现代 Web 应用。",
    prompt:
      "HeroUI modern style: cyan (#06B6D4) and blue (#3B82F6) dual accents on pure white, clean and airy, modern web app look.",
    palette: {
      bg: "#FFFFFF",
      surface: "#F8FAFC",
      border: "#E2E8F0",
      text: "#0F172A",
      muted: "#64748B",
      accent: "#06B6D4",
      accent2: "#3B82F6",
    },
    font: "sans",
    radius: 12,
  },
  {
    id: "flowbite-clean",
    name: "Flowbite · Clean",
    sourceSkill: "flowbite",
    libraryId: "flowbite",
    description: "蓝 (#1A56DB) 主调 + 灰，文档型 / 后台型规整。",
    prompt:
      "Flowbite clean style: blue (#1A56DB) primary with neutral gray, documentation/admin-oriented, tidy and conventional.",
    palette: {
      bg: "#F9FAFB",
      surface: "#FFFFFF",
      border: "#E5E7EB",
      text: "#111827",
      muted: "#6B7280",
      accent: "#1A56DB",
      accent2: "#1C64F2",
    },
    font: "sans",
    radius: 8,
  },
  {
    id: "radix-gray",
    name: "Radix · Gray",
    sourceSkill: "radix-themes",
    libraryId: "radix-themes",
    description: "灰阶 token 设计系统，理性克制，无框架绑架。",
    prompt:
      "Radix Themes gray style: systematic grayscale tokens (#E4E4E7 / #18181B), rational and restrained, framework-agnostic design system.",
    palette: {
      bg: "#FFFFFF",
      surface: "#F4F4F5",
      border: "#E4E4E7",
      text: "#18181B",
      muted: "#71717A",
      accent: "#18181B",
      accent2: "#A1A1AA",
    },
    font: "sans",
    radius: 6,
  },
  {
    id: "tailwind-official",
    name: "Tailwind UI",
    sourceSkill: "tailwind-ui",
    libraryId: "tailwind-ui",
    description: "中性 + indigo 点缀，极简商务，结构清晰。",
    prompt:
      "Tailwind UI style: neutral surfaces with indigo (#6366F1) accent, minimal business look, clean and well-structured.",
    palette: {
      bg: "#FFFFFF",
      surface: "#F8FAFC",
      border: "#E2E8F0",
      text: "#0F172A",
      muted: "#64748B",
      accent: "#6366F1",
      accent2: "#4F46E5",
    },
    font: "sans",
    radius: 8,
  },
  {
    id: "fluent-enterprise",
    name: "Fluent 2",
    sourceSkill: "fluent-2",
    libraryId: "fluent-2",
    description: "Microsoft 蓝 (#0078D4) + Segoe，企业跨平台一致。",
    prompt:
      "Microsoft Fluent 2 style: enterprise blue (#0078D4) with Segoe typography, cross-platform consistent, corporate and familiar.",
    palette: {
      bg: "#FAF9F8",
      surface: "#FFFFFF",
      border: "#E1DFDD",
      text: "#242424",
      muted: "#616161",
      accent: "#0078D4",
      accent2: "#2B88D8",
    },
    font: "sans",
    radius: 8,
  },
  {
    id: "carbon-industrial",
    name: "IBM Carbon",
    sourceSkill: "carbon",
    libraryId: "carbon",
    description: "工业蓝 (#0F62FE) + 密集网格，数据密集型首选。",
    prompt:
      "IBM Carbon style: industrial blue (#0F62FE) on dense neutral grid (#F4F4F4), data-dense enterprise applications, precise and utilitarian.",
    palette: {
      bg: "#F4F4F4",
      surface: "#FFFFFF",
      border: "#E0E0E0",
      text: "#161616",
      muted: "#6F6F6F",
      accent: "#0F62FE",
      accent2: "#6929C4",
    },
    font: "sans",
    radius: 4,
  },
  {
    id: "apple-hig",
    name: "Apple HIG",
    sourceSkill: "apple-hig",
    libraryId: "apple-hig",
    description: "银白 + 系统蓝 (#007AFF)，大圆角 SF，精致克制。",
    prompt:
      "Apple HIG style: silver-white surfaces with system blue (#007AFF), large radii, SF typography, refined and restrained.",
    palette: {
      bg: "#F5F5F7",
      surface: "#FFFFFF",
      border: "#D2D2D7",
      text: "#1D1D1F",
      muted: "#6E6E73",
      accent: "#007AFF",
      accent2: "#FF3B30",
    },
    font: "sans",
    radius: 12,
  },
  {
    id: "geist-minimal",
    name: "Vercel Geist",
    sourceSkill: "vercel-geist",
    libraryId: "vercel-geist",
    description: "纯黑白 + 灰阶，极简开发者审美标杆。",
    prompt:
      "Vercel Geist style: pure black/white with grayscale, minimal developer aesthetic, high contrast and no decoration.",
    palette: {
      bg: "#FFFFFF",
      surface: "#FAFAFA",
      border: "#EAEAEA",
      text: "#000000",
      muted: "#666666",
      accent: "#000000",
      accent2: "#888888",
    },
    font: "sans",
    radius: 6,
  },
  {
    id: "material-3",
    name: "Material Design 3",
    sourceSkill: "material-3",
    libraryId: "material-3",
    description: "动态紫 (#6750A4) + 柔粉，大圆角，温暖有机。",
    prompt:
      "Material Design 3 style: dynamic purple (#6750A4) seed with soft pink (#B5838D), large radii, warm and organic, MD3 tokens.",
    palette: {
      bg: "#FFFBFE",
      surface: "#FEF7FF",
      border: "#E7E0EC",
      text: "#1D1B20",
      muted: "#49454F",
      accent: "#6750A4",
      accent2: "#B5838D",
    },
    font: "sans",
    radius: 16,
  },
  {
    id: "primer-dev",
    name: "GitHub Primer",
    sourceSkill: "github-primer",
    libraryId: "github-primer",
    description: "灰 + 工程绿 (#2DA44E)，系统字体，社区工程风。",
    prompt:
      "GitHub Primer style: neutral gray with engineering green (#2DA44E), system font stack, developer-community aesthetic.",
    palette: {
      bg: "#F6F8FA",
      surface: "#FFFFFF",
      border: "#D0D7DE",
      text: "#1F2328",
      muted: "#656D76",
      accent: "#2DA44E",
      accent2: "#0969DA",
    },
    font: "sans",
    radius: 6,
  },
  // ═══ agent-workstudio 主题预设（source: agent-workstudio/src/styles/presets）═══
  // 6 套完整 shadcn 预设，oklch 转 hex 提取，可用右上角「主题预设」切换器全局应用
  {
    id: "aw-brutalist",
    name: "Brutalist 粗野",
    sourceSkill: "agent-workstudio",
    description: "0 圆角 + 纯黑描边 + 红(#FF3333)/蓝撞色，硬阴影，高对比粗野风。",
    prompt:
      "Brutalist theme preset: white canvas, pure black borders, red (#FF3333) primary with blue (#0066FF) secondary accent, zero corner radius, hard offset shadows, maximum contrast.",
    palette: {
      bg: "#FFFFFF",
      surface: "#FFFFFF",
      border: "#000000",
      text: "#000000",
      muted: "#333333",
      accent: "#FF3333",
      accent2: "#0066FF",
    },
    font: "sans",
    radius: 0,
  },
  {
    id: "aw-soft-pop",
    name: "Soft Pop 柔和流行",
    sourceSkill: "agent-workstudio",
    description: "浅绿底 + 黑描边 + 靛蓝(#4F46E5)/琥珀强调，16px 大圆角，活泼糖果感。",
    prompt:
      "Soft Pop theme preset: light green-tinted canvas (#F7F9F3), white cards with black outlines, indigo (#4F46E5) primary with amber (#F59E0B) accent, generous 16px radii, playful candy-pop feel.",
    palette: {
      bg: "#F7F9F3",
      surface: "#FFFFFF",
      border: "#000000",
      text: "#000000",
      muted: "#333333",
      accent: "#4F46E5",
      accent2: "#F59E0B",
    },
    font: "sans",
    radius: 16,
  },
  {
    id: "aw-tangerine",
    name: "Tangerine 柑橘",
    sourceSkill: "agent-workstudio",
    description: "中性灰画布 + 橙红(#DF5E3A)主色 + 灰蓝辅色，暖调务实。",
    prompt:
      "Tangerine theme preset: neutral warm-gray canvas (#EBEBEB), white surfaces, orange-red (#DF5E3A) primary with slate-blue (#88A8C9) secondary, soft borders, warm pragmatic SaaS feel.",
    palette: {
      bg: "#EBEBEB",
      surface: "#FFFFFF",
      border: "#D9DFE4",
      text: "#333333",
      muted: "#6C727E",
      accent: "#DF5E3A",
      accent2: "#88A8C9",
    },
    font: "sans",
    radius: 10,
  },
  {
    id: "aw-claude",
    name: "Claude 编辑",
    sourceSkill: "agent-workstudio",
    description: "暖米色(#FAF9F5)画布 + 橙棕(#C96442)主色，克制阴影，欧美编辑风。",
    prompt:
      "Claude theme preset: warm ivory canvas (#FAF9F5), terracotta (#C96442) primary with deep red-brown (#B05730) secondary, restrained shadows, editorial minimalism.",
    palette: {
      bg: "#FAF9F5",
      surface: "#FAF9F5",
      border: "#DAD9D4",
      text: "#3D3929",
      muted: "#83827D",
      accent: "#C96442",
      accent2: "#B05730",
    },
    font: "sans",
    radius: 8,
  },
  {
    id: "aw-amethyst-haze",
    name: "Amethyst Haze 紫雾",
    sourceSkill: "agent-workstudio",
    description: "浅紫画布 + 紫罗兰(#8A79AB)主色 + 柔粉辅色，朦胧优雅。",
    prompt:
      "Amethyst Haze theme preset: pale lavender canvas (#F8F7FA), violet (#8A79AB) primary with soft pink (#E6A5B8) secondary, muted mauve borders, dreamy elegant atmosphere.",
    palette: {
      bg: "#F8F7FA",
      surface: "#FFFFFF",
      border: "#CEC9D9",
      text: "#3D3C4F",
      muted: "#6B6880",
      accent: "#8A79AB",
      accent2: "#E6A5B8",
    },
    font: "sans",
    radius: 8,
  },
  {
    id: "aw-t3-chat",
    name: "T3 Chat 玫粉",
    sourceSkill: "agent-workstudio",
    description: "粉紫画布 + 玫紫(#A84370)主色 + 亮粉(#D926A2)辅色，对话界面感。",
    prompt:
      "T3 Chat theme preset: pink-lavender canvas (#FAF5FA), mauve (#A84370) primary with vivid pink (#D926A2) secondary, rosy borders, chat-interface warmth.",
    palette: {
      bg: "#FAF5FA",
      surface: "#FAF5FA",
      border: "#EFBDEB",
      text: "#501854",
      muted: "#834588",
      accent: "#A84370",
      accent2: "#D926A2",
    },
    font: "sans",
    radius: 8,
  },
];

export const VISUAL_STYLE_MAP: Record<string, VisualStyle> = Object.fromEntries(
  VISUAL_STYLES.map((s) => [s.id, s]),
);

// —— 可复制代码：由单个风格推导设计 Token ——
export function styleToCss(style: VisualStyle): string {
  const p = style.palette;
  return `:root {
  --background: ${p.bg};
  --surface: ${p.surface};
  --border: ${p.border};
  --foreground: ${p.text};
  --muted-foreground: ${p.muted};
  --primary: ${p.accent};
  --primary-foreground: #ffffff;
  --secondary: ${p.accent2};
  --radius: ${style.radius}px;
  --font-sans: ${FONT_STACK[style.font]};
}`;
}

export function styleToTailwind(style: VisualStyle): string {
  const p = style.palette;
  return `import type { Config } from "tailwindcss";

export default {
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: "var(--surface)",
        foreground: "var(--foreground)",
        border: "var(--border)",
        primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-foreground)" },
        secondary: { DEFAULT: "var(--secondary)" },
      },
      fontFamily: {
        sans: [${FONT_STACK[style.font].split(",").map((f) => `"${f.trim()}"`).join(", ")}],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
} satisfies Config;`;
}

// ════════════════════════════════════════════════════════════════
// P1：组件规范层 —— 由视觉风格推导核心组件的真实样式定义
// 让「选了 Geist 就用上 Geist 那套规范」成为可能：即使只存了 token，
// 也能派生出 Button/Input/Card/Modal 的完整 CSS 规范供开发使用。
// ════════════════════════════════════════════════════════════════

export interface StyleSpec {
  button: string;
  input: string;
  card: string;
  modal: string;
  usage: string;
}

export function buildStyleSpec(style: VisualStyle): StyleSpec {
  const p = style.palette;
  const r = style.radius;
  return {
    button: `.btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  background: ${p.accent}; color: #fff;
  border: none; border-radius: ${r}px;
  font-family: inherit; font-size: 0.875rem; font-weight: 500; line-height: 1;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}
.btn:hover { opacity: 0.9; }
.btn:active { transform: scale(0.98); }
.btn:focus-visible { outline: 2px solid ${p.accent}; outline-offset: 2px; }
.btn--outline { background: transparent; color: ${p.accent}; border: 1px solid ${p.accent}; }
.btn--ghost { background: transparent; color: ${p.accent}; border: none; }
.btn--sm { padding: 0.375rem 0.75rem; font-size: 0.8125rem; }
.btn--lg { padding: 0.625rem 1.25rem; font-size: 1rem; }`,
    input: `.input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: ${p.surface}; color: ${p.text};
  border: 1px solid ${p.border}; border-radius: ${r}px;
  font-family: inherit; font-size: 0.875rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.input::placeholder { color: ${p.muted}; }
.input:focus { outline: none; border-color: ${p.accent}; box-shadow: 0 0 0 3px ${p.accent}22; }
.input--error { border-color: #dc2626; }`,
    card: `.card {
  padding: 1.25rem;
  background: ${p.surface}; color: ${p.text};
  border: 1px solid ${p.border}; border-radius: ${r}px;
}
.card__title { font-size: 1rem; font-weight: 600; color: ${p.text}; }
.card__body { margin-top: 0.5rem; font-size: 0.875rem; color: ${p.muted}; }
.card--hover { transition: transform 0.2s ease, box-shadow 0.2s ease; }
.card--hover:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.10); }`,
    modal: `.modal {
  position: fixed; inset: 0; z-index: 50;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.4);
}
.modal__panel {
  width: min(480px, 90vw);
  padding: 1.5rem;
  background: ${p.bg}; color: ${p.text};
  border: 1px solid ${p.border}; border-radius: ${r}px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.16);
}
.modal__title { font-size: 1.125rem; font-weight: 600; }
.modal__close { position: absolute; top: 1rem; right: 1rem; color: ${p.muted}; background: none; border: none; cursor: pointer; }`,
    usage: `/* 依赖设计 token（globals.css :root）：
   --background / --surface / --border / --foreground /
   --muted-foreground / --primary / --secondary / --radius / --font-sans
   组件规范由视觉风格「${style.name}」推导（palette + ${style.radius}px 圆角 + ${FONT_STACK[style.font]}）。 */`,
  };
}

// ════════════════════════════════════════════════════════════════
// P2：视觉库 ↔ UI 组件库 id 双向映射
// VISUAL_STYLES[].libraryId（视觉库域） ⇄ UI_LIBRARIES[].id（Step 5 库域）
// ════════════════════════════════════════════════════════════════

export const VISUAL_LIB_TO_UI_LIB: Record<string, string> = {
  "shadcn-ui": "shadcn",
  daisyui: "daisyui",
  "material-ui": "mui",
  antd: "antd",
  "aceternity-ui": "aceternity",
  "magic-ui": "magic_ui",
  heroui: "heroui",
  flowbite: "flowbite",
  "radix-themes": "radix",
  "tailwind-ui": "catalyst",
  "fluent-2": "fluent",
  "material-3": "mui",
};

export const UI_LIB_TO_VISUAL_LIB: Record<string, string> = Object.fromEntries(
  Object.entries(VISUAL_LIB_TO_UI_LIB).map(([v, u]) => [u, v]),
);
