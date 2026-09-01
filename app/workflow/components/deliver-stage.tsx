"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Cpu,
  Download,
  FileText,
  FolderDown,
  Layers,
  LayoutTemplate,
  Loader2,
  LoaderCircle,
  RefreshCw,
  Rocket,
  Save,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useFlowStore, type FlowState } from "@/lib/store/flow-store";
import { useShallow } from "zustand/react/shallow";
import { useSkeletonStore } from "@/lib/skeleton-store";
import { getStyleId } from "@/app/workflow/agents-store";
import { generateProject, buildProjectZipFiles, type GeneratedProject } from "@/lib/project-generator";
import { buildZip, downloadBlob } from "@/lib/zip";
import { verifySeed, type SeedVerifyReport } from "@/lib/seed-verify";
import { resolvePositioning, inferFeatureDetails } from "@/lib/project-narrative";
import { buildAiKickoffPrompt } from "@/lib/ai-prompt";
import { type AgentManifest } from "@/lib/agent-manifest";

/* ------------------------------------------------------------------ */
/* 产物导航：把真实工程包（generateProject 产出）映射成左侧清单           */

type ItemKind = "doc" | "config" | "zip" | "seed" | "verify";
type ItemKey =
  | "zip"
  | "prd"
  | "design"
  | "arch"
  | "stack"
  | "skeleton"
  | "motion"
  | "handoff"
  | "prompt"
  | "readme"
  | "agents"
  | "claude"
  | "globals"
  | "tailwind"
  | "xiyeConfig"
  | "agentJson"
  | "seed"
  | "verify";

interface NavItem {
  key: ItemKey;
  label: string;
  group: string;
  kind: ItemKind;
  file?: string;
}

const NAV: NavItem[] = [
  { key: "zip", label: "可运行工程包", group: "工程包", kind: "zip" },
  { key: "prd", label: "产品需求文档", group: "文档", kind: "doc", file: "PRD.md" },
  { key: "design", label: "视觉与技术规范", group: "文档", kind: "doc", file: "DESIGN_SPEC.md" },
  { key: "arch", label: "工程架构", group: "文档", kind: "doc", file: "ARCHITECTURE.md" },
  { key: "stack", label: "技术选型", group: "文档", kind: "doc", file: "STACK.md" },
  { key: "skeleton", label: "页面骨架说明", group: "文档", kind: "doc", file: "SKELETON.md" },
  { key: "motion", label: "动效规范", group: "文档", kind: "doc", file: "MOTION.md" },
  { key: "handoff", label: "AI 交接指令", group: "文档", kind: "doc", file: "AI_HANDOFF.md" },
  { key: "prompt", label: "AI 开工提示词", group: "文档", kind: "doc", file: "AI_PROMPT.md" },
  { key: "readme", label: "项目概览 README", group: "文档", kind: "doc", file: "README.md" },
  { key: "agents", label: "AGENTS.md", group: "文档", kind: "doc", file: "AGENTS.md" },
  { key: "claude", label: "CLAUDE.md", group: "文档", kind: "doc", file: "CLAUDE.md" },
  { key: "globals", label: "globals.css", group: "配置", kind: "config", file: "globals.css" },
  { key: "tailwind", label: "tailwind.config.ts", group: "配置", kind: "config", file: "tailwind.config.ts" },
  { key: "xiyeConfig", label: "xiye.config.json", group: "配置", kind: "config", file: "xiye.config.json" },
  { key: "agentJson", label: "xiye.agent.json", group: "配置", kind: "config", file: "xiye.agent.json" },
  { key: "seed", label: "可运行底座 seed/", group: "底座与自检", kind: "seed" },
  { key: "verify", label: "种子自检报告", group: "底座与自检", kind: "verify" },
];

const GROUP_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  工程包: Rocket,
  文档: FileText,
  配置: Cpu,
  底座与自检: ShieldCheck,
};

function docContent(project: GeneratedProject, file: string): string | null {
  return project.docs.find((d) => d.filename === file)?.content ?? null;
}

function configContent(project: GeneratedProject, key: ItemKey): string | null {
  switch (key) {
    case "globals":
      return project.cssVariables;
    case "tailwind":
      return project.tailwindConfig;
    case "xiyeConfig":
      return project.xiyeConfig;
    case "agentJson":
      return project.agentManifest;
    default:
      return null;
  }
}

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|\s]+/g, "-").trim() || "xiye-project";
}

