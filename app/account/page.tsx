"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  ChevronDown,
  FolderOpen,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import { fetchSession } from "@/lib/auth-session";
import { useCurrentStyle, useAgentsStore } from "@/app/workflow/agents-store";
import {
  AGENT_STYLE_LIST,
  AGENT_ROLES,
  type AgentStyleId,
} from "@/lib/agent-styles";

interface MeUser {
  id: string;
  email: string;
}
interface ImaSyncResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  status: "success" | "partial" | "failed";
  failures: { title: string; reason: string }[];
}
interface ImaSyncLog {
  id: string;
  syncedAt: string;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  status: string;
  failures: string;
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
  const style = useCurrentStyle();

  // 腾讯 ima 凭证绑定态与配置表单
  const [imaBound, setImaBound] = useState(false);
  const [imaShowForm, setImaShowForm] = useState(false);
  const [imaClientId, setImaClientId] = useState("");
  const [imaApiKey, setImaApiKey] = useState("");
  const [imaLoading, setImaLoading] = useState(false);
  const [imaError, setImaError] = useState("");
  // ima 增量同步
  const [imaSyncing, setImaSyncing] = useState(false);
  const [imaSyncProgress, setImaSyncProgress] = useState<{ running: boolean; done: number; total: number }>({
    running: false,
    done: 0,
    total: 0,
  });
  const [imaSyncResult, setImaSyncResult] = useState<ImaSyncResult | null>(null);
  const [imaSyncErr, setImaSyncErr] = useState("");
  const [imaSyncLogs, setImaSyncLogs] = useState<ImaSyncLog[]>([]);
  const [imaShowFailures, setImaShowFailures] = useState(false);

