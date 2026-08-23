// Delivered by Originkit · stack: nextjs · styling: tailwind
"use client";

/**
 * The two measuring rails that frame the page — Figma `Frame 2147241487` /
 * `Frame 2147241488` (desktop 499:1905, tablet 499:1478, mobile 499:1900).
 *
 * Figma draws them as a stack of 1px rects on a 7px pitch, which is a
 * `repeating-linear-gradient` and nothing else. The rails run the full height
 * of the section rather than Figma's 930px: that number is the frame height
 * plus slack so the rail always overshoots, and `inset-y-0` says the same
 * thing without a magic number that stops being true on a tall screen.
 *
 * Figma also puts a #d9d9d9 cap across the top of each rail, and then paints
 * the opaque nav band over it — it is behind the nav at all three frames and
 * never renders. The nav's own bottom hairline is the line you can actually
 * see there, so the cap is dropped rather than reproduced under an opaque
 * layer.
 */
const TICKS =
  "repeating-linear-gradient(to bottom, rgba(0,0,0,0.1) 0, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 7px)";

/** Rail width per frame — also the inset the dashed grid and nav align to. */
const RAIL = "w-[32px] ipad:w-[52px] desktop-sm:w-[72px]";

export const EdgeRulers = () => (
  <div
    aria-hidden
    className="pointer-events-none absolute inset-0 z-0 max-w-[1920px] w-full mx-auto"
  >
    <span
      className={`absolute inset-y-0 left-0 block border-r border-solid border-[rgba(0,0,0,0.1)] ${RAIL}`}
      style={{ backgroundImage: TICKS }}
    />
    <span
      className={`absolute inset-y-0 right-0 block border-l border-solid border-[rgba(0,0,0,0.1)] ${RAIL}`}
      style={{ backgroundImage: TICKS }}
    />
  </div>
);
