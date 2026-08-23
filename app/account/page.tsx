"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FolderOpen, Trash2, LogOut, ArrowRight } from "lucide-react";
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

  function openProject(id: string) {
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">个人中心</h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={doLogout}>
          <LogOut className="size-3.5" /> 退出登录
        </Button>
      </div>

      <h2 className="mt-8 flex items-center gap-2 text-sm font-semibold text-foreground">
        <FolderOpen className="size-4" /> 我的项目（{projects.length}）
      </h2>

      {projects.length === 0 ? (
        <div className="mt-3 rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">还没有保存的项目。</p>
          <Link
            href="/builder"
            className="mt-3 inline-block text-sm text-primary hover:underline"
          >
            去搭建台 →
          </Link>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {projects.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  更新于 {new Date(p.updatedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="secondary" size="sm" onClick={() => openProject(p.id)}>
                  打开 <ArrowRight className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => doDelete(p.id)}
                  title="删除"
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