  const loadProjects = useCallback(async () => {
    const r = await fetch("/api/projects");
    if (r.ok) {
      const d = await r.json();
      setProjects(d.projects ?? []);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    // 并行拉取会话 + 项目列表，避免串行等待；会话读取全局缓存
    Promise.all([fetchSession(), loadProjects()])
      .then(([u]) => {
        if (!alive) return;
        if (!u) {
          router.replace("/login");
          return;
        }
        setUser(u as MeUser);
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

  const loadImaSyncLogs = useCallback(async () => {
    try {
      const r = await fetch("/api/brain/ima/sync?action=logs");
      const d = await r.json();
      if (r.ok && Array.isArray(d.logs)) setImaSyncLogs(d.logs);
    } catch {
      /* 忽略 */
    }
  }, []);

  useEffect(() => {
    fetch("/api/account/ima")
      .then((r) => (r.ok ? r.json() : { bound: false }))
      .then((d) => {
        setImaBound(Boolean(d.bound));
        if (d.bound) loadImaSyncLogs();
      })
      .catch(() => setImaBound(false));
  }, [loadImaSyncLogs]);

  async function doImaSave(e: FormEvent) {
    e.preventDefault();
    setImaError("");
    setImaLoading(true);
    try {
      const res = await fetch("/api/account/ima", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: imaClientId, apiKey: imaApiKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImaError(data.detail || data.error || "绑定失败");
        return;
      }
      setImaBound(true);
      setImaShowForm(false);
      setImaClientId("");
      setImaApiKey("");
    } catch {
      setImaError("网络错误");
    } finally {
      setImaLoading(false);
    }
  }

  async function doImaUnbind() {
    if (!confirm("解绑 ima 凭证？已导入第二大脑的条目仍会保留。")) return;
    await fetch("/api/account/ima", { method: "DELETE" });
    setImaBound(false);
    setImaShowForm(false);
  }

  // 一键同步全部：POST 后台执行 + 轮询进度接口展示「正在同步... 12/87」
  async function doImaSync() {
    if (imaSyncing) return;
    setImaSyncing(true);
    setImaSyncResult(null);
    setImaSyncErr("");
    setImaShowFailures(false);
    const poll = window.setInterval(async () => {
      try {
        const r = await fetch("/api/brain/ima/sync?action=progress");
        const d = await r.json();
        if (r.ok) setImaSyncProgress(d);
      } catch {
        /* 忽略 */
      }
    }, 800);
    try {
      const r = await fetch("/api/brain/ima/sync", { method: "POST" });
      const d = await r.json();
      if (!r.ok) {
        setImaSyncErr(d.detail || d.error || "同步失败");
      } else {
        setImaSyncResult(d.result);
      }
    } catch {
      setImaSyncErr("网络错误，同步中断");
    } finally {
      window.clearInterval(poll);
      setImaSyncing(false);
      setImaSyncProgress({ running: false, done: 0, total: 0 });
      loadImaSyncLogs();
    }
  }

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

      {/* 角色风格：选一套即切换主流程氛围（会诊/对话文案 + 人设默认名/头像） */}
      <StylePickerSection />

      {/* 后宫智囊团 · 人设管理入口 */}
      <Link
        href="/account/agents"
        className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition hover:border-primary/40 hover:bg-primary/[0.03]"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Users className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{style.framing} · 人设管理</p>
          <p className="text-xs text-muted-foreground">
            自定义每位专家的名字与头像，全流程生效，AI 会诊也会用新名字自称。
          </p>
        </div>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>

      {/* 腾讯 ima 知识库 · 个人凭证配置 */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Brain className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">腾讯 ima 知识库</p>
              <p className="truncate text-xs text-muted-foreground">
                绑定后可在「第二大脑」导入你自己的 ima 资料
              </p>
            </div>
          </div>
          {imaBound ? (
            <span className="shrink-0 rounded-full bg-emerald-600/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              已绑定
            </span>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setImaShowForm((v) => !v)}>
              <KeyRound className="size-3.5" /> 配置
            </Button>
          )}
        </div>

        {imaShowForm && (
          <form onSubmit={doImaSave} className="mt-4 space-y-3 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              凭证从{" "}
              <a
                href="https://ima.qq.com/agent-interface"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                ima.qq.com/agent-interface
              </a>{" "}
              获取。仅你本人持有，加密存储、明文不出服务端。
            </p>
            <div>
              <label htmlFor="ima-client-id" className="text-xs text-muted-foreground">
                Client ID
              </label>
              <input
                id="ima-client-id"
                name="imaClientId"
                autoComplete="off"
                value={imaClientId}
                onChange={(e) => setImaClientId(e.target.value)}
                className="mt-1 w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                placeholder="ima-openapi-clientid"
              />
            </div>
            <div>
              <label htmlFor="ima-api-key" className="text-xs text-muted-foreground">
                API Key
              </label>
              <input
                id="ima-api-key"
                name="imaApiKey"
                type="password"
                autoComplete="off"
                value={imaApiKey}
                onChange={(e) => setImaApiKey(e.target.value)}
                className="mt-1 w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                placeholder="ima-openapi-apikey"
              />
            </div>
            {imaError && <p className="break-words text-xs text-destructive">{imaError}</p>}
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={imaLoading}>
                {imaLoading ? "验证中…" : "保存并验证"}
              </Button>
              {imaBound && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={doImaUnbind}
                >
                  <Trash2 className="size-3.5" /> 解绑
                </Button>
              )}
            </div>
          </form>
        )}

        {/* 已绑定：增量同步区域 */}
        {imaBound && (
          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                一键同步你的 ima 知识库 → 第二大脑，自动做 AI 分类 / 标签 / 摘要 / 任务提取
              </p>
              <Button size="sm" onClick={doImaSync} disabled={imaSyncing} className="shrink-0">
                <RefreshCw className="size-3.5" /> 一键同步全部
              </Button>
            </div>

            {imaSyncing && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  正在同步... {imaSyncProgress.done}/{imaSyncProgress.total || "…"}
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width:
                        imaSyncProgress.total > 0
                          ? `${Math.round((imaSyncProgress.done / imaSyncProgress.total) * 100)}%`
                          : "8%",
                    }}
                  />
                </div>
              </div>
            )}

            {imaSyncErr && <p className="text-xs text-destructive">{imaSyncErr}</p>}

            {imaSyncResult && (
              <div className="rounded-xl border border-border bg-background p-3 text-xs">
                <p className="text-sm font-medium text-foreground">
                  本次同步：新建 {imaSyncResult.created} 条，更新 {imaSyncResult.updated} 条，跳过{" "}
                  {imaSyncResult.skipped} 条
                  {imaSyncResult.failed > 0 && (
                    <span className="text-destructive">
                      ，失败 {imaSyncResult.failed} 条
                    </span>
                  )}
                </p>
                {imaSyncResult.failures.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setImaShowFailures((v) => !v)}
                      className="mt-2 flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <ChevronDown
                        className={`size-3 transition ${imaShowFailures ? "rotate-180" : ""}`}
                      />
                      查看失败条目（{imaSyncResult.failures.length}）
                    </button>
                    {imaShowFailures && (
                      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg bg-muted/50 p-2">
                        {imaSyncResult.failures.map((f, i) => (
                          <li key={i} className="flex gap-1.5">
                            <span className="shrink-0 text-destructive">·</span>
                            <span className="min-w-0">
                              <span className="font-medium text-foreground">{f.title}</span>
                              <span className="text-muted-foreground"> — {f.reason}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            )}

            {imaSyncLogs.length > 0 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  最近同步：{new Date(imaSyncLogs[0].syncedAt).toLocaleString("zh-CN")}
                </span>
                <span
                  className={
                    imaSyncLogs[0].status === "success"
                      ? "font-medium text-emerald-600"
                      : imaSyncLogs[0].status === "partial"
                        ? "font-medium text-amber-600"
                        : "font-medium text-destructive"
                  }
                >
                  {imaSyncLogs[0].status === "success"
                    ? "成功"
                    : imaSyncLogs[0].status === "partial"
                      ? "部分失败"
                      : "失败"}
                </span>
              </div>
            )}
          </div>
        )}
      </section>

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

/** 角色风格区块：选中即套用该风格预设（覆盖 5 位人设名 + 头像），并切换主流程 prompt 主题 */
function StylePickerSection() {
  const style = useCurrentStyle();
  const [pending, setPending] = useState<AgentStyleId | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function applyStyle(styleId: AgentStyleId) {
    setSaving(true);
    setSaved(false);
    // 1) 本地立即套用预设（覆盖 5 位人设）
    useAgentsStore.getState().setStyle(styleId);
    // 2) 持久化到服务端（含 styleId）
    const overrides = useAgentsStore.getState().overrides;
    const agents = AGENT_ROLES.map((role) => ({
      role,
      name: overrides[role]?.name ?? role,
      avatarUrl: overrides[role]?.avatarUrl ?? null,
    }));
    try {
      const res = await fetch("/api/agents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agents, styleId }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2200);
      } else {
        alert("风格保存失败，请重试。");
      }
    } catch {
      alert("风格保存失败，请重试。");
    } finally {
      setSaving(false);
      setPending(null);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Users className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">角色风格</p>
          <p className="text-xs text-muted-foreground">
            选一套即切换主流程氛围：会诊 / 对话文案 + 五位人设的默认名与头像。选完仍可到「人设管理」逐个微调。
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {AGENT_STYLE_LIST.map((s) => {
          const active = s.id === style.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => (active ? undefined : setPending(s.id))}
              className={[
                "flex items-center gap-3 rounded-xl border p-3 text-left transition",
                active
                  ? "border-transparent ring-2 ring-offset-1"
                  : "border-border hover:border-primary/40",
              ].join(" ")}
              style={
                active
                  ? { boxShadow: `0 0 0 2px ${s.accent}`, backgroundColor: `${s.accent}0f` }
                  : undefined
              }
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-lg"
                style={{ backgroundColor: `${s.accent}1a` }}
              >
                {s.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-foreground">{s.name}</span>
                  {active && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                      style={{ backgroundColor: s.accent, color: "#fff" }}
                    >
                      使用中
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  {s.tagline}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {pending && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/[0.04] px-3 py-2">
          <span className="flex-1 text-xs text-foreground">
            应用「{AGENT_STYLE_LIST.find((s) => s.id === pending)?.name}」将覆盖当前 5 位人设，确认？
          </span>
          <Button size="sm" variant="ghost" onClick={() => setPending(null)} disabled={saving}>
            取消
          </Button>
          <Button size="sm" onClick={() => applyStyle(pending)} disabled={saving}>
            {saving ? "应用中…" : "应用"}
          </Button>
        </div>
      )}

      {saved && (
        <p className="mt-2 text-xs font-medium text-emerald-600">已切换风格，主流程即时生效</p>
      )}
    </section>
  );
}
