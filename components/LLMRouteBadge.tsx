"use client";

/**
 * LLM 线路徽标：显性告知当前使用的模型线路（线路1 = Qwen / 线路2 = DeepSeek）。
 * - 实际线路：最近一次 LLM 调用成功后由调用方写入 localStorage（xiye-llm-route）。
 * - 手动强制：auto / qwen / deepseek（xiye-llm-force），analyze 等请求带 forceRoute 生效。
 * - 点击徽标弹出三态开关，选择即持久化并广播事件，供各面板即时刷新。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Check, ChevronDown, Zap } from "lucide-react";

export const LLM_ROUTE_KEY = "xiye-llm-route"; // 最近一次实际线路
export const LLM_FORCE_KEY = "xiye-llm-force"; // 手动强制：auto|qwen|deepseek
export const LLM_ROUTE_CHANGED = "xiye:llm-route-changed";

export type LLMRouteValue = "qwen" | "deepseek";

export function readLLMRoute(): { route: LLMRouteValue | null; force: "auto" | LLMRouteValue } {
  let route: LLMRouteValue | null = null;
  let force: "auto" | LLMRouteValue = "auto";
  try {
    const r = localStorage.getItem(LLM_ROUTE_KEY);
    if (r === "qwen" || r === "deepseek") route = r;
    const f = localStorage.getItem(LLM_FORCE_KEY);
    if (f === "qwen" || f === "deepseek") force = f;
  } catch {
    /* ignore */
  }
  return { route, force };
}

/** 供 analyze 请求读取当前强制线路（undefined = 自动） */
export function readForceRoute(): "qwen" | "deepseek" | undefined {
  const { force } = readLLMRoute();
  return force === "auto" ? undefined : force;
}

/** 记录一次成功调用的实际线路 */
export function writeLLMRoute(route: LLMRouteValue | ""): void {
  if (!route) return;
  try {
    localStorage.setItem(LLM_ROUTE_KEY, route);
    window.dispatchEvent(new Event(LLM_ROUTE_CHANGED));
  } catch {
    /* ignore */
  }
}

const ROUTE_META: Record<string, { label: string; desc: string }> = {
  qwen: { label: "线路1 · Qwen", desc: "本地自建 Qwen3.5" },
  deepseek: { label: "线路2 · DeepSeek", desc: "DeepSeek 云端" },
};

export function LLMRouteBadge({ compact }: { compact?: boolean }) {
  const [route, setRoute] = useState<LLMRouteValue | null>(null);
  const [force, setForce] = useState<"auto" | LLMRouteValue>("auto");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const sync = useCallback(() => {
    const s = readLLMRoute();
    setRoute(s.route);
    setForce(s.force);
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener(LLM_ROUTE_CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(LLM_ROUTE_CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, [sync]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const meta = route ? ROUTE_META[route] : null;
  const label = force !== "auto" ? ROUTE_META[force].label : meta ? meta.label : "线路 · 自动";

  const choose = (v: "auto" | LLMRouteValue) => {
    try {
      localStorage.setItem(LLM_FORCE_KEY, v);
      window.dispatchEvent(new Event(LLM_ROUTE_CHANGED));
    } catch {
      /* ignore */
    }
    setForce(v);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="点击切换模型线路（线路1 Qwen / 线路2 DeepSeek）"
        className={
          "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition active:scale-[0.98] " +
          (force !== "auto"
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border/70 bg-muted/40 text-muted-foreground hover:border-primary/30")
        }
      >
        <Activity className="size-3" />
        <span className={compact ? "" : "font-medium"}>{label}</span>
        {!compact && <ChevronDown className="size-3 opacity-60" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-56 animate-in fade-in duration-150 rounded-xl border border-border bg-popover p-1.5 shadow-lg">
          <div className="px-2 pb-1 pt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            模型线路
          </div>
          {(
            [
              { v: "auto" as const, label: "自动切换", desc: "线路1 不可用时自动用线路2" },
              { v: "qwen" as const, label: ROUTE_META.qwen.label, desc: ROUTE_META.qwen.desc },
              { v: "deepseek" as const, label: ROUTE_META.deepseek.label, desc: ROUTE_META.deepseek.desc },
            ]
          ).map((o) => (
            <button
              key={o.v}
              onClick={() => choose(o.v)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted"
            >
              <span>
                <span className="block text-foreground">{o.label}</span>
                <span className="block text-[10px] text-muted-foreground">{o.desc}</span>
              </span>
              {force === o.v && <Check className="size-3.5 shrink-0 text-primary" />}
            </button>
          ))}
          {route && force === "auto" && (
            <div className="mt-1 flex items-center gap-1 border-t border-border/60 px-2 pt-1.5 text-[10px] text-muted-foreground">
              <Zap className="size-2.5 text-primary" />
              当前实际：{meta?.label}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
