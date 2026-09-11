"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">页面出错了</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {error?.message || "发生了一个意外错误，请稍后重试。"}
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>重试</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/")}>
          返回首页
        </Button>
      </div>
    </div>
  );
}
