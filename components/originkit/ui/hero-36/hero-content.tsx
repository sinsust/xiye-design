// Delivered by Originkit · stack: nextjs · styling: tailwind
"use client";

import { Button } from "@/components/originkit/ui/hero-36/button";
import { ChevronRight } from "@/components/originkit/ui/hero-36/icons";

function asset(file: string) {
  return `/originkit/hero-36/${file}`;
}

/**
 * Badge plate (Figma 499:1955). Two nested pills — a 2px #e0e6eb ring around a
 * white chip — plus Figma's five-stop soft drop, which starts fully transparent
 * at 135px and tightens to 5px. Transcribed rather than collapsed to one
 * shadow: the ramp is what stops the chip reading as a hard sticker.
 */
const BADGE_SHADOW =
  "0px 1px 1px 0px rgba(0,0,0,0.15), 0px 135px 38px 0px rgba(160,166,171,0), 0px 86px 35px 0px rgba(160,166,171,0.01), 0px 49px 29px 0px rgba(160,166,171,0.05), 0px 22px 22px 0px rgba(160,166,171,0.09), 0px 5px 12px 0px rgba(160,166,171,0.1)";

/**
 * The copy column — Figma 499:1953 (desktop), 499:1497 (tablet), 499:1919
 * (phone).
 *
 * One column with breakpoint classes rather than three subtrees: the phone and
 * tablet centre it and the desktop left-aligns it, which is `items-*` and
 * `text-*` and nothing else. Only the type re-pitches — 42px headline and 14px
 * body on the phone, 62/17 from the tablet up — and the tablet reuses the
 * desktop's sizes exactly, so there is no `ipad:` step for the desktop values.
 *
 * Both line breaks are Figma's, held with `<br />`: the headline breaks after
 * "fast" and the sub after "technology" at all three frames, and the column is
 * narrow enough at 387px that letting it rewrap would move them.
 *
 * The CTA row wraps, which Figma never needs to. At 402 the two buttons come to
 * 338px inside a 342px column — four pixels of room — so anything narrower than
 * Figma's own phone frame overflows. Wrapping is the only thing here that is
 * not in the design, and it changes nothing at 402 and above.
 */
export const HeroContent = () => (
  <div className="relative z-20 flex w-full flex-col items-center gap-[16px] text-center desktop-sm:w-[387px] desktop-sm:shrink-0 desktop-sm:items-start desktop-sm:text-left">
    <div className="flex w-full flex-col items-center gap-[12px] desktop-sm:items-start">
      <div className="inline-flex items-center rounded-[100px] bg-[#e0e6eb] p-[2px]">
        <div
          className="inline-flex items-center gap-[7px] rounded-[100px] bg-white px-[8px] py-[4px]"
          style={{ boxShadow: BADGE_SHADOW }}
        >
          <img
            src={asset("flame.svg")}
            alt=""
            aria-hidden
            className="block size-[18px] max-w-none"
          />
          <span className="font-tight text-[14px] leading-[1.5] font-medium tracking-[-0.14px] whitespace-nowrap text-[#1f1f1f]">
            Issue Cards in Minutes
          </span>
        </div>
      </div>

      <h1 className="w-full font-instrument-serif text-[42px] leading-[1.1] tracking-[-0.42px] text-black ipad:text-[62px] ipad:tracking-[-0.62px]">
        Insanely fast
        <br />
        card issuing
      </h1>
    </div>

    <p className="font-tight text-[14px] leading-[25.5px] tracking-[-0.28px] text-[#121212] opacity-80 ipad:text-[17px] ipad:tracking-[-0.34px]">
      Issuing processing for technology
      <br />
      companies that jst works
    </p>

    <div className="flex flex-wrap items-center justify-center gap-[16px] desktop-sm:flex-nowrap desktop-sm:justify-start">
      <Button variant="primary">
        Contact Sale
        <ChevronRight />
      </Button>
      <Button variant="secondary">
        Explore Now
        <ChevronRight />
      </Button>
    </div>
  </div>
);
