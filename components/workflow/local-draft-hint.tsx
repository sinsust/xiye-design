"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFlowStore } from "@/lib/store/flow-store";

/**
 * 匿名（本地草稿）透明提示——紧凑单行版。
 *
 * 背景（审计 P1）：collab 阶段的自动生成链路全部 `if (!savedProjectId) return`，
 * 未登录用户走完访谈也拿不到蓝图/旅程/规格/原型，且只有 collab 有提示，
 * refine/build/deliver 阶段静默变「薄」。本组件挂在这三个阶段顶部补齐透明提示。
 * collab 阶段保留其自带的大号引导卡（含解锁按钮），此处不重复渲染。
 */
export function LocalDraftHint() {
  const savedProjectId = useFlowStore((s) => s.savedProjectId);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 已保存项目（或登录后绑定了项目）→ 无需提示
  if (savedProjectId) return null;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const store = useFlowStore.getState();
      const snap = store.captureFlowSnapshot();
      const brief = store.productBrief;
      const name =
        brief?.name || store.projectInfo?.projectName || brief?.vision?.slice(0, 40) || "未命名项目";
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, data: snap }),
      });
      if (res.status === 401) {
        router.push("/login?redirect=/workflow");
        return;
      }
      if (!res.ok) {
        setError("保存失败，请稍后重试");
        return;
      }
      const j = await res.json().catch(() => null);
      if (j?.project?.id) store.setSavedProjectId(j.project.id);
    } catch {
      setError("保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs">
      <AlertTriangle className="size-3.5 shrink-0 text-warning" />
      <span className="text-muted-foreground">
        当前为本地草稿——保存项目后才能自动生成并云端留存后续产物。
      </span>
      <Button
        size="sm"
        variant="outline"
        className="ml-auto h-7 gap-1 px-2 text-xs"
        onClick={() => void save()}
        disabled={saving}
      >
        {saving ? <LoaderCircle className="size-3.5 animate-spin" /> : <ArrowRight className="size-3.5" />}
        {saving ? "保存中…" : "保存项目"}
      </Button>
      {error && <span className="text-destructive">{error}</span>}
    </div>
  );
}
