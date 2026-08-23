"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SKILL_CATALOG,
  SKILL_CATEGORIES,
  type Skill,
} from "@/data/skill-catalog";
import {
  VISUAL_LIBRARY,
  LIBRARY_CATEGORY_LABELS,
  getLibraryStyles,
} from "@/data/visual-library";
import { MOTION_RESOURCES } from "@/data/motion-resources";

type CategoryId = Skill["category"] | "all" | "visual-library" | "motion-resource";

const CATEGORY_LABELS: Record<CategoryId, string> = {
  all: "全部",
  ai: "AI 能力",
  data: "数据处理",
  ui: "UI/交互",
  devops: "DevOps",
  integration: "第三方集成",
  utility: "工具类",
  "visual-library": "视觉库",
  "motion-resource": "动效资源",
};

export default function SkillsPage() {
  const [activeCat, setActiveCat] = useState<CategoryId>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(
    () =>
      activeCat === "all"
        ? SKILL_CATALOG
        : SKILL_CATALOG.filter((s) => s.category === activeCat),
    [activeCat],
  );

  const openSkill = async (id: string) => {
    setOpenId(id);
    setLoading(true);
    setContent("");
    try {
      const res = await fetch(`/api/skill-content?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      setContent(data.ok ? data.content : `读取失败：${data.error ?? ""}`);
    } catch {
      setContent("读取失败");
    } finally {
      setLoading(false);
    }
  };

  const openSkillName = SKILL_CATALOG.find((s) => s.id === openId)?.name ?? "";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          精选 Skill 配置
        </h1>
        <p className="mt-2 text-muted-foreground">
          已接入构建流程的精选 Skill 与视觉 / 动效资源，可在搭建与生成时按需调用。更广的素材采集见顶栏「知识库」。
        </p>
      </div>

      {/* 分类筛选 */}
      <div className="mt-6 flex flex-wrap gap-2">
        {(["all", ...SKILL_CATEGORIES.map((c) => c.id), "visual-library", "motion-resource"] as CategoryId[]).map(
          (cat) => {
            const active = activeCat === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCat(cat)}
                className={[
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary",
                ].join(" ")}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            );
          },
        )}
      </div>

      {/* 卡片网格 */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {activeCat === "visual-library"
          ? VISUAL_LIBRARY.map((lib) => {
              const styles = getLibraryStyles(lib.id);
              const cover = styles[0]?.palette;
              return (
                <div
                  key={lib.id}
                  className="flex flex-col rounded-xl border border-border bg-card p-4"
                >                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-foreground">{lib.name}</h3>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {LIBRARY_CATEGORY_LABELS[lib.category]}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">
                    {lib.description}
                  </p>
                  {cover && (
                    <div className="mt-3 flex gap-1">
                      {[cover.bg, cover.surface, cover.accent, cover.accent2, cover.text].map(
                        (c, i) => (
                          <span
                            key={i}
                            className="h-5 w-5 rounded border border-border"
                            style={{ background: c }}
                          />
                        ),
                      )}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-muted-foreground">
                    包含风格：{styles.map((s) => s.name).join("、")}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {lib.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                  <a
                    href={lib.officialUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    官网
                    <ArrowUpRight className="size-3.5" />
                  </a>
                </div>
              );
            })
          : activeCat === "motion-resource"
          ? MOTION_RESOURCES.map((r) => (
              <div
                key={r.id}
                className="flex flex-col rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground">{r.name}</h3>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {r.kind === "local" ? "本地资源" : "开源仓库"}
                  </span>
                </div>
                <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">
                  {r.description}
                </p>
                {r.kind === "local" && r.localPath && (
                  <div className="mt-3 font-mono text-xs text-muted-foreground">
                    {r.localPath}
                  </div>
                )}
                {r.items && r.items.length > 0 && (
                  <div className="mt-3 flex flex-col gap-1.5">
                    {r.items.map((it) => (
                      <div
                        key={it.file}
                        className="flex items-center justify-between gap-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs"
                      >
                        <span className="text-foreground">{it.name}</span>
                        <span className="font-mono text-muted-foreground">{it.file}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
                {r.kind === "external" && r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    仓库地址
                    <ArrowUpRight className="size-3.5" />
                  </a>
                )}
              </div>
            ))
          : filtered.map((s) => (
              <div
                key={s.id}
                className="flex flex-col rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground">{s.name}</h3>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {CATEGORY_LABELS[s.category]}
                  </span>
                </div>
                <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">
                  {s.description}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground">
                    {s.fileType}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {s.filePath}
                  </span>
                </div>
                {s.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={() => openSkill(s.id)}
                >
                  查看 SKILL.md
                  <ArrowUpRight className="size-3.5" />
                </Button>
              </div>
            ))}
      </div>

      {/* 弹窗：SKILL.md 内容 */}
      {openId && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpenId(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-background"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="font-semibold text-foreground">{openSkillName}</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpenId(null)}
                aria-label="关闭"
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="overflow-auto p-5">
              {loading ? (
                <p className="text-sm text-muted-foreground">加载中…</p>
              ) : (
                <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground">
                  {content}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
