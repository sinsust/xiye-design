"use client";

"use client";

"use client";

import { useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from "motion/react";
import {
  CircleDollarSign,
  LayoutGrid,
  Settings,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import ArrowBadge from "@/components/originkit/ui/hero-14/arrow-badge";

const A = "/originkit/hero-14";
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const NAV_LINKS = ["Services", "Features", "About", "Pricing", "Works"] as const;
const ACTIVE_INDEX = 0;

const MENU = [
  { label: "Services", Icon: Settings },
  { label: "Features", Icon: Sparkles },
  { label: "About", Icon: Users },
  { label: "Pricing", Icon: CircleDollarSign },
  { label: "Works", Icon: LayoutGrid },
  { label: "Contact", Icon: Zap },
] as const;

function ContactButton({
  full = false,
  reduce,
}: {
  full?: boolean;
  reduce: boolean | null;
}) {
  return (
    <motion.button
      type="button"
      whileHover={reduce ? undefined : { scale: 1.03 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      className={`group flex cursor-pointer appearance-none items-center gap-[12px] rounded-[100px] border-0 bg-yellow60 py-[8px] pl-[16px] pr-[8px] ${
        full ? "w-full justify-between" : "justify-center"
      }`}
    >
      <span className="whitespace-nowrap text-[18px] font-semibold leading-[1.5] text-dark02">
        Contact Us
      </span>
      <ArrowBadge />
    </motion.button>
  );
}

export default function Navbar() {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);

  const barTransition: Transition = { duration: reduce ? 0 : 0.2, ease: EASE };

  return (
    <motion.nav
      initial={reduce ? false : { opacity: 0, y: -18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE }}

      className="absolute inset-x-0 top-0 z-30 mx-auto flex w-full items-center gap-x-4 px-4 py-[20px] md:max-w-[450px] md:px-6 md:py-[24px] lg:max-w-[890px] xl:max-w-[1280px] 2xl:py-[31px]"
    >
      {}
      <div className="flex flex-1 items-center justify-start gap-[10px]">
        <img
          src={`${A}/logo-mark.svg`}
          alt="LandFree"
          className="h-[32px] w-auto shrink-0 md:h-[38px]"
        />
        <img
          src={`${A}/wordmark.svg`}
          alt="LandFree"
          className="h-[17px] w-auto shrink-0 md:h-[19px]"
        />
      </div>

      {}
      <div className="hidden shrink-0 items-center justify-center rounded-[63px] bg-dark06 p-[10px] outline outline-1 outline-offset-[-2px] outline-white/15 backdrop-blur-[2px] xl:flex">
        {NAV_LINKS.map((link, i) => (
          <button
            key={link}
            type="button"
            aria-current={i === ACTIVE_INDEX ? "page" : undefined}

            className="relative flex cursor-pointer appearance-none items-center rounded-[27px] border-0 bg-transparent px-[24px] py-[14px]"
          >
            <span
              className={`whitespace-nowrap text-center text-[16px] font-medium leading-[1.5] transition-colors duration-200 xl:text-[18px] ${
                i === ACTIVE_INDEX
                  ? "text-yellow60"
                  : "text-grey80 hover:text-white"
              }`}
            >
              {link}
            </span>
          </button>
        ))}
      </div>

      {}
      <div className="flex flex-1 items-center justify-end">
        <div className="hidden shrink-0 xl:block">
          <ContactButton reduce={reduce} />
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex size-[52px] shrink-0 cursor-pointer appearance-none items-center justify-center rounded-[12px] bg-dark06 outline outline-2 outline-offset-[-2px] outline-dark12 xl:hidden"
        >
          <motion.img
            src={`${A}/hamburg.svg`}
            alt=""
            aria-hidden
            animate={open ? { rotate: 90 } : { rotate: 0 }}
            transition={barTransition}
            className="h-[24px] w-[24px]"
          />
        </button>
      </div>

      {}
      <div className="pointer-events-none absolute inset-x-0 top-0">
        <AnimatePresence>
          {open && (
            <>
              {}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setOpen(false)}
                className="pointer-events-auto fixed inset-0 z-20 xl:hidden"
              />
              {}
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.22, ease: EASE }}
                className="pointer-events-auto absolute right-4 top-[80px] flex w-[256px] flex-col gap-[2px] rounded-[20px] bg-dark06/95 p-[10px] outline outline-2 outline-offset-[-2px] outline-white/15 backdrop-blur-[12px] md:right-10 xl:hidden"
              >
                {MENU.map(({ label, Icon }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex cursor-pointer appearance-none items-center gap-[14px] rounded-[12px] border-0 bg-transparent px-[14px] py-[12px] text-left text-grey80 transition-colors hover:bg-dark10 hover:text-white"
                  >
                    <Icon
                      size={22}
                      strokeWidth={2}
                      className="shrink-0"
                      aria-hidden
                    />
                    <span className="text-[16px] font-medium leading-[1.5]">
                      {label}
                    </span>
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  );
}