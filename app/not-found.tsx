"use client";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">页面不存在</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          你访问的页面可能已被移动或删除。
        </p>
      </div>
      <Button variant="outline" onClick={() => (window.location.href = "/")}>
        返回首页
      </Button>
    </div>
  );
}
