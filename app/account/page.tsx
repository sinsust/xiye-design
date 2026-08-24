"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, FolderOpen, LogOut, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MeUser {
  id: string;
  email: string;
}
interface ProjectItem {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  kind?: "flow" | "builder";
  productName?: string;
}

function formatDate(t: number): string {
  return new Date(t).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<MeUser | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    const r = await fetch("/api/projects");
    if (r.ok) {
      const d = await r.json();
      setProjects(d.projects ?? []);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then(async (d) => {
        if (!alive) return;
        if (d.user) {
          setUser(d.user);
          await loadProjects();
        } else {
          router.replace("/login");
        }
      })
      .catch(() => {
        if (alive) router.replace("/login");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [loadProjects, router]);

  async function doDelete(id: string) {
    if (!confirm("删除该项目？此操作不可撤销。")) return;
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (res.ok) loadProjects();
  }

  async function doLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  async function openProject(id: string) {
    // 判断该项目是「流程草稿」（flat flow 快照）还是「builder 工作区」（含 skeleton），
    // 流程草稿回 /workflow 续接，builder 工作区回 /builder。
    try {
      const r = await fetch(`/api/projects/${id}`);
      if (r.ok) {
        const d = await r.json();
        const data =
          typeof d.project?.data === "string"
            ? JSON.parse(d.project.data)
            : d.project?.data;
        const isFlowDraft =
          data &&
          (data.intentNarrative || data.productBrief || data.currentStep != null) &&
          !data.skeleton;
        if (isFlowDraft) {
          router.push("/workflow?pid=" + id);
          return;
        }
      }
    } catch {
      /* 忽略，走 builder 兜底 */
    }
    router.push("/builder?pid=" + id);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">
        加载中…
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* 用户区 */}
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
          {(user.email[0] ?? "?").toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-foreground">个人中心</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={doLogout}>
          <LogOut className="size-3.5" /> 退出登录
        </Button>
      </div>

      {/* 后宫智囊团 · 人设管理入口 */}
      <Link
        href="/account/agents"
        className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition hover:border-primary/40 hover:bg-primary/[0.03]"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Users className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">后宫智囊团 · 人设管理</p>
          <p className="text-xs text-muted-foreground">
            自定义每位专家的名字与头像，全流程生效，AI 会诊也会用新名字自称。
          </p>
        </div>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FolderOpen className="size-4" /> 我的项目（{projects.length}）
          </h2>
          <Link href="/builder" className="text-xs text-primary hover:underline">
            新建项目 →
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-border py-14 text-center">
            <FolderOpen className="size-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">还没有保存的项目</p>
            <Link href="/builder" className="mt-2 text-xs text-primary hover:underline">
              去页面搭建或工作流保存一个 →
            </Link>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {projects.map((p) => {
              const title = p.productName || p.name;
              const isFlow = p.kind === "flow";
              return (
                <li key={p.id} className="group flex items-center gap-3 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{title}</p>
                      <span
                        className={[
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                          isFlow
                            ? "bg-primary/10 text-primary"
                            : "bg-emerald-600/10 text-emerald-700",
                        ].join(" ")}
                      >
                        {isFlow ? "流程草稿" : "搭建工作区"}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      {p.productName && p.productName !== p.name && (
                        <span className="truncate text-muted-foreground/70">{p.name}</span>
                      )}
                      <span>更新于 {formatDate(p.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openProject(p.id)}>
                      打开 <ArrowRight className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => doDelete(p.id)}
                      title="删除"
                      className="opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100"
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
