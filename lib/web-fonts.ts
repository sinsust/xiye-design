// Google Fonts 按需加载，让预览里切换字体能立即看到真实字型。
// css2 只返回 @font-face 规则、浏览器按需拉取字体文件，因此一次预载全部开销很小。

/** 字体 ID → Google Fonts css2 地址（无 URL 的项保持回退字体，不强制加载） */
const FONT_GOOGLE_CSS: Record<string, string> = {
  inter:
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
  geist: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap",
  manrope:
    "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap",
  space_grotesk:
    "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap",
  noto_sans:
    "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap",
  // Source Han Sans SC 未在 Google Fonts 托管；用同源观感的 Noto Sans SC 兜底供预览显示
  source_han:
    "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap",
  playfair:
    "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&display=swap",
};

let injected: Set<string> | null = null;

/** 预载指定字体（幂等，重复调用不重复插入） */
export function ensureWebFonts(ids: string[]): void {
  if (typeof document === "undefined") return;
  injected ??= new Set();
  for (const id of ids) {
    const url = FONT_GOOGLE_CSS[id];
    if (!url || injected.has(url)) continue;
    injected.add(url);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
  }
}

/** 预载当前选中的单个字体；未匹配到 URL 时静默 */
export function ensureWebFont(id: string | null | undefined): void {
  if (id) ensureWebFonts([id]);
}