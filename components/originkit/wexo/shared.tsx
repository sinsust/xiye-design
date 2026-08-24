'use client';

// Wexo 整站区块统一渲染器：fetch 对应片段 HTML，链接共享 framer.css，
// 用 dangerouslySetInnerHTML 还原 Originkit Framer 原版视觉与 CSS 动效/交互。
// framer.css（以及片段里的 ssr-variant 副本)采用 Framer SSR 响应式变体机制：
// 同一节点在不同 breakpoint 下有多份 <div class="ssr-variant hidden-X ..."> 副本，
// 通过 hidden-<breakpoint> 类 + 根容器变体类决定显隐。切片单独渲染时若不清理，
// 多份副本会同时显示造成重叠/错位，因此按当前预览宽度保留一份并清除其余副本。
import { useEffect, useMemo, useRef, useState } from "react";

export const SECTION_BASE = "/originkit/wexo/sections";

// Wexo 整站的全部区块 slug（用于整站整合导出），顺序与组件库注册一致
export const WEXO_SLUGS = [
  "hero",
  "product-overview",
  "how-to-use",
  "user-feedback",
  "pricing",
  "unique-feature",
  "about-us",
  "comparison",
  "our-team",
  "blogs",
  "testimonials",
  "cta",
] as const;

// Framer breakpoint 变体 -> 触发宽度（来自完整页 data-framer-ssr 元数据）
export const VARIANTS = ["72rtr7", "etlivf", "1e8ith3"] as const;
export type Variant = (typeof VARIANTS)[number];

export function variantForWidth(w: number): Variant {
  return w >= 1320 ? "72rtr7" : w >= 810 ? "etlivf" : "1e8ith3";
}

// 保留当前 breakpoint 变体副本，删除其余 SSR 响应式副本并清除残留 hidden-* 类
export function cleanVariants(html: string, target: Variant): string {
  if (!html) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const nodes = doc.body.querySelectorAll<HTMLElement>("*");
  for (const el of Array.from(nodes)) {
    const hidden = VARIANTS.filter((v) => el.classList.contains(`hidden-${v}`));
    if (hidden.length === 0) continue;
    if (el.classList.contains("ssr-variant")) {
      // 多副本容器：命中目标变体则保留（转为可见），否则整份删除
      if (hidden.includes(target)) {
        el.remove();
      } else {
        hidden.forEach((v) => el.classList.remove(`hidden-${v}`));
      }
    } else if (!hidden.includes(target)) {
      // 独立节点：目标变体命中则维持隐藏，否则去除其余变体的隐藏类
      hidden.forEach((v) => el.classList.remove(`hidden-${v}`));
    }
  }
  return doc.body.innerHTML;
}

export function WexoSection({ slug }: { slug: string }) {
  const [html, setHtml] = useState<string>("");
  const [err, setErr] = useState(false);
  const [width, setWidth] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setHtml("");
    setErr(false);
    fetch(`${SECTION_BASE}/${slug}.html`)
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((t) => alive && setHtml(t))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [slug]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    // 初始宽度（挂载时 offsetWidth 已可用）
    const w0 = el.offsetWidth;
    if (w0) setWidth(w0);
    return () => ro.disconnect();
  }, []);

  // 无实测宽度时按桌面变体处理（预览容器 minWidth 1140，恒非手机）
  const target: Variant = width != null ? variantForWidth(width) : "72rtr7";
  const cleanHtml = useMemo(() => cleanVariants(html, target), [html, target]);

  return (
    <>
      {/* 共享 framer.css：承载 Wexo 全部 CSS 动画与交互样式 */}
      <link rel="stylesheet" href="/originkit/wexo/framer.css" />
      <div
        ref={rootRef}
        className="wexo-section-root"
        style={{ width: "100%", minWidth: 1140, overflow: "hidden" }}
      >
        {err ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            区块加载失败：/originkit/wexo/sections/{slug}.html
          </div>
        ) : (
          <div className="framer-JzUpW" dangerouslySetInnerHTML={{ __html: cleanHtml }} />
        )}
      </div>
    </>
  );
}

export default WexoSection;