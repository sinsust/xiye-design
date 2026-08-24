// Delivered by Originkit · stack: nextjs · styling: tailwind
"use client";

import { useEffect, useState } from "react";

/** Public asset under /sections/hero-19/assets */
function asset(file: string) {
  return `/originkit/hero-19/${file}`;
}

/**
 * Trusted-by logo strip — Figma "Frame 2147239649" (2280:5672 / 2280:5924).
 *
 * The strip scrolls continuously: the track holds two copies of the artwork and
 * translates by exactly -50%, so the second copy lands where the first started
 * and the loop has no visible reset. Edges fade with a mask rather than the
 * ellipse clip Figma bakes into the export.
 *
 * Native artwork is 1139 x 74.09; mobile and iPad show it at 0.838x (62.075
 * tall), matching their frames.
 *
 * The Figma-derived decimal-precision sizes are applied via inline style (not
 * Tailwind arbitrary-value classes like `h-[62.075px]`): they are consumed by a
 * `desktop-sm:` variant and Turbopack's dev-mode CSS pipeline garbles these
 * specific selector tokens. Inline styles keep the pixel-exact layout and keep
 * the class out of the CSS generator entirely.
 */

const EDGE_MASK =
  "linear-gradient(to right, transparent 0, #000 10%, #000 90%, transparent 100%)";

// Mirrors --breakpoint-desktop-sm (1280px) in the global theme.
const DESKTOP_SM = 1280;

function useDesktopSm() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_SM}px)`);
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return desktop;
}

export const LogoMarquee = () => {
  const desktop = useDesktopSm();
  const viewportH = desktop ? 74.09 : 62.075;
  const viewportW = desktop ? 683 : 572.243;
  const artW = desktop ? 1139 : 954.297;

  return (
    <div
      className="relative overflow-hidden"
      style={{
        height: `${viewportH}px`,
        width: `${viewportW}px`,
        maskImage: EDGE_MASK,
        WebkitMaskImage: EDGE_MASK,
      }}
    >
      <div className="flex w-max animate-logo-marquee items-center will-change-transform">
        {[0, 1].map((copy) => (
          <img
            key={copy}
            src={asset("logo-strip-marquee.svg")}
            alt=""
            aria-hidden={copy === 1}
            className="block max-w-none shrink-0 opacity-70"
            style={{ height: `${viewportH}px`, width: `${artW}px` }}
          />
        ))}
      </div>
    </div>
  );
};