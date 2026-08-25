// 统一读取 Supabase 连接凭据。anon key 可公开（浏览器可用），service_role 仅服务端。
function required(name: string, val?: string): string {
  if (!val) {
    throw new Error(
      `缺少环境变量 ${name}。请在 .env.local 补上 Supabase 认证配置后再使用。`,
    );
  }
  return val;
}

export const supabaseEnv = {
  get url() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get anonKey() {
    return required(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  },
  get serviceRoleKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  },
};