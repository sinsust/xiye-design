"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ImageOff, RotateCcw, Save, Upload, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AGENT_PROFILES, type AgentId } from "@/app/workflow/agents";
import { useAgentsStore, useCurrentStyle } from "@/app/workflow/agents-store";
import { AgentAvatar } from "@/app/workflow/components/agent-common";
import { fetchSession } from "@/lib/auth-session";

interface DraftItem {
  role: AgentId;
  name: string;
  avatarUrl: string;
}

const ROLE_TAG: Record<AgentId, string> = {
  moderator: "主持",
  pm: "PRD · 页面清单",
  architect: "技术栈 · 取舍",
  designer: "视觉 · 组件基调",
  guard: "开发规范 · 反漂移",
};

/** 把上传图片压缩为 ≤256px 的 webp data URL（不支持 webp 则回退 png） */
function compressImageToDataUrl(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read_failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode_failed"));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no_ctx"));
        ctx.drawImage(img, 0, 0, w, h);
        const out = canvas.toDataURL("image/webp", 0.85);
        // 部分浏览器 toDataURL('image/webp') 仍返回 png，属正常回退
        resolve(out);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function AgentPersonasPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const booted = useAgentsStore((s) => s.booted);
  const overrides = useAgentsStore((s) => s.overrides);
  const currentStyleId = useAgentsStore((s) => s.currentStyleId);
  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const adoptedRef = useRef(false);
  const style = useCurrentStyle();

  const defaults = useMemo(
    () =>
      Object.fromEntries(AGENT_PROFILES.map((a) => [a.id, a.name])) as Record<
        AgentId,
        string
      >,
    [],
  );

  // 登录校验 + 触发服务端人设拉取（会话读取全局缓存）
  useEffect(() => {
    let alive = true;
    fetchSession()
      .then((u) => {
        if (!alive) return;
        if (u) {
          useAgentsStore.getState().boot();
          setAuthLoading(false);
        } else {
          router.replace("/login");
        }
      })
      .catch(() => {
        if (alive) router.replace("/login");
      });
    return () => {
      alive = false;
    };
  }, [router]);

  // 初始草稿（默认名称 + 已有覆盖头像）
  useEffect(() => {
    if (draft.length) return;
    setDraft(
      AGENT_PROFILES.map((a) => ({
        role: a.id,
        name: overrides[a.id]?.name || defaults[a.id],
        avatarUrl: overrides[a.id]?.avatarUrl || "",
      })),
    );
  }, [overrides, defaults, draft.length]);

  // 服务端权威合并完成后采纳一次（避免本地覆盖被误覆盖）
  useEffect(() => {
    if (!booted || adoptedRef.current || !draft.length) return;
    adoptedRef.current = true;
    setDraft(
      AGENT_PROFILES.map((a) => ({
        role: a.id,
        name: overrides[a.id]?.name || defaults[a.id],
        avatarUrl: overrides[a.id]?.avatarUrl || "",
      })),
    );
  }, [booted, overrides, defaults, draft.length]);

  const patch = (role: AgentId, p: Partial<DraftItem>) =>
    setDraft((ds) => ds.map((d) => (d.role === role ? { ...d, ...p } : d)));

  const restoreDefault = (role: AgentId) => {
    patch(role, { name: defaults[role], avatarUrl: "" });
  };

  async function doSave() {
    setSaving(true);
    setSaved(false);
    const agents = draft.map((d) => ({
      role: d.role,
      name: d.name.trim() || defaults[d.role],
      avatarUrl: d.avatarUrl.trim() ? d.avatarUrl.trim() : null,
    }));
    try {
      const res = await fetch("/api/agents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agents, styleId: currentStyleId }),
      });
      if (res.ok) {
        // 同步到全局 store：全流程立刻生效
        for (const d of agents) {
          useAgentsStore
            .getState()
            .setOverride(d.role as AgentId, {
              name: d.name,
              avatarUrl: d.avatarUrl ?? null,
            });
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2200);
      } else {
        alert("保存失败，请重试。");
      }
    } catch {
      alert("保存失败，请重试。");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-muted-foreground">
        加载中…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/account"
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        ← 返回个人中心
      </Link>

      <div className="mt-3 flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Users className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold text-foreground">{style.framing} · 人设管理</h1>
          <p className="text-xs text-muted-foreground">
            自定义每位专家的名字与头像，全流程即时生效；名字也会影响 AI 会诊时的自称。
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {AGENT_PROFILES.map((a) => {
          const item = draft.find((d) => d.role === a.id);
          const isCustom = !!(
            item && (item.name !== defaults[a.id] || item.avatarUrl.trim())
          );
          return (
            <div
              key={a.id}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-center gap-3">
                <span className="relative shrink-0">
                  <AgentAvatar role={a.id} className="size-14" />
                  {isCustom && (
                    <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" />
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {a.id === "moderator" ? style.moderatorLabel : ROLE_TAG[a.id]}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => restoreDefault(a.id)}
                  title="恢复默认名字与头像"
                >
                  <RotateCcw className="size-3.5" /> 恢复默认
                </Button>
              </div>

              <div className="mt-3 grid gap-3 max-sm:grid-cols-1 sm:grid-cols-[1fr_1.2fr]">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] text-muted-foreground">称呼</span>
                  <input
                    value={item?.name ?? ""}
                    onChange={(e) => patch(a.id, { name: e.target.value })}
                    maxLength={24}
                    className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] text-muted-foreground">
                    头像图地址 <ImageOff className="inline size-3" /> 留空用默认
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      value={item?.avatarUrl ?? ""}
                      onChange={(e) => patch(a.id, { avatarUrl: e.target.value })}
                      placeholder="https://… 或 /path/to.png"
                      className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
                    />
                    <label className="flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-border bg-background px-3 text-xs text-foreground hover:border-primary/50">
                      <Upload className="size-3.5" /> 上传
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          try {
                            const dataUrl = await compressImageToDataUrl(f);
                            patch(a.id, { avatarUrl: dataUrl });
                          } catch {
                            alert("图片读取失败，请换一张");
                          } finally {
                            e.target.value = "";
                          }
                        }}
                      />
                    </label>
                  </div>
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-2">
        <Button onClick={doSave} disabled={saving} className="gap-2">
          <Save className="size-4" />
          {saving ? "保存中…" : "保存人设"}
        </Button>
        {saved && (
          <span className="text-xs font-medium text-emerald-600">
            已保存，全流程生效
          </span>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        未登录时可在工作台内直接使用默认人设；登录后此处保存会同步到云端，换设备也能读到。
      </p>
    </div>
  );
}