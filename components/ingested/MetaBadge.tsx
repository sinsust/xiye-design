import type { ReactNode } from "react";

const TONE_CLASS = {
  neutral: "border-zinc-200 bg-zinc-50 text-zinc-700",
  problem: "border-rose-200 bg-rose-50 text-rose-800",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  red: "border-red-200 bg-red-50 text-red-800",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
  sky: "border-sky-200 bg-sky-50 text-sky-800",
} as const;

export function MetaBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof TONE_CLASS;
}) {
  return (
    <span
      className={`inline-flex h-5 max-w-full items-center rounded border px-1.5 text-[10px] font-medium leading-none ${TONE_CLASS[tone]}`}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}
