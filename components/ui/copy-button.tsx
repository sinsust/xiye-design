"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

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
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 剪贴板不可用时静默失败 */
    }
  };

  const base =
    "inline-flex items-center gap-1 rounded-md border border-border/70 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary";
  const iconSize = size === "xs" ? "size-3" : "size-3.5";

  return (
    <button type="button" onClick={onCopy} title={title} className={className ?? base}>
      {copied ? <Check className={iconSize + " text-emerald-500"} /> : <Copy className={iconSize} />}
      {!iconOnly && <span>{copied ? (copiedLabel ?? "已复制") : (label ?? "复制")}</span>}
    </button>
  );
}
