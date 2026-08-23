import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 本地开发仍可能静态解析到 better-sqlite3，显式声明为外部包，
  // 避免其原生绑定被打包进 server bundle（线上走 Supabase 时本就不会加载）。
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
