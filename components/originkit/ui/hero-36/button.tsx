// Delivered by Originkit · stack: nextjs · styling: tailwind
"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "nav";

/**
 * Shared pressable / focus stack — house Button contract. The outline is
 * #121212 because every surface these land on is the paper #f5f5f2.
 *
 * All three variants are the same 22px chevron beside a Lato 700 label with
 * Figma's -0.03em tracking, so that lives here rather than in the variants.
 * `h-[52px]` is Figma's own on "Explore Now"; the other two reach it from
 * 14px padding around the 22px icon and are stated rather than computed so a
 * label change cannot make one button a pixel taller than its neighbour.
 */
const BASE_CLASS =
  "relative inline-flex h-[52px] min-h-11 cursor-pointer touch-manipulation items-center justify-center whitespace-nowrap font-lato font-bold tracking-[-0.03em] transition-[opacity,transform] duration-200 ease-out [-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#121212] active:scale-[0.97] motion-reduce:active:scale-100 [@media(hover:hover)_and_(pointer:fine)]:hover:opacity-90";

/**
 * "Contact Sale" (Figma 499:1961). Figma stacks a white top-fade over a flat
 * #292929 — two gradients rather than one because the fade stops at 43.9% and
 * the fill has to keep going. The 1px white top border plus the inset white
 * highlight are the bevel; the five-stop drop is Figma's soft-shadow ramp,
 * transcribed rather than approximated because the first stop is fully
 * transparent and doing it with one shadow loses the falloff.
 */
const PRIMARY_FILL =
  "linear-gradient(180deg, rgba(255,255,255,0.2) 4.0988%, rgba(255,255,255,0) 43.902%), linear-gradient(90deg, #292929 0%, #292929 100%)";

const PRIMARY_SHADOW =
  "inset 0px 1px 1px 0px rgba(255,255,255,0.3), 0px 63px 18px 0px rgba(16,16,16,0), 0px 40px 16px 0px rgba(11,11,11,0.01), 0px 23px 14px 0px rgba(8,8,8,0.05), 0px 10px 10px 0px rgba(5,5,5,0.09), 0px 3px 6px 0px rgba(0,0,0,0.1)";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    "gap-[8px] rounded-[12px] border-t border-solid border-[rgba(255,255,255,0.15)] pt-[14px] pr-[14px] pb-[14px] pl-[24px] text-[16px] text-white [text-shadow:0px_1px_1px_rgba(0,0,0,0.15),0px_3px_3px_rgba(0,0,0,0.05)]",
  secondary:
    "gap-[10px] rounded-[10px] border border-solid border-[rgba(0,0,0,0.1)] bg-[rgba(0,0,0,0.02)] pt-[14px] pr-[14px] pb-[14px] pl-[24px] text-[16px] text-[#121212]",
  /* Same pill as `secondary`, at the nav's tighter 20/12 padding and 14px type. */
  nav: "gap-[10px] rounded-[10px] border border-solid border-[rgba(0,0,0,0.1)] bg-[rgba(0,0,0,0.02)] pt-[14px] pr-[12px] pb-[14px] pl-[20px] text-[14px] text-[#121212]",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

export const Button = ({
  variant = "primary",
  children,
  className = "",
  type = "button",
  ...props
}: ButtonProps) => (
  <button
    type={type}
    className={`${BASE_CLASS} ${VARIANT_CLASS[variant]} ${className}`}
    style={
      variant === "primary"
        ? { backgroundImage: PRIMARY_FILL, boxShadow: PRIMARY_SHADOW }
        : undefined
    }
    {...props}
  >
    {children}
  </button>
);
