"use client";

// Genius 整站模板预览：通过 iframe 嵌入真实线上站点（Framer 平台），
// 完整还原 HTML/CSS/JS 视觉与交互（本地静态导出把 JS 绑死在 Framer CDN，
// 在非官方 origin 下会降级，故预览直链线上真实站点最还原）。
const GENIUS_LIVE = "https://genius.framer.wiki";

export function GeniusSite({
  slug = "index",
  liveUrl,
}: {
  slug?: string;
  liveUrl?: string;
}) {
  const src = liveUrl ?? `${GENIUS_LIVE}/${slug === "index" ? "" : slug}`;
  return (
    <div className="relative h-[760px] w-full overflow-hidden rounded-[var(--radius)] border border-border bg-white">
      <iframe
        src={src}
        title={`Genius · ${slug}`}
        className="h-full w-full"
        style={{ border: 0, background: "#fff" }}
      />
    </div>
  );
}

export default GeniusSite;
