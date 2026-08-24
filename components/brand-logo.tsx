"use client";

import Link from "next/link";

/**
 * 品牌 Logo：XIYE 产品孵化器
 * 左侧为「组装 / 孵化」主题的 X 双笔画字形徽标（取品牌首字母 XI 的组合），
 * 右上角一颗高亮点象征"孵化出的种子 / 灵光"；右侧为加宽字重的 XIYE 字标 + 副标。
 */
export function BrandLogo() {
  return (
    <Link
      href="/"
      className="group inline-flex shrink-0 items-center gap-2.5 focus-visible:outline-none"
      aria-label="XIYE 产品孵化器"
    >
      <span className="relative inline-flex size-6 shrink-0 select-none items-center justify-center">
        <svg viewBox="0 0 24 24" className="size-full" fill="none" aria-hidden>
          <rect x="1.2" y="1.2" width="21.6" height="21.6" rx="7" fill="var(--primary)" />
          {/* 两道圆头笔画组成 X，象征「从一行字组装成产品」 */}
          <path d="M9.3 5.9 14.7 18.1" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" />
          <path d="M14.7 5.9 9.3 18.1" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" />
          {/* 孵化高光：右上角的种子/星点 */}
          <circle cx="17.1" cy="5" r="1.45" fill="#fff" opacity="0.9" />
        </svg>
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="text-[17px] font-bold uppercase tracking-[0.16em] text-foreground">
          XIYE
        </span>
        <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
          产品孵化器
        </span>
      </span>
    </Link>
  );
}