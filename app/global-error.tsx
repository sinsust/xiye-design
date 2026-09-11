"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // 根布局可能已崩溃，这里用内联样式自包含，避免依赖任何主题/CSS 变量
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0f172a",
          color: "#e2e8f0",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
            应用出错了
          </h2>
          <p style={{ fontSize: "0.875rem", opacity: 0.8, marginBottom: "1.5rem" }}>
            {error?.message || "发生了一个意外错误，请稍后重试。"}
          </p>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                border: "1px solid #334155",
                background: "#1e293b",
                color: "#e2e8f0",
                cursor: "pointer",
              }}
            >
              重试
            </button>
            <a
              href="/"
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                border: "1px solid #38bdf8",
                background: "#0ea5e9",
                color: "white",
                textDecoration: "none",
              }}
            >
              返回首页
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
