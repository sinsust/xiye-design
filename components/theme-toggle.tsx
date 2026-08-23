"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* localStorage 不可用时静默忽略 */
    }
    setDark(next);
  };

  return (
    <Button variant="ghost" size="sm" nativeButton onClick={toggle} aria-label="切换主题">
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}