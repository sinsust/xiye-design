"use client";

import { useEffect, useRef } from "react";
import { useThemePaletteStore } from "@/lib/use-theme-palette";
import { AUTH_CHANGED_EVENT } from "@/lib/auth-events";

interface UiPreferences {
  theme: string;
  activeStyleId: string;
  custom: Record<string, any>;
}

/**
 * 登录后把本地的 UI 视觉偏好（主题明暗 + 配色预设/覆盖）同步到服务端，并在登录时拉取恢复。
 * 常驻于全局导航栏；复用 AUTH_CHANGED_EVENT，登录/登出时自动启停。
 */
export function UiPrefsSync() {
  const enabled = useRef(false);
  const suppress = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let disposed = false;

    function persist() {
      if (!enabled.current) return;
      if (suppress.current) {
        suppress.current = false;
        return;
      }
      const s = useThemePaletteStore.getState();
      const theme =
        document.documentElement.classList.contains("dark") ? "dark" : "light";
      fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme,
          activeStyleId: s.activeStyleId,
          custom: s.custom,
        }),
      }).catch(() => {
        /* 忽略网络错误，后续变更会再次尝试 */
      });
    }

    function schedulePersist() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(persist, 600);
    }

    function apply(p: UiPreferences) {
      suppress.current = true;
      document.documentElement.classList.toggle("dark", p.theme === "dark");
      try {
        localStorage.setItem("theme", p.theme);
      } catch {
        /* ignore */
      }
      useThemePaletteStore.setState({
        activeStyleId: p.activeStyleId,
        custom: p.custom ?? {},
      });
    }

    async function init() {
      let loggedIn = false;
      try {
        const r = await fetch("/api/auth/me");
        if (r.ok) {
          const d = await r.json();
          loggedIn = Boolean(d?.user);
        }
      } catch {
        /* ignore */
      }
      if (disposed) return;
      if (!loggedIn) {
        enabled.current = false;
        return;
      }
      enabled.current = true;
      try {
        const r = await fetch("/api/user/preferences");
        if (r.ok) {
          const d = (await r.json()) as { preference: UiPreferences | null };
          if (d.preference) apply(d.preference);
          else persist(); // 首次登录：把当前本地偏好上传云端
        }
      } catch {
        /* ignore */
      }
    }

    init();

    const unsubStore = useThemePaletteStore.subscribe(schedulePersist);
    // 明暗切换直接改 html class，用 MutationObserver 捕获
    const observer = new MutationObserver(schedulePersist);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    window.addEventListener(AUTH_CHANGED_EVENT, init);

    return () => {
      disposed = true;
      unsubStore();
      observer.disconnect();
      window.removeEventListener(AUTH_CHANGED_EVENT, init);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return null;
}