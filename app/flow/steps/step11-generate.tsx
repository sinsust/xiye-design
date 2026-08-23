"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  FolderDown,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Boxes,
  Layers,
  LayoutTemplate,
  Bot,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFlowStore } from "@/lib/store/flow-store";
import { generateProject, buildProjectZipFiles, type GeneratedProject } from "@/lib/project-generator";
import { buildZip, downloadBlob } from "@/lib/zip";
import { verifySeed } from "@/lib/seed-verify";
import { buildAiKickoffPrompt } from "@/lib/ai-prompt";
import { type AgentManifest } from "@/lib/agent-manifest";
import {
  resolvePositioning,
  inferFeatureDetails,
  inferKeyModules,
} from "@/lib/project-narrative";

type TabKey = string;

interface DocTab {
  key: string;
  label: string;
  file: string;
  content: string;
  kind: "markdown" | "css" | "ts" | "json";
}

function buildTabs(project: GeneratedProject): DocTab[] {
  const mdTabs: DocTab[] = project.docs.map((d) => ({
    key: d.filename,
    label: d.filename,
    file: d.filename,
    content: d.content,
    kind: "markdown",
  }));
  const seedReadme = project.seed.files.find((f) => f.path === "README.md");
  return [
    ...mdTabs,
    { key: "globals.css", label: "globals.css", file: "globals.css", content: project.cssVariables, kind: "css" },
    { key: "tailwind.config.ts", label: "tailwind.config.ts", file: "tailwind.config.ts", content: project.tailwindConfig, kind: "ts" },
    { key: "xiye.agent.json", label: "xiye.agent.json", file: "xiye.agent.json", content: project.agentManifest, kind: "json" },
    { key: "xiye.config.json", label: "xiye.config.json", file: "xiye.config.json", content: project.xiyeConfig, kind: "json" },
    ...(seedReadme
      ? [{ key: "seed/README.md", label: "seed/README.md", file: "seed/README.md", content: seedReadme.content, kind: "markdown" as const }]
      : []),
  ];
}

