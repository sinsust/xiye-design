"use client";

// Wexo 整站模板预览：通过 iframe 嵌入真实线上站点（Framer 平台），
// 完整还原 HTML/CSS/JS 视觉与交互（本地静态导出残缺：无 JS、无子页面，
// 故「全部」预览直链线上真实站点最还原）。
const WEXO_LIVE = "https://wexo.framer.website";

export function WexoSite({
  slug = "index",
  liveUrl,
}: {
  slug?: string;
  liveUrl?: string;
}) {
  const src = liveUrl ?? `${WEXO_LIVE}/${slug === "index" ? "" : slug}`;
  return (
    <div className="relative h-[760px] w-full overflow-hidden rounded-[var(--radius)] border border-border bg-white">
      <iframe
        src={src}
        title={`Wexo · ${slug}`}
        className="h-full w-full"
        style={{ border: 0, background: "#fff" }}
      />
    </div>
  );
}

export default WexoSite;
