"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { captureSnapshot } from "@/lib/project-snapshot";

export function BuilderSaveButton() {
  const router = useRouter();
  const [naming, setNaming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function startSave() {
    setMsg(null);
    const r = await fetch("/api/auth/me");
    if (!r.ok) {
      router.push("/login");
      return;
    }
    setNaming("未命名项目");
  }

  async function doSave() {
    if (!naming || !naming.trim()) return;
    setBusy(true);
    try {
      const snap = captureSnapshot();
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: naming.trim(), data: snap }),
      });
      if (res.ok) {
        setMsg("已保存");
        setNaming(null);
      } else {
        setMsg("保存失败");
      }
    } catch {
      setMsg("保存失败");
    }
    setBusy(false);
  }

  if (naming === null) {
    return (
      <Button variant="outline" size="sm" onClick={startSave} title="保存当前搭建到账号">
        <Save className="size-3.5" /> 保存项目
      </Button>
    );
  }

  return (
    <span className="flex items-center gap-1">
      {msg && <span className="text-[11px] text-muted-foreground">{msg}</span>}
      <input
        autoFocus
        value={naming}
        onChange={(e) => setNaming(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") doSave();
          if (e.key === "Escape") setNaming(null);
        }}
        className="w-32 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none"
        placeholder="项目名称"
      />
      <Button variant="secondary" size="sm" onClick={doSave} disabled={busy}>
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setNaming(null)}>
        取消
      </Button>
    </span>
  );
}