export function Step11Generate() {
  const state = useFlowStore();
  const project = generateProject(state);
  const s = project.style;

  const tabs = useMemo(() => buildTabs(project), [project]);
  const [activeTab, setActiveTab] = useState<TabKey>("DESIGN_SPEC.md");
  const [copiedTab, setCopiedTab] = useState<TabKey | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const active = tabs.find((t) => t.key === activeTab) ?? tabs[0];

  // 机器可读清单：供「项目总结」区块读取结构化选型
  const manifest = useMemo<AgentManifest>(() => {
    try {
      return (JSON.parse(project.agentManifest) ?? {}) as AgentManifest;
    } catch {
      return {} as AgentManifest;
    }
  }, [project.agentManifest]);

  // 给任意 AI 编程工具的开场提示词（与 AI_PROMPT.md 一致）
  const kickoffPrompt = useMemo(() => buildAiKickoffPrompt(state), [state]);

  // 与 verify.mjs 相同的规则，对内存中的 seed 就地自检
  const report = useMemo(() => verifySeed(project.seed.files), [project.seed.files]);

  const zipFileCount = buildProjectZipFiles(project).length;

  const stack = manifest?.stack;
  const tk = manifest?.designTokens;
  const archLayers = manifest?.architecture?.layers ?? [];
  const pages = manifest?.pages ?? [];

  const copy = async (key: TabKey) => {
    const tab = tabs.find((t) => t.key === key);
    if (!tab) return;
    try {
      await navigator.clipboard.writeText(tab.content);
      setCopiedTab(key);
      setTimeout(() => setCopiedTab((t) => (t === key ? null : t)), 2000);
    } catch {
      // 剪贴板不可用时静默
    }
  };

  const copyKickoff = async () => {
    try {
      await navigator.clipboard.writeText(kickoffPrompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      // 静默
    }
  };

  const downloadActive = () => {
    if (!active) return;
    const mime = active.kind === "json" ? "application/json" : "text/plain;charset=utf-8";
    const blob = new Blob([active.content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = active.file;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAllZip = () => {
    const raw = project.projectName || "xiye-project";
    const safe = raw.replace(/[\\/:*?"<>|\s]+/g, "-").trim() || "xiye-project";
    downloadBlob(buildZip(buildProjectZipFiles(project)), `${safe}.zip`);
  };

  // —— 项目总结：一个小型标签/值字段卡片 ——
  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">{value}</dd>
    </div>
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">项目总结</h1>
        <p className="mt-2 text-muted-foreground">
          一份完整的项目规格总结 + 可直接交给 AI 编程工具的开工提示词
        </p>
      </div>

      {/* ———— 项目总结报告 ———— */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">规格总览</h2>
        </div>

        {/* 产品定位 + 技术栈 */}
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="size-4 text-primary" /> 产品
            </h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="名称" value={project.projectName} />
              <Field label="类型" value={manifest?.meta?.projectType ?? "未指定"} />
              <div className="sm:col-span-2">
                <Field label="定位 / 描述" value={resolvePositioning(state)} />
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">特点</dt>
                <dd className="mt-1.5 space-y-1">
                  {inferFeatureDetails(state).map((f) => (
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
                  ))}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Boxes className="size-4 text-primary" /> 技术栈
            </h3>
            {stack ? (
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="框架" value={stack.name} />
                <Field label="前端" value={stack.frontend ?? "—"} />
                <Field label="后端" value={stack.backend ?? "—"} />
                <Field label="数据库" value={stack.database ?? "—"} />
                <Field label="样式" value={stack.styling ?? "—"} />
                <Field label="AI 集成" value={stack.aiIntegration ?? "—"} />
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">未选择技术栈，见 docs/STACK.md。</p>
            )}
            {manifest?.uiLibraries?.main && (
              <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
                UI 主库：<span className="font-medium text-foreground">{manifest.uiLibraries.main.name}</span>
                {manifest.uiLibraries.addon?.name ? ` · 增强库：${manifest.uiLibraries.addon.name}` : ""}
              </p>
            )}
          </section>
        </div>

        {/* 架构规划 */}
        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Layers className="size-4 text-primary" /> 架构规划
          </h3>
          {stack?.pattern && (
            <p className="mb-3 text-sm text-muted-foreground">
              模式：<span className="font-medium text-foreground">{stack.pattern}</span> · 详见{" "}
              <code className="rounded bg-muted/50 px-1 py-0.5 font-mono text-xs">docs/ARCHITECTURE.md</code>
            </p>
          )}
          {archLayers.length ? (
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {archLayers.map((l, idx) => (
                <li key={l.id ?? l.path ?? idx} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
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

        {/* 视觉规范 */}
        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <LayoutTemplate className="size-4 text-primary" /> 视觉规范
          </h3>
          {manifest?.visualStyle && (
            <p className="mb-3 text-sm text-muted-foreground">
              风格：<span className="font-medium text-foreground">{manifest.visualStyle.name}</span>
              {manifest.visualStyle.sourceSkill ? ` · 来源 ${manifest.visualStyle.sourceSkill}` : ""}
            </p>
          )}
          {tk && (
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">色板</dt>
                <dd className="mt-1.5 flex items-center gap-1.5">
                  {[
                    tk.colors.primary,
                    tk.colors.secondary,
                    tk.colors.background,
                    tk.colors.surface,
                    tk.colors.border,
                    tk.colors.foreground,
                    tk.colors.muted,
                  ]
                    .filter(Boolean)
                    .map((c: string, i) => (
                      <span key={i} className="size-4 rounded-full border border-border" style={{ backgroundColor: c }} title={c} />
                    ))}
                  <span className="ml-1 font-mono text-xs text-muted-foreground">{tk.colors.primary}</span>
                </dd>
              </div>
              <Field label="字体" value={<span className="font-mono text-xs">{tk.typography?.fontFamily}</span>} />
              <Field label="圆角" value={tk.layout?.radius ?? "—"} />
              <Field label="密度" value={tk.layout?.density ?? "—"} />
              <Field label="阴影" value={tk.layout?.shadow ?? "—"} />
              <Field label="暗色模式" value={tk.layout?.darkMode ?? "—"} />
            </dl>
          )}
        </section>

        {/* 页面与组件骨架 */}
        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <LayoutTemplate className="size-4 text-primary" /> 页面与组件骨架
          </h3>
          {pages.length ? (
            <>
              <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span className="flex shrink-0 gap-0.5" aria-hidden>
                  {[s.palette.accent, s.palette.accent2, s.palette.surface, s.palette.text].map((c, i) => (
                    <span key={i} className="size-3 rounded-full border border-black/10" style={{ background: c }} />
                  ))}
                </span>
                <span>
                  本次共注入 <span className="font-medium text-foreground">{pages.length}</span> 个页面，统一落地「
                  <span className="font-medium text-foreground">{manifest?.visualStyle?.name ?? "默认"}</span>」这套视觉契约
                  （token / 字体 / 圆角 / 动效以{" "}
                  <code className="rounded bg-muted/50 px-1 py-0.5 font-mono text-xs">docs/DESIGN_SPEC.md</code> 为准）。
                  未加入蓝图的页面不会生成，也不套用本契约。
                </span>
              </p>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {pages.map((p, i: number) => (
                <li key={p.pageSlug ?? i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
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
            </>
          ) : (
            <p className="text-sm text-muted-foreground">尚未加入蓝图，见 docs/SKELETON.md。</p>
          )}
        </section>
      </div>

      {/* ———— AI 初始化提示词 ———— */}
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Bot className="size-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">AI 初始化提示词</h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
            交给 AI 编程工具
          </span>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          解压 zip 后用 <span className="font-medium text-foreground">Cursor / Codex / WorkBuddy / TRAE / Qoder</span>{" "}
          等工具打开工程，把下面这段提示词连同上下文一贴，AI 即按既有技术栈与视觉规范进入开工状态。
          内容与交付的 <code className="rounded bg-muted/50 px-1 py-0.5 font-mono text-xs">docs/AI_PROMPT.md</code> 完全一致。
        </p>
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">复制到 AI 编程工具</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyKickoff}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/70"
            >
              {copiedPrompt ? (
                <>
                  <Check className="size-3.5" /> 已复制
                </>
              ) : (
                <>
                  <Copy className="size-3.5" /> 复制提示词
                </>
              )}
            </Button>
          </div>
          <pre className="max-h-[520px] overflow-auto rounded-b-xl bg-muted/50 p-4 font-mono text-xs leading-relaxed text-foreground">
            <code>{kickoffPrompt}</code>
          </pre>
        </div>
      </div>

      {/* +Zap 提醒：动效已入清单 */}
      {Object.keys(manifest?.motion ?? {}).length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <Zap className="size-4 text-primary" />
          专项动效已纳入交接：{Object.values(manifest.motion).map((m) => `${m.scenarioName}→${m.variantName}`).join("、")}
        </div>
      )}

      {/* 可运行底座（seed/）概览 */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <FolderDown className="size-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">可运行底座（seed/）</h2>
          <span
            className={[
              "rounded-full px-2 py-0.5 text-xs font-medium",
              project.seed.runnable ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground",
            ].join(" ")}
          >
            {project.seed.runnable ? "可直接运行" : "权威脚手架"}
          </span>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="text-muted-foreground">
              技术栈：<span className="font-medium text-foreground">{project.seed.frameworkLabel}</span>
            </span>
            <span className="text-muted-foreground">
              文件数：<span className="font-medium text-foreground">{project.seed.files.length}</span>
            </span>
            <span className="text-muted-foreground">
              启动：<code className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-foreground">{project.seed.runCommand}</code>
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            依赖锁定版本、目录按架构铺好、壳页面已套用设计 token。seed 内含{" "}
            <span className="font-medium text-foreground">AGENTS.md/CLAUDE.md</span>、
            <span className="font-medium text-foreground">BLUEPRINT.md</span>、
            <span className="font-medium text-foreground">DATA_CONTRACT.md</span>、
            <span className="font-medium text-foreground">scripts/verify.mjs</span>。
          </p>
        </div>
      </div>

      {/* 种子自检报告 */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">种子自检报告</h2>
          <span
            className={[
              "rounded-full px-2 py-0.5 text-xs font-medium",
              report.ok ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700",
            ].join(" ")}
          >
            {report.ok ? "已验证通过" : "需人工查看"}
          </span>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <span className="text-muted-foreground">
              通过 <span className="font-semibold text-primary">{report.passed}</span>
            </span>
            <span className="text-muted-foreground">
              提示 <span className="font-semibold text-amber-600">{report.warned}</span>
            </span>
            <span className="text-muted-foreground">
              失败 <span className="font-semibold text-destructive">{report.failed}</span>
            </span>
            <span className="ml-auto text-xs text-muted-foreground">
              与下载后在 <span className="font-mono">seed/</span> 运行{" "}
              <span className="font-mono">node scripts/verify.mjs</span> 的判定保持一致
            </span>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {report.checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2.5 px-3 py-2.5">
                <span
                  className={[
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
                    c.status === "pass" ? "bg-primary" : c.status === "fail" ? "bg-destructive" : "bg-amber-500",
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
      </div>

      {/* 导出工程文件 */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-foreground">导出的工程文件</h2>
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center border-b border-border">
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-2 py-1.5">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={[
                    "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    activeTab === t.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2 border-l border-border py-1.5 pl-2 pr-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy(activeTab)}
                className="bg-secondary text-secondary-foreground hover:bg-secondary/70"
              >
                {copiedTab === activeTab ? (
                  <>
                    <Check className="size-3.5" /> 已复制
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" /> 复制
                  </>
                )}
              </Button>
            </div>
          </div>
          <pre className="max-h-[420px] overflow-auto rounded-b-xl bg-muted/50 p-4 font-mono text-xs leading-relaxed text-foreground">
            <code>{active.content}</code>
          </pre>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={downloadAllZip}>
            <FolderDown className="size-4" />
            一键下载全部（{zipFileCount} 个文件）
          </Button>
          <Button variant="outline" onClick={downloadActive}>
            <Download className="size-4" />
            下载 {tabs.find((t) => t.key === activeTab)?.file ?? "文件"}
          </Button>
          <span className="text-xs text-muted-foreground">
            打包为 .zip：md 按 <span className="font-mono">docs/</span>、样式按 <span className="font-mono">styles/</span> 分层，<span className="font-mono">seed/</span> 为可运行底座
          </span>
        </div>
      </div>
    </div>
    );
  }