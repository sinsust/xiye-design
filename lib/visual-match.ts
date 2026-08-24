// 视觉风格匹配：根据对话产出的设计系统文本（brief.extra.visualSpec），
// 匹配知识库 VISUAL_STYLES 里相近的预设风格，供 refine「视觉专家」高亮推荐
// 「AI 对话推荐」，让对话聊出的风格偏好可以一键落进 DESIGN_SPEC。

import { VISUAL_STYLES } from "@/data/visual-styles";

function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 两色欧氏距离（0~441），越小越接近 */
function colorDist(a: string, b: string): number {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return 999;
  return Math.sqrt(
    (ra[0] - rb[0]) ** 2 + (ra[1] - rb[1]) ** 2 + (ra[2] - rb[2]) ** 2,
  );
}

/** 从设计系统文本提取 #hex 色值 */
function extractColors(text: string): string[] {
  return [...new Set((text.match(/#[0-9a-fA-F]{3,8}/g) ?? []).slice(0, 8))];
}

const PRIMARY_LABELS = ["primary", "主色", "强调色", "accent", "主按钮", "primary color"];

/**
 * 从设计系统文本提取「主色」hex，用于一键套用对话配色。
 * 优先：`Primary #2563EB` / `主色 #xxx` / `Primary Color #xxx` 关键词所在片段里的第一个 hex；
 * 兜底：文本里第一个 #hex（ui-ux-pro-max 输出的设计系统里 Primary 一般排最前）。
 * 返回归一化小写 hex（如 #2563eb），无则 null。
 */
export function extractPrimaryColor(text: string | undefined | null): string | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  const all = extractColors(t);
  if (!all.length) return null;
  const lower = t.toLowerCase();
  for (const label of PRIMARY_LABELS) {
    const idx = lower.indexOf(label.toLowerCase());
    if (idx === -1) continue;
    const seg = t.slice(idx, idx + 80); // 关键词后 80 字符内找 hex（Primary #2563EB · Background …）
    const hit = seg.match(/#[0-9a-fA-F]{3,8}/);
    if (hit) return hit[0].toLowerCase();
  }
  // 兜底：排除背景/文本色噪点，取第一个 hex
  return all[0].toLowerCase();
}

/** 与风格 name/description 做关键词包含匹配的通用词表 */
const STYLE_KEYWORDS = [
  "科技", "极简", "毛玻璃", "玻璃", "深色", "暗黑", "霓虹", "编辑",
  "豪华", "高端", "工业", "瑞士", "渐变", "温暖", "冷色", "清新",
  "杂志", "刊物", "运营", "终端", "赛博", "未来", "柔和", "大胆",
  "衬线", "无衬线", "奢华", "奢侈", "沉稳", "昂贵", "喜庆", "中国红", "暖橙",
  "琥珀", "金色", "深红", "明亮", "硬朗", "醒目", "古典", "优雅", "中国风",
];

/**
 * 根据设计系统文本匹配相近的预设视觉风格，返回风格 id（按相关度降序）。
 * 无文本 / 无命中返回空数组。
 */
export function matchVisualStyles(
  visualSpecText: string | undefined,
  limit = 2,
): string[] {
  const text = (visualSpecText ?? "").trim();
  if (!text) return [];
  const colors = extractColors(text);
  const lower = text.toLowerCase();

  const scored = VISUAL_STYLES.map((s) => {
    let score = 0;
    const hay = `${s.name} ${s.description} ${s.sourceSkill}`.toLowerCase();
    // 颜色接近：visualSpec 里的 hex 与风格主强调色接近加分
    for (const c of colors) {
      const d = colorDist(c, s.palette.accent);
      if (d < 70) score += 4;
      else if (d < 120) score += 2;
      if (colorDist(c, s.palette.text) < 120) score += 1;
    }
    // 风格词：设计文本与风格名/描述都出现该词
    for (const kw of STYLE_KEYWORDS) {
      if (lower.includes(kw) && hay.includes(kw)) score += 2;
    }
    return { id: s.id, score };
  })
    .filter((x) => x.score >= 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((x) => x.id);
}
