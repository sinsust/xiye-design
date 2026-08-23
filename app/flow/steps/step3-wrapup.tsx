"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  ArrowUpRight,
  Server,
  ClipboardList,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFlowStore } from "@/lib/store/flow-store";
import { TECH_STACKS, type LearningCurve } from "@/data/tech-stacks";
import {
  SERVICE_PROVIDERS,
  SERVICE_CATEGORY_LABELS,
  type ServiceProvider,
} from "@/data/service-providers";

// —— 技术栈（沿用原 Step 3 的智能排序 + 详情卡片） ——

const LEARNING_LABEL: Record<LearningCurve, string> = {
  low: "低",
  medium: "中",
  high: "高",
};
const LEARNING_COLOR: Record<LearningCurve, string> = {
  low: "text-green-600",
  medium: "text-amber-600",
  high: "text-red-600",
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="tracking-tight text-amber-500" aria-label={`推荐指数 ${rating}/5`}>
      {"★".repeat(rating)}
      {"☆".repeat(5 - rating)}
    </span>
  );
}

function TechStackPane() {
  const projectType = useFlowStore((s) => s.projectType);
  const aiCapabilities = useFlowStore((s) => s.aiCapabilities);
  const techStack = useFlowStore((s) => s.techStack);
  const setTechStack = useFlowStore((s) => s.setTechStack);

  const ranked = useMemo(() => {
    const scored = TECH_STACKS.map((stack) => {
      let score = stack.rating;
      if (projectType && stack.recommendedFor.includes(projectType)) score += 2;
      score += aiCapabilities.filter((id) =>
        stack.recommendedAiFor.includes(id),
      ).length;
      return { stack, score };
    });
    scored.sort((a, b) => b.score - a.score || b.stack.rating - a.stack.rating);
    const max = scored.length ? scored[0].score : 0;
    return scored.map((x) => ({ ...x, recommended: x.score === max }));
  }, [projectType, aiCapabilities]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {ranked.map(({ stack, recommended }) => {
        const selected = techStack === stack.id;
        return (
          <button
            key={stack.id}
            type="button"
            onClick={() => setTechStack(stack.id)}
            aria-pressed={selected}
            className={[
              "relative flex flex-col rounded-xl border p-5 text-left transition-all duration-200 hover:-translate-y-1",
              selected ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary",
            ].join(" ")}
          >
            {selected && (
              <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-4" />
              </span>
            )}
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 pr-10 font-semibold text-card-foreground">
                {stack.name}
                {recommended && (
                  <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium leading-none text-primary-foreground">
                    推荐
                  </span>
                )}
              </h3>
              <Stars rating={stack.rating} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{stack.suitableFor}</p>
            <dl className="mt-4 space-y-1.5 text-sm">
              <div className="flex gap-2">
                <dt className="w-12 shrink-0 text-muted-foreground">前端</dt>
                <dd className="text-foreground">{stack.frontend}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-12 shrink-0 text-muted-foreground">后端</dt>
                <dd className="text-foreground">{stack.backend}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-12 shrink-0 text-muted-foreground">数据库</dt>
                <dd className="text-foreground">{stack.database}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-12 shrink-0 text-muted-foreground">样式</dt>
                <dd className="text-foreground">{stack.styling}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-12 shrink-0 text-muted-foreground">AI集成</dt>
                <dd className="text-foreground">{stack.aiIntegration}</dd>
              </div>
            </dl>
            <div className="mt-4">
              <p className="text-xs font-medium text-foreground">优势</p>
              <ul className="mt-1.5 space-y-1">
                {stack.pros.map((p) => (
                  <li key={p} className="flex gap-1.5 text-sm text-foreground/90">
                    <span className="text-green-600">✓</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-4 text-xs">
              <span className="text-muted-foreground">
                预估月成本：<span className="font-medium text-foreground">{stack.estimatedCost}</span>
              </span>
              <span className="text-muted-foreground">
                开发周期：<span className="font-medium text-foreground">{stack.devDuration}</span>
              </span>
              <span className="text-muted-foreground">
                学习门槛：
                <span className={["font-medium", LEARNING_COLOR[stack.learningCurve]].join(" ")}>
                  {LEARNING_LABEL[stack.learningCurve]}
                </span>
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// —— 项目信息（沿用原 Step 8 各区块） ——

const REPO_LINKS = [
  { label: "GitHub", url: "https://github.com/new" },
  { label: "GitLab", url: "https://gitlab.com/projects/new" },
  { label: "Gitee", url: "https://gitee.com/projects/new" },
] as const;

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

function ExternalLink({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-primary hover:underline"
    >
      {label}
      <ArrowUpRight className="size-3" />
    </a>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function ProjectInfoPane() {
  const projectInfo = useFlowStore((s) => s.projectInfo);
  const setProjectInfo = useFlowStore((s) => s.setProjectInfo);
  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="基本信息">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              项目名称 <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={projectInfo?.projectName ?? ""}
              onChange={(e) => setProjectInfo({ projectName: e.target.value })}
              placeholder="如：智能客服平台"
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">项目描述</label>
            <textarea
              rows={3}
              value={projectInfo?.projectDescription ?? ""}
              onChange={(e) => setProjectInfo({ projectDescription: e.target.value })}
              placeholder="一句话描述你的项目做什么"
              className={[inputCls, "resize-none"].join(" ")}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="代码仓库">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Git 仓库地址</label>
            <input
              type="text"
              value={projectInfo?.gitRepoUrl ?? ""}
              onChange={(e) => setProjectInfo({ gitRepoUrl: e.target.value })}
              placeholder="https://github.com/username/repo"
              className={inputCls}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {REPO_LINKS.map((l) => (
              <ExternalLink key={l.label} label={l.label} url={l.url} />
            ))}
          </div>
        </div>
      </SectionCard>

    </div>
  );
}

// —— 服务接入（沿用原 Step 9 的服务商 + .env.local 预览） ——

const CATEGORY_ORDER: ServiceProvider["category"][] = [
  "llm", "database", "vector", "auth", "payment", "observability",
  "email", "search", "storage", "other",
];

function getRecommendedIds(techStack: string | null): Set<string> {
  const map: Record<string, string[]> = {
    nextjs_supabase: ["supabase", "openai", "clerk", "stripe", "sentry", "resend"],
    remix_supabase: ["supabase", "openai", "stripe", "sentry"],
    sveltekit_supabase: ["supabase", "openai", "sentry"],
    nextjs_appwrite: ["openai", "sentry"],
    t3_app: ["openai", "stripe", "sentry", "resend"],
    nuxt_firebase: ["openai", "sentry"],
    react_express: ["openai", "anthropic", "sentry", "resend"],
    django_postgres: ["openai", "anthropic", "sentry"],
    rails_postgres: ["openai", "stripe", "sentry"],
    laravel_vue: ["openai", "sentry", "resend"],
    springboot_vue: ["openai", "sentry"],
    go_react: ["openai", "sentry"],
    cf_workers: ["openai", "sentry"],
    astro_supabase: ["supabase", "openai", "resend"],
    agno: ["agno", "openai", "anthropic", "deepseek"],
  };
  return new Set(techStack ? (map[techStack] ?? []) : []);
}

const keyInputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 pr-9 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

function ApiKeysPane() {
  const apiKeys = useFlowStore((s) => s.apiKeys);
  const setApiKey = useFlowStore((s) => s.setApiKey);
  const techStack = useFlowStore((s) => s.techStack);
  const recommended = getRecommendedIds(techStack);
  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    providers: SERVICE_PROVIDERS.filter((p) => p.category === cat),
  })).filter((g) => g.providers.length > 0);

  const envLines = Object.entries(apiKeys)
    .filter(([, v]) => v.trim() !== "")
    .map(([k, v]) => `${k}=${v}`);
  const envContent = envLines.length
    ? envLines.join("\n")
    : "# 在上方填写 API Key 后，这里会实时生成 .env.local 内容";

  const [showEnv, setShowEnv] = useState(true);
  const [copied, setCopied] = useState(false);
  const copyEnv = async () => {
    try {
      await navigator.clipboard.writeText(envContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板不可用时静默
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {grouped.map(({ cat, providers }) => (
        <section key={cat}>
          <h2 className="mb-3 text-base font-semibold text-foreground">
            {SERVICE_CATEGORY_LABELS[cat]}
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {providers.map((p) => {
              const isRecommended = recommended.has(p.id);
              return (
                <div
                  key={p.id}
                  className={[
                    "flex flex-col rounded-xl border p-4 transition-colors",
                    isRecommended ? "border-primary bg-primary/5" : "border-border bg-card",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(p.website, "_blank", "noopener,noreferrer")}
                    >
                      <ArrowUpRight className="size-3.5" />
                      官网
                    </Button>
                  </div>
                  {isRecommended && (
                    <span className="mt-2 inline-flex w-fit items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      根据你的技术栈推荐
                    </span>
                  )}
                  <p className="mt-3 text-sm text-foreground/90">{p.purpose}</p>
                  <div className="mt-3 flex flex-col gap-3">
                    {p.keys.map((k) => {
                      const filled = (apiKeys[k.key]?.trim().length ?? 0) > 0;
                      return (
                        <div key={k.key} className="flex flex-col gap-1.5">
                          <label className="flex items-center gap-1 text-sm font-medium text-foreground">
                            {k.label}
                            {k.required ? (
                              <span className="text-destructive">*</span>
                            ) : (
                              <span className="text-xs font-normal text-muted-foreground">(可选)</span>
                            )}
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={apiKeys[k.key] ?? ""}
                              onChange={(e) => setApiKey(k.key, e.target.value)}
                              placeholder={k.key}
                              className={keyInputCls}
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                              {filled ? (
                                <Check className="size-4 text-emerald-500" />
                              ) : (
                                <span className="block size-2 rounded-full bg-muted-foreground/30" />
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="rounded-xl border border-border bg-card">
        <button
          type="button"
          onClick={() => setShowEnv((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <span className="flex items-center gap-2 font-semibold text-foreground">
            <span className="font-mono text-sm">.env.local</span>
            <span className="text-xs font-normal text-muted-foreground">实时预览</span>
          </span>
          <ChevronDown className={["size-4 text-muted-foreground transition-transform", showEnv ? "" : "-rotate-90"].join(" ")} />
        </button>
        {showEnv && (
          <div className="relative border-t border-border p-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={copyEnv}
              className="absolute right-3 top-3 z-10 bg-secondary text-secondary-foreground hover:bg-secondary/70"
            >
              {copied ? (<><Check className="size-3.5" /> 已复制</>) : (<><Copy className="size-3.5" /> 复制</>)}
            </Button>
            <pre className="overflow-x-auto rounded-lg bg-muted/50 p-4 pr-20 font-mono text-xs leading-relaxed text-foreground">
              <code>{envContent}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// —— 汇总步骤：技术栈 / 项目信息 / 服务接入三类在一个页面内切换 ——

type TabKey = "stack" | "info" | "keys";

const TABS: { id: TabKey; label: string; icon: typeof Server; desc: string }[] = [
  { id: "info", label: "项目信息", icon: ClipboardList, desc: "名称 / 仓库 / 部署" },
  { id: "stack", label: "技术栈", icon: Server, desc: "推荐 / 成本 / 周期" },
  { id: "keys", label: "服务接入", icon: KeyRound, desc: "API Key / .env" },
];

export function Step3Wrapup() {
  const techStack = useFlowStore((s) => s.techStack);
  const projectInfo = useFlowStore((s) => s.projectInfo);
  const apiKeys = useFlowStore((s) => s.apiKeys);
  const [tab, setTab] = useState<TabKey>("info");

  const infoReady = !!(projectInfo?.projectName?.trim());
  const keyCount = Object.values(apiKeys).filter((v) => v.trim().length > 0).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          收尾配置
        </h1>
        <p className="mt-2 text-muted-foreground">
          补全项目细节——它们会原样写入最终生成的 PRD、技术文档与工程配置。除「项目名称」外均可选填，改完直接「进入生成」即同步生效。
        </p>
      </div>

      {/* Tab 切换：明显分段的选项卡 */}
      <div
        role="tablist"
        aria-label="收尾配置分区"
        className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-muted/40 p-1.5"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          const ready =
            t.id === "stack" ? !!techStack : t.id === "info" ? infoReady : keyCount > 0;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={[
                "flex flex-col items-center gap-1 rounded-lg px-3 py-2.5 text-center transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Icon className="size-4" />
                {t.label}
                {ready && <Check className="size-3.5 text-primary" />}
              </span>
              <span className="text-xs text-muted-foreground">{t.desc}</span>
            </button>
          );
        })}
      </div>

      {/* 当前 Tab 内容 */}
      {tab === "stack" && <TechStackPane />}
      {tab === "info" && <ProjectInfoPane />}
      {tab === "keys" && <ApiKeysPane />}
    </div>
  );
}