import type { ReactNode } from "react";

const TONE_CLASS = {
  neutral: "border-zinc-200 bg-muted/40 text-muted-foreground",
  problem: "border-rose-200 bg-rose-50 text-rose-800",
  violet: "border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300",
  amber: "border-warning/30 bg-warning/10 text-warning",
  red: "border-danger/30 bg-danger/10 text-danger",
  emerald: "border-success/30 bg-success/10 text-success",
  sky: "border-info/30 bg-info/10 text-info",
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
