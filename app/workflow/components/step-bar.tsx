"use client";

import {
  Check,
  ClipboardCheck,
  LayoutPanelLeft,
  PackageCheck,
  Users2,
  type LucideIcon,
} from "lucide-react";
import { STEP_DEFS, type StepId } from "../steps";

const STEP_ICONS: Record<StepId, LucideIcon> = {
  collab: Users2,
  refine: ClipboardCheck,
  build: LayoutPanelLeft,
  deliver: PackageCheck,
};

interface StepBarProps {
  active: number;
  done: Set<number>;
  onJump: (index: number) => void;
}

export function StepBar({ active, done, onJump }: StepBarProps) {
  return (
    <nav
      aria-label="流程步骤"
      className="flex w-full items-center gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-card px-3 py-1.5 shadow-sm"
    >
      {STEP_DEFS.map((step, i) => {
        const Icon = STEP_ICONS[step.id];
        const isActive = i === active;
        const isDone = done.has(i) && !isActive;
        const reachable = i <= active || done.has(i);
        return (
          <div key={step.id} className="flex min-w-fit flex-1 items-center">
            <button
              type="button"
              onClick={() => reachable && onJump(i)}
              disabled={!reachable}
              className={[
                "group flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-left transition-colors",
                reachable ? "cursor-pointer hover:bg-muted/60" : "cursor-not-allowed opacity-60",
                isActive ? "bg-primary/10" : "",
              ].join(" ")}
              title={step.desc}
            >
              <span
                className={[
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : isDone
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border bg-muted/40 text-muted-foreground",
                ].join(" ")}
              >
                {isDone ? <Check className="size-4" /> : <Icon className="size-4" />}
              </span>
              <span className="hidden flex-col leading-tight sm:flex">
                <span
                  className={[
                    "text-sm font-medium",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {step.label}
                </span>
                <span className="text-[10px] text-muted-foreground/70">
                  步骤 {i + 1}/{STEP_DEFS.length}
                </span>
              </span>
              <span
                className={[
                  "text-sm font-medium sm:hidden",
                  isActive ? "text-foreground" : "text-muted-foreground",
                ].join(" ")}
              >
                {step.short}
              </span>
            </button>
            {i < STEP_DEFS.length - 1 && (
              <span
                className={[
                  "mx-1 h-px flex-1 shrink min-w-4",
                  i < active ? "bg-primary/40" : "bg-border",
                ].join(" ")}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
