import { FileUp, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface InputTabProps {
  text: string;
  setText: (value: string) => void;
  organize: () => Promise<void>;
  organizing: boolean;
  placeholders: string[];
  placeholderIndex: number;
  setBatchOpen: (value: boolean) => void;
  setRaw: (value: string) => void;
}

export function InputTab({
  text,
  setText,
  organize,
  organizing,
  placeholders,
  placeholderIndex,
  setBatchOpen,
  setRaw,
}: InputTabProps) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-end">
        <span className="text-xs text-muted-foreground">⌘ / Ctrl + Enter 立即整理</span>
      </div>
      <textarea
        value={text}
        onChange={(ev) => {
          setText(ev.target.value);
          ev.target.style.height = "auto";
          ev.target.style.height = `min(${Math.max(ev.target.scrollHeight, 120)}px, 300px)`;
        }}
        onKeyDown={(ev) => {
          if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") organize();
        }}
        placeholder={placeholders[placeholderIndex]}
        className="mt-2 max-h-[300px] min-h-[120px] w-full resize-y rounded-[var(--radius)] border border-muted bg-card px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_12%,transparent)]"
      />
      <div className="mt-3 flex items-center gap-2 rounded-[var(--radius)] border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <FileUp className="size-3.5 shrink-0" />
        支持拖入 PDF / Word / 音频文件，自动转成可整理文本
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setBatchOpen(true)}>
          <FileUp className="size-3.5" />
          批量导入
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setText(""); setRaw(""); }}
          disabled={!text.trim()}
        >
          清空
        </Button>
        <Button
          size="sm"
          onClick={() => organize()}
          disabled={!text.trim() || organizing}
          className="bg-gradient-to-r from-primary to-primary/80 shadow-md shadow-primary/25"
        >
          {organizing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {organizing ? "整理中…" : "帮我整理"}
        </Button>
      </div>
    </div>
  );
}