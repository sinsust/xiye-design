"use client";

import { useSkeletonStore } from "@/lib/skeleton-store";
import { DEMO_CONTENT } from "@/data/skeleton-content";
import type { ContentOverride } from "@/lib/content-resolver";

/** 动态路径访问用的扁平记录类型：标量或一层嵌套对象 */
type ContentRecord = Record<string, string | Record<string, string | undefined> | undefined>;

/** 项目文案字段：写入后会一次替换全站占位符（skeleton content） */
const CONTENT_FIELDS: { path: string; label: string; placeholder: string }[] = [
  { path: "brand", label: "品牌名", placeholder: "如 Acme / 你的产品名" },
  { path: "product", label: "产品名", placeholder: "如 Acme Cloud" },
  { path: "tagline", label: "一句话定位", placeholder: "如 为现代团队打造…" },
  { path: "cta.primary", label: "主按钮文案", placeholder: "如 免费开始" },
  { path: "cta.secondary", label: "次按钮文案", placeholder: "如 了解更多" },
  { path: "hero.heading", label: "首屏主标题", placeholder: "如 更快地构建…" },
];

/** 骨架工作台顶栏「项目文案」入口：一次替换全站占位符，改写即预览/代码/蓝图同步生效 */
export function ProjectCopyPanel() {
  const content = useSkeletonStore((s) => s.content);
  const setContent = useSkeletonStore((s) => s.setContent);

  const getContentVal = (path: string): string => {
    const [a, b] = path.split(".");
    const demo = (DEMO_CONTENT as unknown as ContentRecord)[a];
    const cur = (content as unknown as ContentRecord)[a];
    if (!b) {
      const v = typeof cur === "string" ? cur : undefined;
      const d = typeof demo === "string" ? demo : undefined;
      return v ?? d ?? "";
    }
    const cBranch = (typeof cur === "object" && cur ? cur : undefined) as
      | Record<string, string | undefined>
      | undefined;
    const dBranch = (typeof demo === "object" && demo ? demo : undefined) as
      | Record<string, string | undefined>
      | undefined;
    return cBranch?.[b] ?? dBranch?.[b] ?? "";
  };

  const setContentField = (path: string, val: string) => {
    const [a, b] = path.split(".");
    if (b) {
      const branch = ((content as unknown as ContentRecord)[a] ?? {}) as Record<string, string | undefined>;
      setContent({ [a]: { ...branch, [b]: val } } as unknown as ContentOverride);
    } else {
      setContent({ [a]: val } as unknown as ContentOverride);
    }
  };

  return (
    <div className="w-[20rem] max-w-[85vw]">
      <p className="mb-2 text-xs font-semibold text-muted-foreground">
        项目文案 <span className="ml-0.5">（一次替换全站占位符）</span>
      </p>
      <div className="space-y-2">
        {CONTENT_FIELDS.map((f) => (
          <label key={f.path} className="block">
            <span className="text-xs text-muted-foreground">{f.label}</span>
            <input
              value={getContentVal(f.path)}
              onChange={(e) => setContentField(f.path, e.target.value)}
              placeholder={f.placeholder}
              className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
            />
          </label>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        留空用默认 demo 文案；填入后预览 / 代码 / 蓝图同步生效。
      </p>
    </div>
  );
}