export function DeliverStage({ visible, onBack }: { visible: boolean; onBack: () => void }) {
  const router = useRouter();
  const productBrief = useFlowStore((s) => s.productBrief);
  const techStackId = useFlowStore((s) => s.techStack);
  const visualStyleId = useFlowStore((s) => s.visualStyle);
  const pageBlueprint = useFlowStore((s) => s.pageBlueprint);
  const savedProjectId = useFlowStore((s) => s.savedProjectId);
  const setSavedProjectId = useFlowStore((s) => s.setSavedProjectId);

  const [active, setActive] = useState<ItemKey>("zip");
  const [copied, setCopied] = useState<ItemKey | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [project, setProject] = useState<GeneratedProject | null>(null);
  const [genState, setGenState] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [genError, setGenError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);

  const activeRef = useRef<ItemKey>("zip");
  activeRef.current = active;

  const hasData = useMemo(
    () => Boolean(productBrief || techStackId || visualStyleId || pageBlueprint.length),
    [productBrief, techStackId, visualStyleId, pageBlueprint],
  );

  const report: SeedVerifyReport | null = useMemo(
    () => (project ? verifySeed(project.seed.files) : null),
    [project],
  );

  const zipFileCount = project ? buildProjectZipFiles(project).length : 0;
  const docCount = project?.docs.length ?? 0;
  const seedFileCount = project?.seed.files.length ?? 0;
  const configCount = project ? 4 : 0;

  // 机器可读清单：供「规格总览」读取结构化选型（产品/技术栈/架构/视觉/页面）
  const manifest = useMemo<AgentManifest | null>(() => {
    if (!project) return null;
    try {
      return (JSON.parse(project.agentManifest) ?? {}) as AgentManifest;
    } catch {
      return null;
    }
  }, [project]);

  // 交给任意 AI 编程工具的开场提示词（与 AI_PROMPT.md 一致），底部一键复制
  const kickoffPrompt = useMemo(
    () => buildAiKickoffPrompt(useFlowStore.getState()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project],
  );

  const generateAll = useCallback(() => {
    if (!hasData) return;
    setGenError(null);
    setGenState("generating");
    // 让出主线程一帧：generateProject 需同步聚合（含 seed 工程文件生成），避免阻塞首帧渲染
    setTimeout(() => {
      try {
        const raw = useFlowStore.getState();
        const adapted = {
          ...raw,
          projectInfo: {
            projectName:
              (productBrief?.name as string | null) ?? raw.projectInfo?.projectName ?? "未命名产品",
            projectDescription:
              (productBrief?.description as string | null) ?? raw.projectInfo?.projectDescription ?? null,
            gitRepoUrl: raw.projectInfo?.gitRepoUrl ?? null,
          },
        } as FlowState;
        // 把 builder 里 AI 改写的文案（skeleton-store）带入整站 ZIP 导出
        const content = useSkeletonStore.getState().content;
        // P2-④：把当前选中的「角色风格」透传到收敛链 spec 文档（语气与风格一致）
        const p = generateProject(adapted, content, getStyleId());
        setProject(p);
        setGenState("done");
        if (activeRef.current === "zip" || !project) setActive("zip");
      } catch (e) {
        setGenError(e instanceof Error ? e.message : "生成失败，请稍后重试");
        setGenState("error");
      }
    }, 30);
  }, [hasData, productBrief]);

  // 便利性对齐旧流程：进入交付阶段且有数据时，自动生成一次全部产物（无需手动点「生成全部产物」）
  const autoGenRef = useRef(false);
  useEffect(() => {
    if (!visible || !hasData || project || autoGenRef.current) return;
    autoGenRef.current = true;
    generateAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, hasData, project]);

  const activeItem = NAV.find((n) => n.key === active)!;

  const copyText = (text: string, key: ItemKey) => {
    void navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  };

  const copyPrompt = () => {
    void navigator.clipboard?.writeText(kickoffPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 1500);
  };

  // 对齐旧版：进入交付阶段且已登录、本地尚无项目记录时，自动存一份到「我的项目」（首次建，之后手动保存覆盖更新）
  useEffect(() => {
    if (!visible || savedProjectId) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await fetch("/api/auth/me");
        if (!me.ok || cancelled) return;
        const store = useFlowStore.getState();
        const snap = store.captureFlowSnapshot();
        const name =
        store.productBrief?.name ||
        store.projectInfo?.projectName ||
        "未命名项目";
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, data: snap }),
        });
        if (res.ok && !cancelled) {
          const j = await res.json();
          if (j.project?.id) useFlowStore.getState().setSavedProjectId(j.project.id);
        }
      } catch {
        /* 静默：localStorage 持久化已兜底防丢 */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedProjectId]);

  const saveProject = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const store = useFlowStore.getState();
      const snap = store.captureFlowSnapshot();
      const name =
        store.productBrief?.name ||
        store.projectInfo?.projectName ||
        "未命名项目";
      const existing = store.savedProjectId;
      let res = existing
        ? await fetch(`/api/projects/${existing}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, data: snap }),
          })
        : await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, data: snap }),
          });
      // savedProjectId 残留/越权（PUT 404）→ 降级新建项目，避免一直保存失败
      if (existing && res.status === 404) {
        useFlowStore.setState({ savedProjectId: null });
        res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, data: snap }),
        });
      }
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setSaveMsg(`保存失败 ${err?.error ?? `(${res.status})`}`);
        return;
      }
      const j = await res.json();
      if (j.project?.id) store.setSavedProjectId(j.project.id);
      setSaveMsg("已保存");
    } catch {
      setSaveMsg("保存失败");
    }
    setSaving(false);
  };

  const downloadText = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadZip = () => {
    if (!project) return;
    const name = safeName(project.projectName || "xiye-project");
    downloadBlob(buildZip(buildProjectZipFiles(project)), `${name}.zip`);
  };

  const previewContent =
    project && (activeItem.kind === "doc" || activeItem.kind === "config")
      ? activeItem.kind === "doc"
        ? docContent(project, activeItem.file!)
        : configContent(project, activeItem.key)
      : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      {/* AI 开工向导：单行紧凑，讲清「下载→解压→AI打开→贴提示词」 */}
      <div className="shrink-0 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <div className="flex items-center gap-1.5">
              <span className="flex size-5 items-center justify-center rounded bg-primary text-[10px] font-bold text-white">AI</span>
              <p className="text-xs font-semibold text-foreground">拿到工程包，用 AI 开始开发</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
              {[
                "下载 .zip",
                "解压到本地",
                "AI 打开项目",
                "粘贴提示词",
              ].map((step, i) => (
                <span key={step} className="flex items-center gap-1">
                  <span className="flex size-4 items-center justify-center rounded-full bg-muted font-mono text-[9px] text-foreground">{i + 1}</span>
                  <span>{step}</span>
                  {i < 3 && <span className="text-border">/</span>}
                </span>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="default"
              className="h-8 gap-1.5 text-xs font-semibold"
              onClick={copyPrompt}
              disabled={!project}
              title="按 Phase 0→1→2 分步推进，每阶段输出完成清单并等你确认"
            >
              {copiedPrompt ? <Check className="size-3.5" /> : <Sparkles className="size-3.5" />}
              {copiedPrompt ? "已复制" : "复制提示词"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setPromptOpen((o) => !o)}
              disabled={!project}
            >
              {promptOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              {promptOpen ? "收起" : "预览"}
            </Button>
          </div>
        </div>
        {promptOpen && project && (
          <div className="mt-2 overflow-hidden rounded-lg border border-border/60 bg-card/80">
            <div className="flex items-center justify-between border-b border-border/40 px-3 py-1.5">
              <p className="text-[11px] text-muted-foreground">
                AI_PROMPT · 与交付包 <code className="rounded bg-muted/60 px-1 font-mono text-[10px]">docs/AI_PROMPT.md</code> 一致
              </p>
              <button
                type="button"
                onClick={() => setPromptOpen(false)}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                关闭
              </button>
            </div>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words p-3 text-xs leading-relaxed text-foreground">
              {kickoffPrompt}
            </pre>
          </div>
        )}
      </div>

      <div className="grid min-h-0 flex-1 gap-2 overflow-hidden xl:grid-cols-[260px_1fr_360px]">
        {/* 左栏：交付产物清单 */}
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border-border/70 shadow-sm">
          <div className="shrink-0 border-b border-border/30 px-3 py-2">
            <p className="text-sm font-medium text-foreground">交付产物</p>
            <p className="text-[11px] text-muted-foreground">基于协同/搭建阶段真实数据生成</p>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
            {Object.entries(
              NAV.reduce<Record<string, NavItem[]>>((acc, it) => {
                (acc[it.group] ??= []).push(it);
                return acc;
              }, {}),
            ).map(([group, items]) => {
              const GIcon = GROUP_ICON[group] ?? FileText;
              return (
                <div key={group}>
                  <p className="flex items-center gap-1 px-1 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    <GIcon className="size-3" />
                    {group}
                  </p>
                  <div className="space-y-0.5">
                    {items.map((it) => {
                      const isActive = active === it.key;
                      return (
                        <button
                          key={it.key}
                          onClick={() => setActive(it.key)}
                          disabled={!project && it.kind !== "zip"}
                          className={[
                            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition",
                            isActive ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted",
                            !project && it.kind !== "zip" ? "cursor-not-allowed opacity-50" : "",
                          ].join(" ")}
                        >
                          {it.kind === "verify" && report ? (
                            <span
                              className={[
                                "size-1.5 shrink-0 rounded-full",
                                report.ok ? "bg-emerald-500" : "bg-amber-500",
                              ].join(" ")}
                            />
                          ) : (
                            <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                          )}
                          <span className="min-w-0 flex-1 truncate">{it.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 中栏：生成概览 */}
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border-border/70 shadow-sm">
          <div className="shrink-0 border-b border-border/30 px-4 py-2">
            <p className="text-sm font-medium text-foreground">生成概览</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {genState === "generating" ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                <LoaderCircle className="size-8 animate-spin text-primary" />
                <p className="text-sm">正在聚合工程产物…</p>
              </div>
            ) : genState === "error" ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <AlertCircle className="size-8 text-destructive" />
                <p className="text-sm font-medium text-foreground">生成失败</p>
                <p className="max-w-xs text-xs text-muted-foreground">{genError ?? "生成过程中出现异常，请稍后重试"}</p>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={generateAll} disabled={!hasData}>
                  <RefreshCw className="size-4" /> 重试
                </Button>
              </div>
            ) : !project ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <Rocket className="size-8 opacity-40" />
                <p>尚未生成交付产物</p>
                <p className="text-xs">点右下角按钮生成工程包</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-sm font-medium text-foreground">{project.projectName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    套用视觉风格 · {project.style.name}
                    {project.usedFallback ? "（默认回退）" : ""}
                  </p>
                </div>
                <ul className="space-y-2 text-sm">
                  <OverviewRow icon={FileText} label="文档交付包" value={`${docCount} 份 .md`} />
                  <OverviewRow icon={Cpu} label="工程配置" value={`${configCount} 个（css/ts/json）`} />
                  <OverviewRow icon={Boxes} label="可运行底座" value={`seed/ 共 ${seedFileCount} 个文件`} />
                  <OverviewRow icon={FolderDown} label="一键打包" value={`${zipFileCount} 个文件 → .zip`} />
                </ul>
                {report && (
                  <div className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm">
                    <ShieldCheck className="size-4 text-primary" />
                    <span className="text-muted-foreground">种子自检</span>
                    <span className="ml-auto flex items-center gap-2 text-xs">
                      <span className="text-emerald-600">通过 {report.passed}</span>
                      <span className="text-amber-600">提示 {report.warned}</span>
                      <span className="text-destructive">失败 {report.failed}</span>
                    </span>
                  </div>
                )}

                {/* 规格总览：产品 / 技术栈 / 架构 / 视觉规范 / 页面骨架 —— 对齐旧流程的信息丰富性 */}
                <SpecOverview project={project} manifest={manifest} />
              </div>
            )}
          </div>
        </div>

        {/* 右栏：产物预览 */}
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border-border/70 shadow-sm">
          <div className="flex shrink-0 flex-row items-center justify-between border-b border-border/30 px-4 py-2">
            <p className="text-sm font-medium text-foreground">{activeItem.label}</p>
            {previewContent && (
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs"
                  onClick={() => copyText(previewContent, activeItem.key)}
                >
                  {copied === activeItem.key ? <CheckCircle2 className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied === activeItem.key ? "已复制" : "复制"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs"
                  onClick={() => downloadText(activeItem.file ?? activeItem.key, previewContent)}
                >
                  <Download className="size-3.5" />
                  下载
                </Button>
              </div>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {!project ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <FileText className="size-8 opacity-40" />
                <p>该产物尚未生成</p>
              </div>
            ) : activeItem.kind === "doc" || activeItem.kind === "config" ? (
              previewContent ? (
                <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground">
                  {previewContent}
                </pre>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                  <AlertCircle className="size-8 opacity-40" />
                  <p>该产物内容为空</p>
                </div>
              )
            ) : activeItem.kind === "zip" ? (
              <ZipOverview project={project} onDownload={downloadZip} fileCount={zipFileCount} />
            ) : activeItem.kind === "seed" ? (
              <SeedOverview project={project} />
            ) : (
              <VerifyOverview report={report} />
            )}
          </div>
        </div>
      </div>

      {/* 底部操作条 */}
      <div className="shrink-0 rounded-2xl border border-border/70 bg-card px-4 py-2 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Rocket className="size-4" />
            <span>交付工作台</span>
            {genState === "done" && <span className="text-emerald-600">已全部就绪</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={onBack}>
              上一步
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="px-2"
              onClick={generateAll}
              disabled={!hasData || genState === "generating"}
              title="重新生成全部产物"
            >
              {genState === "generating" ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : genState === "error" || genState === "done" ? (
                <RefreshCw className="size-4" />
              ) : (
                <Rocket className="size-4" />
              )}
            </Button>
            <Button size="sm" className="gap-2" onClick={saveProject} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {saveMsg ?? "保存"}
            </Button>
            <Button
              size="sm"
              className="gap-2"
              onClick={downloadZip}
              disabled={!project}
            >
              <Download className="size-4" />
              全部下载
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 子组件                                                              */

function OverviewRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <li className="flex items-center gap-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-medium text-foreground">{value}</span>
    </li>
  );
}

function ZipOverview({
  project,
  onDownload,
  fileCount,
}: {
  project: GeneratedProject;
  onDownload: () => void;
  fileCount: number;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Rocket className="size-4 text-primary" />
          可运行工程包
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          打包为 <span className="font-mono">.zip</span>：文档按 <span className="font-mono">docs/</span>、
          样式按 <span className="font-mono">styles/</span>、配置在根目录、<span className="font-mono">seed/</span> 为可运行底座。
          解压后用 Cursor / Codex / WorkBuddy 等 AI 编程工具打开即可开工。
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span className="text-muted-foreground">
            文件数：<span className="font-medium text-foreground">{fileCount}</span>
          </span>
          <span className="text-muted-foreground">
            底座：
            <span className="font-medium text-foreground">{project.seed.runnable ? "可直接运行" : "权威脚手架"}</span>
          </span>
        </div>
        <Button size="sm" className="mt-3 gap-2" onClick={onDownload}>
          <FolderDown className="size-4" />
          全部下载
        </Button>
      </div>
      <div className="rounded-xl border border-border/60 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">底座内含</p>
        <ul className="mt-1.5 space-y-0.5">
          <li>· AGENTS.md / CLAUDE.md：AI 编码工具打开即自动加载的开发约定</li>
          <li>· BLUEPRINT.md：蓝图装配清单（页面路由与组件占位已落盘）</li>
          <li>· scripts/verify.mjs：可脚本化验收（token / 目录 / 页面 / 组件 / 无 TODO / 无密钥泄漏）</li>
        </ul>
      </div>
    </div>
  );
}

function SeedOverview({ project }: { project: GeneratedProject }) {
  const s = project.seed;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Boxes className="size-4 text-primary" />
        可运行底座（seed/）
      </div>
      <dl className="grid grid-cols-1 gap-2 text-sm">
        <SeedField label="技术栈" value={s.frameworkLabel} />
        <SeedField label="文件数" value={String(s.files.length)} />
        <SeedField label="启动命令" value={s.runCommand} mono />
        <SeedField label="状态" value={s.runnable ? "可直接运行" : "权威脚手架"} />
      </dl>
    </div>
  );
}

function SeedField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2 border-b border-border/40 pb-2">
      <dt className="w-20 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={["min-w-0 flex-1 break-words text-foreground", mono ? "font-mono text-xs" : ""].join(" ")}>
        {value}
      </dd>
    </div>
  );
}

function VerifyOverview({ report }: { report: SeedVerifyReport | null }) {
  if (!report) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <ShieldCheck className="size-8 opacity-40" />
        <p>自检报告不可用</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <ShieldCheck className="size-4 text-primary" />
        种子自检报告
        <span
          className={[
            "ml-auto rounded-full px-2 py-0.5 text-xs font-medium",
            report.ok ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700",
          ].join(" ")}
        >
          {report.ok ? "已验证通过" : "需人工查看"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span className="text-muted-foreground">通过 <span className="font-semibold text-primary">{report.passed}</span></span>
        <span className="text-muted-foreground">提示 <span className="font-semibold text-amber-600">{report.warned}</span></span>
        <span className="text-muted-foreground">失败 <span className="font-semibold text-destructive">{report.failed}</span></span>
      </div>
      <p className="text-xs text-muted-foreground">
        与下载后在 <span className="font-mono">seed/</span> 运行{" "}
        <span className="font-mono">node scripts/verify.mjs</span> 的判定保持一致
      </p>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border/60">
        {report.checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2.5 px-3 py-2.5">
            <span
              className={[
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
                c.status === "pass"
                  ? "bg-primary"
                  : c.status === "fail"
                    ? "bg-destructive"
                    : c.status === "warn"
                      ? "bg-amber-500"
                      : "bg-muted-foreground",
              ].join(" ")}
            >
              {c.status === "pass" ? "✓" : c.status === "fail" ? "!" : "•"}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{c.label}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{c.message}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 规格总览：把真实工程包的汇总选型在一屏内铺开（对齐旧流程 step11）       */

function SOField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">{value}</dd>
    </div>
  );
}

function SpecOverview({
  project,
  manifest,
}: {
  project: GeneratedProject;
  manifest: AgentManifest | null;
}) {
  const state = useFlowStore();
  const tk = manifest?.designTokens;
  const stack = manifest?.stack;
  const archLayers = manifest?.architecture?.layers ?? [];
  const pages = manifest?.pages ?? [];
  const motion = manifest?.motion ?? {};
  // 锚定重算字段：整 store 对象每次 set 都是新引用，直接当依赖会令无关变化也重算
  const soKey = useFlowStore(
    useShallow((s) => ({
      aiCapabilities: s.aiCapabilities,
      pageBlueprint: s.pageBlueprint,
      projectInfo: s.projectInfo,
      projectType: s.projectType,
      techStack: s.techStack,
      visualStyle: s.visualStyle,
    })),
  );
  const features = useMemo(() => inferFeatureDetails(state), [soKey]);
  const positioning = useMemo(() => resolvePositioning(state), [soKey]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Sparkles className="size-4 text-primary" />
        规格总览
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <section className="rounded-xl border border-border/60 p-3">
          <h3 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Sparkles className="size-4 text-primary" /> 产品
          </h3>
          <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <SOField label="名称" value={project.projectName} />
            <SOField label="类型" value={manifest?.meta?.projectType ?? "未指定"} />
            <div className="sm:col-span-2">
              <SOField label="定位 / 描述" value={positioning || "—"} />
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">特点</dt>
              <dd className="mt-1 space-y-1">
                {features.length ? (
                  features.map((f) => (
                    <p key={f.name} className="text-sm leading-relaxed text-foreground">
                      {f.desc ? (
                        <>
                          <span className="font-medium">{f.name}</span>
                          <span className="text-muted-foreground"> — {f.desc}</span>
                        </>
                      ) : (
                        f.name
                      )}
                    </p>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-border/60 p-3">
          <h3 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Boxes className="size-4 text-primary" /> 技术栈
          </h3>
          {stack ? (
            <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <SOField label="框架" value={stack.name} />
              <SOField label="前端" value={stack.frontend ?? "—"} />
              <SOField label="后端" value={stack.backend ?? "—"} />
              <SOField label="数据库" value={stack.database ?? "—"} />
              <SOField label="样式" value={stack.styling ?? "—"} />
              <SOField label="AI 集成" value={stack.aiIntegration ?? "—"} />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">未选择技术栈，见 docs/STACK.md。</p>
          )}
          {manifest?.uiLibraries?.main && (
            <p className="mt-2.5 border-t border-border/40 pt-2.5 text-sm text-muted-foreground">
              UI 主库：<span className="font-medium text-foreground">{manifest.uiLibraries.main.name}</span>
              {manifest.uiLibraries.addon?.name ? ` · 增强库：${manifest.uiLibraries.addon.name}` : ""}
            </p>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-border/60 p-3">
        <h3 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Layers className="size-4 text-primary" /> 架构规划
        </h3>
        {stack?.pattern && (
          <p className="mb-2.5 text-sm text-muted-foreground">
            模式：<span className="font-medium text-foreground">{stack.pattern}</span> · 详见{" "}
            <code className="rounded bg-muted/50 px-1 py-0.5 font-mono text-xs">docs/ARCHITECTURE.md</code>
          </p>
        )}
        {archLayers.length ? (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
            {archLayers.map((l, idx) => (
              <li key={l.id ?? l.path ?? idx} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <span className="text-sm font-medium text-foreground">{l.name}</span>
                <code className="font-mono text-xs text-muted-foreground">{l.path}</code>
                {l.pages?.length ? (
                  <span className="ml-auto text-xs text-muted-foreground">落点：{l.pages.join("、")}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">架构信息见 docs/ARCHITECTURE.md。</p>
        )}
      </section>

      <section className="rounded-xl border border-border/60 p-3">
        <h3 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <LayoutTemplate className="size-4 text-primary" /> 视觉规范
        </h3>
        {manifest?.visualStyle && (
          <p className="mb-2.5 text-sm text-muted-foreground">
            风格：<span className="font-medium text-foreground">{manifest.visualStyle.name}</span>
            {manifest.visualStyle.sourceSkill ? ` · 来源 ${manifest.visualStyle.sourceSkill}` : ""}
            {project.usedFallback ? "（默认回退）" : ""}
          </p>
        )}
        {tk && (
          <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">色板</dt>
              <dd className="mt-1.5 flex items-center gap-1.5">
                {[tk.colors.primary, tk.colors.secondary, tk.colors.background, tk.colors.surface, tk.colors.border, tk.colors.foreground, tk.colors.muted]
                  .filter(Boolean)
                  .map((c, i) => (
                    <span key={i} className="size-4 rounded-full border border-border" style={{ backgroundColor: c }} title={c} />
                  ))}
                <span className="ml-1 font-mono text-xs text-muted-foreground">{tk.colors.primary}</span>
              </dd>
            </div>
            <SOField label="字体" value={<span className="font-mono text-xs">{tk.typography?.fontFamily}</span>} />
            <SOField label="圆角" value={tk.layout?.radius ?? "—"} />
            <SOField label="密度" value={tk.layout?.density ?? "—"} />
            <SOField label="阴影" value={tk.layout?.shadow ?? "—"} />
            <SOField label="暗色模式" value={tk.layout?.darkMode ?? "—"} />
          </dl>
        )}
      </section>

      <section className="rounded-xl border border-border/60 p-3">
        <h3 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <LayoutTemplate className="size-4 text-primary" /> 页面与组件骨架
        </h3>
        {pages.length ? (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
            {pages.map((p, i) => (
              <li key={p.pageSlug ?? i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded bg-primary/10 font-mono text-xs text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm font-medium text-foreground">{p.pageName}</span>
                <span className="ml-auto w-full text-xs leading-relaxed text-muted-foreground sm:w-auto">
                  {p.components?.map((c) => `${c.componentName}（${c.variantName}）`).join(" · ") || "（待补全）"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">尚未加入蓝图，见 docs/SKELETON.md。</p>
        )}
      </section>

      {Object.keys(motion).length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm text-muted-foreground">
          <Zap className="size-4 shrink-0 text-primary" />
          专项动效已纳入交接：{Object.values(motion).map((m) => `${m.scenarioName}→${m.variantName}`).join("、")}
        </div>
      )}
    </div>
  );
}
