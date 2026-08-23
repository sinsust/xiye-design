"use client";

import { Blocks, ChevronRight } from "lucide-react";
import { useFlowStore } from "@/lib/store/flow-store";
import { VISUAL_STYLES } from "@/data/visual-styles";
import { SKELETON_PAGE_MAP } from "@/data/skeletons";

// 骨架搭建桥接页：AI 已在第 1 步回填蓝图，这里展示回填摘要，
// 一键进入骨架工作台逐块微调，或跳过直接去收尾配置。
export function Step2Skeleton() {
  const visualStyle = useFlowStore((s) => s.visualStyle);
  const techStack = useFlowStore((s) => s.techStack);
  const pageBlueprint = useFlowStore((s) => s.pageBlueprint);

  const style = visualStyle
    ? VISUAL_STYLES.find((v) => v.id === visualStyle)
    : undefined;

  // 蓝图按页面分组，展开每个页面包含的真实骨架区块（而非只列数字）
  const groups: {
    slug: string;
    name: string;
    blocks: { desc: string; variant: string; interaction?: string }[];
  }[] = [];
  const order: string[] = [];
  for (const e of pageBlueprint) {
    const page = SKELETON_PAGE_MAP[e.pageSlug];
    const comp = page?.components.find((c) => c.id === e.componentId);
    const variant = comp?.variants.find((v) => v.id === e.variantId);
    const block = {
      desc: comp?.description ?? e.componentId,
      variant: variant?.name ?? "默认变体",
      interaction: variant?.interaction,
    };
    if (!order.includes(e.pageSlug)) {
      order.push(e.pageSlug);
      groups.push({ slug: e.pageSlug, name: page?.name ?? e.pageSlug, blocks: [block] });
    } else {
      groups.find((g) => g.slug === e.pageSlug)!.blocks.push(block);
    }
  }
  const pageCount = groups.length;
  const blockCount = pageBlueprint.length;

  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          页面搭建
        </h1>
        <p className="mt-2 text-muted-foreground">
          进入页面搭建工作台逐块微调视觉风格、设计 Token、组件变体与动效。
          AI 已在第 1 步回填了页面蓝图，可直接在此基础上修改。
        </p>
      </div>

      {/* 回填摘要 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">视觉风格</p>
          {style ? (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="flex shrink-0 gap-0.5">
                {[style.palette.accent, style.palette.accent2, style.palette.surface, style.palette.text].map((c, i) => (
                  <span key={i} className="size-3 rounded-full border border-black/10" style={{ background: c }} />
                ))}
              </span>
              <span className="truncate text-sm font-semibold text-foreground">{style.name}</span>
            </div>
          ) : (
            <p className="mt-1.5 text-sm text-muted-foreground">未选择，默认风格</p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">技术栈</p>
          <p className="mt-1.5 truncate text-sm font-semibold text-foreground">
            {techStack ?? "默认（Next.js + Supabase）"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">蓝图覆盖</p>
          <p className="mt-1.5 text-sm font-semibold text-foreground">
            {pageCount} 页 · {blockCount} 区块
          </p>
        </div>
      </div>

      {/* 蓝图清单：单一容器 + 页面间分割线，避免卡片套卡片 */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <Blocks className="size-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">AI 已回填的页面蓝图</span>
          <span className="text-xs text-muted-foreground">{pageCount} 页 · {blockCount} 区块</span>
        </div>
        {pageBlueprint.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            蓝图暂为空，先进页面搭建工作台挑选组件加入蓝图。
          </p>
        ) : (
          <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
            {groups.map((g) => (
              <details key={g.slug} className="group" open>
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3">
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{g.name}</span>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {g.blocks.length} 区块
                  </span>
                </summary>
                <ul className="space-y-2.5 px-4 pb-4 pl-10">
                  {g.blocks.map((b, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/50" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-foreground">{b.desc}</span>
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                            {b.variant}
                          </span>
                        </div>
                        {b.interaction && (
                          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{b.interaction}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}