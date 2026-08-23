export interface ColorScheme {
  id: string;
  name: string;
  primary: string; // 主色 hex
  primaryLight: string; // 主色浅
  accent: string; // 强调色 hex
  preview: string; // 用于预览的渐变色
}

export const COLOR_SCHEMES: ColorScheme[] = [
  { id: "tech_blue", name: "科技蓝", primary: "#2563EB", primaryLight: "#DBEAFE", accent: "#06B6D4", preview: "from-blue-500 to-cyan-400" },
  { id: "nature_green", name: "自然绿", primary: "#059669", primaryLight: "#D1FAE5", accent: "#84CC16", preview: "from-emerald-500 to-lime-400" },
  { id: "night_purple", name: "暗夜紫", primary: "#7C3AED", primaryLight: "#EDE9FE", accent: "#EC4899", preview: "from-violet-500 to-pink-400" },
  { id: "warm_orange", name: "暖橙", primary: "#EA580C", primaryLight: "#FFF7ED", accent: "#F59E0B", preview: "from-orange-500 to-amber-400" },
  { id: "china_red", name: "中国红", primary: "#DC2626", primaryLight: "#FEF2F2", accent: "#F97316", preview: "from-red-500 to-orange-400" },
  { id: "slate", name: "高级灰", primary: "#475569", primaryLight: "#F1F5F9", accent: "#6366F1", preview: "from-slate-500 to-indigo-400" },
];

export const RADIUS_OPTIONS = [
  { id: "none", label: "直角", value: "0px" },
  { id: "sm", label: "小圆", value: "4px" },
  { id: "md", label: "中圆", value: "8px" },
  { id: "lg", label: "大圆", value: "12px" },
  { id: "xl", label: "超大圆", value: "16px" },
  { id: "full", label: "全圆", value: "9999px" },
];

export const FONT_OPTIONS = [
  { id: "system", label: "系统默认", value: "system-ui, sans-serif" },
  { id: "inter", label: "Inter", value: "'Inter', system-ui, sans-serif" },
  { id: "geist", label: "Geist", value: "'Geist', system-ui, sans-serif" },
  { id: "manrope", label: "Manrope", value: "'Manrope', system-ui, sans-serif" },
  { id: "space_grotesk", label: "Space Grotesk", value: "'Space Grotesk', system-ui, sans-serif" },
  { id: "noto_sans", label: "Noto Sans SC", value: "'Noto Sans SC', system-ui, sans-serif" },
  { id: "source_han", label: "思源黑体", value: "'Source Han Sans SC', 'Noto Sans SC', system-ui, sans-serif" },
  { id: "playfair", label: "Playfair Display", value: "'Playfair Display', Georgia, serif" },
];

export const DENSITY_OPTIONS = [
  { id: "ultra_compact", label: "极紧凑", desc: "间距极小，极致信息密度，适合专业数据后台" },
  { id: "compact", label: "紧凑", desc: "间距小，信息密度高，适合数据密集型应用" },
  { id: "standard", label: "标准", desc: "平衡间距，适合大多数场景" },
  { id: "spacious", label: "宽松", desc: "间距大，留白多，适合展示型/品牌型网站" },
  { id: "relaxed", label: "松弛", desc: "更大留白与呼吸感，适合高端品牌与阅读型内容" },
];

export const DARK_MODE_OPTIONS = [
  { id: "light_only", label: "仅亮色" },
  { id: "both", label: "亮色 + 暗色" },
  { id: "dark_only", label: "仅暗色" },
];
