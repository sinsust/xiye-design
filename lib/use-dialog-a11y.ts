"use client";

import { useEffect, useId, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export interface DialogA11y<T extends HTMLElement = HTMLDivElement> {
  /** 挂到 dialog 根容器（dialogProps 已含，通常无需单独使用） */
  containerRef: React.RefObject<T | null>;
  /** 挂到标题元素：`id={titleId}`，配合 aria-labelledby */
  titleId: string;
  /** 直接展开到根容器：role/aria-modal/aria-labelledby/tabIndex/ref */
  dialogProps: {
    role: "dialog";
    "aria-modal": true;
    "aria-labelledby": string;
    tabIndex: -1;
    ref: React.RefObject<T | null>;
  };
}

/**
 * 浮层（抽屉 / 模态）通用无障碍能力：
 * 1. ESC 关闭（document 级，不依赖焦点是否在浮层内）
 * 2. Tab / Shift+Tab 焦点陷阱，焦点不会跑到浮层背后的页面
 * 3. 打开时把焦点移入浮层，关闭时归还给触发元素
 * 4. 提供稳定的 titleId 供 aria-labelledby 关联
 *
 * 适用于「条件渲染（挂载即打开）」的浮层；若组件始终挂载，请用 open 参数自行控制。
 */
export function useDialogA11y<T extends HTMLElement = HTMLDivElement>(
  onClose: () => void,
): DialogA11y<T> {
  const containerRef = useRef<T | null>(null);
  const titleId = useId();

  // 用 ref 稳定 onClose：调用方常传内联箭头函数，
  // 若直接进依赖数组会每次渲染重跑 effect，导致焦点反复被抢。
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const node = containerRef.current;

    // 打开时移入焦点：优先浮层内首个可聚焦元素，否则落在容器本身
    const initial =
      node?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? node ?? null;
    initial?.focus?.();

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        onCloseRef.current();
        return;
      }
      if (ev.key !== "Tab" || !node) return;

      const items = Array.from(
        node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) {
        ev.preventDefault();
        node.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!node.contains(active)) {
        ev.preventDefault();
        (ev.shiftKey ? last : first).focus();
        return;
      }
      if (!ev.shiftKey && active === last) {
        ev.preventDefault();
        first.focus();
      } else if (ev.shiftKey && active === first) {
        ev.preventDefault();
        last.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, []);

  return {
    containerRef,
    titleId,
    dialogProps: {
      role: "dialog",
      "aria-modal": true,
      "aria-labelledby": titleId,
      tabIndex: -1,
      ref: containerRef,
    },
  };
}
