// Delivered by Originkit · stack: nextjs · styling: tailwind
"use client";

"use client";

import type { KeyboardEvent } from "react";

import { Button } from "@/components/originkit/ui/hero-36/button";
import { ChevronRight } from "@/components/originkit/ui/hero-36/icons";

function asset(file: string) {
  return `/originkit/hero-36/${file}`;
}

const blockNav = (event: { preventDefault: () => void }) => {
  event.preventDefault();
};

const NAV_LINKS = ["Platform", "Solutions", "Developers", "Pricing"] as const;

const LINK_CLASS =
  "inline-flex min-h-11 cursor-pointer items-center font-tight text-[17px] leading-[25.5px] tracking-[-0.34px] whitespace-nowrap text-black transition-[opacity,transform] duration-200 ease-out [-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#121212] [@media(hover:hover)_and_(pointer:fine)]:hover:opacity-60";

const handleKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
  if (event.key !== " ") return;
  event.preventDefault();
  event.currentTarget.click();
};

/**
 * Primary nav — Figma 499:1906 (desktop), 499:1479 (tablet), 499:1901 (phone).
 * Phone and tablet carry logo + hamburger; desktop swaps the hamburger for the
 * four links and the "Get Started" pill.
 *
 * The band is opaque and sits above the rails on purpose: Figma runs both
 * measuring rails from y0 and then covers their first 92px with the nav's own
 * fill at every frame, so the rails appear to start under the nav's hairline.
 * Painting the band rather than shortening the rails keeps that true at any
 * height.
 *
 * Figma insets the desktop row to 74.5px, which is 1.5px inside the rail —
 * that is the rail's own width plus its 1px border plus rounding, not a
 * separate margin, so it is transcribed as-is. The tablet's 48px genuinely
 * does overhang its 52px rail by 4px and is transcribed too.
 */
export const Navbar = () => (
  <nav
    aria-label="Primary"
    className="relative z-30 flex h-[58px] w-full shrink-0 items-center justify-between border-b border-solid border-[#dcdcda] bg-[#f5f5f2] px-[32px] ipad:h-[72px] ipad:px-[48px] desktop-sm:h-[92px] desktop-sm:px-[74.5px]"
  >
    <a
      href="#"
      aria-label="Paymint home"
      onClick={blockNav}
      className="flex cursor-pointer items-center gap-[8px] transition-[opacity,transform] duration-200 ease-out [-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#121212] [@media(hover:hover)_and_(pointer:fine)]:hover:opacity-70"
    >
      <img
        src={asset("logo-mark.svg")}
        alt=""
        aria-hidden
        className="block size-[17px] max-w-none"
      />
      <span className="font-sans text-[20px] leading-[25.5px] font-semibold tracking-[-0.4px] whitespace-nowrap text-[#121212]">
        Paymint
      </span>
    </a>

    <div className="hidden items-center gap-[52px] desktop-sm:flex">
      <ul className="flex items-center gap-[24px]">
        {NAV_LINKS.map((label) => (
          <li key={label}>
            <a
              href="#"
              onClick={blockNav}
              onKeyDown={handleKeyDown}
              className={LINK_CLASS}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>

      <Button variant="nav">
        Get Started
        <ChevronRight />
      </Button>
    </div>

    {/*
      Figma's hamburger is a bare 24px glyph. The touch target is grown to the
      44px floor and pulled back by the 10px it gains on the right, so the
      glyph itself still lands on Figma's margin.
    */}
    <button
      type="button"
      aria-label="Open menu"
      className="-mr-[10px] inline-flex min-h-11 min-w-11 cursor-pointer touch-manipulation items-center justify-center transition-[opacity,transform] duration-200 ease-out [-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#121212] active:scale-[0.97] motion-reduce:active:scale-100 desktop-sm:hidden [@media(hover:hover)_and_(pointer:fine)]:hover:opacity-70"
    >
      <img
        src={asset("menu.svg")}
        alt=""
        aria-hidden
        className="block size-[24px] max-w-none"
      />
    </button>
  </nav>
);
