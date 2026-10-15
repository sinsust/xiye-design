"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Cpu } from "lucide-react";

interface CurrentModel {
  configured: boolean;
  id?: string;
  name?: string;
  provider?: string;
  model?: string;
  baseUrl?: string;
  source?: "feature" | "active";
}

/**
 * 流程工作台常驻「当前模型」芯片：展示做产品时实际会调用的模型名称与模型 ID。
 * 点击跳到 AI 模型设置，方便一键切换/配置。
 */
export function ModelChip() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CurrentModel | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ai/models/current", { cache: "no-store" });
        if (!res.ok) return;
        const d = (await res.json()) as CurrentModel;
        if (!cancelled) setData(d);
      } catch {
        /* 展示失败不影响主流程 */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground sm:flex">
        <Cpu className="size-3.5" />
        <span className="opacity-60">模型加载中…</span>
      </span>
    );
  }

  // 未配置：显眼警告，引导去设置（对应「没有调用 api」的根因提示）
  if (!data?.configured) {
    return (
      <Link
        href="/account/models"
        title="尚未配置任何 AI 模型——做产品时不会调用任何 API，点此去设置并「设为当前」"
        className="hidden shrink-0 items-center gap-1.5 rounded-full border border-warning/50 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning transition hover:bg-warning/20 sm:flex"
      >
        <AlertTriangle className="size-3.5" />
        <span>未配置模型</span>
      </Link>
    );
  }

  return (
    <Link
      href="/account/models"
      title={`当前生效模型：${data.name}（${data.provider} · ${data.model}）\n点击可切换或配置`}
      className="hidden shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground sm:flex"
    >
      <Cpu className="size-3.5 text-primary" />
      <span className="font-medium text-foreground">{data.name}</span>
      <span className="opacity-70">·</span>
      <span className="font-mono text-[11px]">{data.model}</span>
    </Link>
  );
}
