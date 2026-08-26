"use client";

import { useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface QuickCaptureProps {
  busy: boolean;
  onOrganize: (content: string) => void;
}

export function QuickCapture({ busy, onOrganize }: QuickCaptureProps) {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const content = value.trim();
    if (!content || busy) return;
    onOrganize(content);
    setValue("");
    if (taRef.current) taRef.current.style.height = "auto";
  };

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Sparkles className="size-4 text-primary" />
        又想到了什么
      </h2>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
        rows={2}
        placeholder="粘贴会议纪要、代码片段或灵感，交给 AI 整理…（Ctrl/⌘ + Enter 提交）"
        className="mt-3 w-full resize-none rounded-lg border border-muted bg-muted/20 px-3 py-2 text-[13px] text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">只会生成「待确认计划」，你确认后才写入。</span>
        <Button size="sm" onClick={submit} disabled={busy || !value.trim()}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          整理
        </Button>
      </div>
    </div>
  );
}