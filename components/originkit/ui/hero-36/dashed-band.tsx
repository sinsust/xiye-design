// Delivered by Originkit · stack: nextjs · styling: tailwind
"use client";

/**
 * The two dashed cell bands — Figma `Frame 2147241485` above the fold copy and
 * `Frame 2147241486` below it (desktop 499:1905, tablet 499:1474, mobile
 * 499:1896), plus the blurred marks scattered through them.
 *
 * Figma builds each band as ~24 absolutely-positioned cells that each draw a
 * right and a bottom edge. That is a grid, and a grid is two gradients:
 * `RULES_X` paints a 1px column rule at the trailing edge of every cell and
 * `RULES_Y` a 1px row rule, both driven by one `--cell` / `--row` pair. It
 * matters that they are two elements rather than two layers on one, because
 * the dash is a mask and a mask applies to the whole element — the column
 * rules have to be dashed down the page and the row rules across it.
 *
 * The dash is the reason the exported tile could not just be scaled. Figma's
 * `4 3` stroke is the same 4-on/3-off at every frame — the same pitch the edge
 * rails tick on — while the cell re-pitches from 12 columns to 6 to 4. A tile
 * stretched by `background-size` takes the dash with it and the phone ends up
 * with a 3.1/2.3 dash it was never drawn with, so the pitch and the dash are
 * separated here: `--cell` is a percentage, so the band always divides into
 * whole columns at any width, and the dash stays in px.
 *
 * `--cell` in percent is also what lets the band bleed. Figma measures it at
 * 1296 / 640 / 338 — the width between the rails at each frame — which is a
 * viewport width, not a design width, so the band runs rail to rail and the
 * columns divide whatever is there.
 */

/** 12 / 6 / 4 columns between the rails; rows are Figma's 56px, 46 on phones. */
const CELLS =
  "[--cell:25%] [--row:46px] ipad:[--cell:16.6667%] ipad:[--row:56px] desktop-sm:[--cell:8.3333%]";

/** Column rules, on the trailing edge of each cell, dashed down the page. */
const RULES_X =
  "repeating-linear-gradient(to right, transparent 0, transparent calc(var(--cell) - 1px), #dcdcda calc(var(--cell) - 1px), #dcdcda var(--cell))";
const DASH_Y =
  "repeating-linear-gradient(to bottom, #000 0, #000 4px, transparent 4px, transparent 7px)";
const DASH_X =
  "repeating-linear-gradient(to right, #000 0, #000 4px, transparent 4px, transparent 7px)";

/**
 * Row rules. The upper band hangs off the solid header hairline, so its rows
 * close on their trailing edge; the lower band has no line above it and opens
 * with one instead. Same gradient, one stop swapped — which is also exactly
 * how Figma states it (`border-top: 1px dashed` on the lower band only).
 */
const RULES_Y_TRAILING =
  "repeating-linear-gradient(to bottom, transparent 0, transparent calc(var(--row) - 1px), #dcdcda calc(var(--row) - 1px), #dcdcda var(--row))";
const RULES_Y_LEADING =
  "repeating-linear-gradient(to bottom, #dcdcda 0, #dcdcda 1px, transparent 1px, transparent var(--row))";

/**
 * The scattered marks (Figma `Ellipse 2` family, e.g. 499:1943). Figma ships
 * them as a 446px PNG mask over a blurred black rect, and the mask turns out
 * to be one staircase polyline repeating on a 24.8px tile at 15% alpha — 9 kB
 * of PNG for six numbers. It is rebuilt here as that tile: right one step,
 * down one step, forever, which is what makes the marks read as a drafting
 * hatch rather than a smudge.
 *
 * The blur stays in front of the mask rather than behind it. CSS filters run
 * before masking, so this is a solid black rect softened at its edges and then
 * cut to the staircase — crisp faint lines that fade out towards the edge of
 * the patch, which is what Figma renders. Blurring the lines themselves would
 * erase them at 15% alpha.
 */
const STAIR_MASK =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24.8' height='24.8'%3E%3Cpath d='M24.8 0H12.4V12.4H0V24.8' fill='none' stroke='%23000' stroke-opacity='.149'/%3E%3C/svg%3E\")";

/**
 * Six marks per band, placed on the grid rather than at Figma's pixels: every
 * other column, alternating rows — a checkerboard, which is what all three
 * frames draw once their coordinates are divided by their own cell size. The
 * upper band starts on the odd columns and the lower band on the even ones, so
 * the two bands never line a mark up over another.
 *
 * A frame only has as many marks as it has column pairs, so the last four are
 * gated: two on the phone's four columns, three on the tablet's six, all six
 * on the desktop's twelve.
 */
const MARKS = Array.from({ length: 6 }, (_, index) => ({
  index,
  /* The only `display` on the mark, so nothing has to out-order anything. */
  reveal:
    index < 2
      ? "block"
      : index < 3
        ? "hidden ipad:block"
        : "hidden desktop-sm:block",
}));

const MARK_SIZE =
  "h-[24px] w-[64px] ipad:h-[30px] ipad:w-[91px] desktop-sm:h-[39px] desktop-sm:w-[98px]";

type DashedBandProps = {
  /** `top` closes each row and hangs off the header hairline; `bottom` opens with a rule. */
  edge: "top" | "bottom";
  className?: string;
};

export const DashedBand = ({ edge, className = "" }: DashedBandProps) => {
  const isTop = edge === "top";

  return (
    <div
      aria-hidden
      className={`pointer-events-none relative z-0 shrink-0 ${CELLS} ${className}`}
    >
      <span
        className="absolute inset-0 block"
        style={{
          backgroundImage: RULES_X,
          maskImage: DASH_Y,
          WebkitMaskImage: DASH_Y,
        }}
      />
      <span
        className="absolute inset-0 block"
        style={{
          backgroundImage: isTop ? RULES_Y_TRAILING : RULES_Y_LEADING,
          maskImage: DASH_X,
          WebkitMaskImage: DASH_X,
        }}
      />

      {MARKS.map(({ index, reveal }) => {
        /* Upper band: odd columns from row 2. Lower band: even columns from row 1. */
        const column = isTop ? 2 * index + 1 : 2 * index;
        const row = isTop ? (index % 2 === 0 ? 2 : 1) : index % 2 === 0 ? 1 : 2;

        return (
          <span
            key={index}
            className={`absolute -translate-x-1/2 -translate-y-1/2 bg-black ${MARK_SIZE} ${reveal}`}
            style={{
              left: `calc(var(--cell) * ${column + 0.5})`,
              top: `calc(var(--row) * ${row - 0.5})`,
              filter: "blur(10px)",
              maskImage: STAIR_MASK,
              WebkitMaskImage: STAIR_MASK,
              maskSize: "24.8px 24.8px",
              WebkitMaskSize: "24.8px 24.8px",
            }}
          />
        );
      })}
    </div>
  );
};
