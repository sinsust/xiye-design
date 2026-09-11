"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "@/components/ui/toast";

/** 剪贴板 API 不可用（http 页面 / 无权限）时的降级：隐藏 textarea + execCommand */
async function copyWithFallback(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* 走降级 */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** 通用复制按钮：复制传入文本，带 1.5s 成功反馈；自动阻止冒泡以免触发卡片展开 */
export function CopyButton({
  text,
  label,
  copiedLabel,
  className,
  size = "sm",
  iconOnly = false,
  title = "复制内容",
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  size?: "sm" | "xs";
  iconOnly?: boolean;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyWithFallback(text);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } else {
      toast.error("复制失败：浏览器未授权剪贴板访问");
    }
  };

  const base =
    "inline-flex items-center gap-1 rounded-md border border-border/70 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary";
  const iconSize = size === "xs" ? "size-3" : "size-3.5";

  return (
    <button type="button" onClick={onCopy} title={title} className={className ?? base}>
      {copied ? <Check className={iconSize + " text-success"} /> : <Copy className={iconSize} />}
      {!iconOnly && <span>{copied ? (copiedLabel ?? "已复制") : (label ?? "复制")}</span>}
    </button>
  );
}
