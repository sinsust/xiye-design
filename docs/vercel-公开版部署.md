# Vercel 公开版部署手册（路线 A：最小可用公开版）

> 适用目标：把 xiye 从「桌面单机（形态 C）」搬到 Vercel，让其他人通过域名访问使用。
> 设计原则：**BYOK（用户自带 API Key）+ 邀请码门户 + 服务端签名 cookie 身份**，平台不垫 LLM 费用、不建账号体系。

---

## 一、部署模式开关

一个 env 决定两套行为，**不设即完全等同现在的桌面单机**（本地开发零变化）：

| `DEPLOY_MODE` | 行为 |
|---|---|
| 未设置 / `local` | 免登录；档案由前端 cookie 自由切换；无签名校验 |
| `public` | 邀请码门户 `/enter`；档案 cookie 必须服务端 HMAC 签名；未认证一律拦截 |

⚠️ 客户端组件也要读这个开关（隐藏 ima / Obsidian 等桌面入口），所以线上**两个变量都要设**：

```bash
DEPLOY_MODE=public
NEXT_PUBLIC_DEPLOY_MODE=public
```

（只设 `NEXT_PUBLIC_DEPLOY_MODE=public` 也行，服务端两个都认。）

---

## 二、必需环境变量（Vercel → Settings → Environment Variables）

| 变量 | 必填 | 说明 / 缺失后果 |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase **事务池 6543**（不是 5432）。见第四节 |
| `DEPLOY_MODE` | ✅ | `public` |
| `NEXT_PUBLIC_DEPLOY_MODE` | ✅ | `public`（客户端 bundle 只认这个前缀） |
| `PROFILE_HMAC_KEY` | ✅ | ≥32 字符随机串。缺失 → 验签直接抛错，**绝不静默放行** |
| `IMA_ENC_KEY` | ✅ | ≥32 字符。注意：**LLM API Key 加密复用这同一把**（`lib/llm/config-store.ts` 复用 `lib/ima-config` 的 encrypt/decrypt）。缺失 → 非 development 环境 throw，所有读写模型配置的接口全崩 |
| `ACCESS_CODE` | ✅ | 邀请码，逗号分隔可多个。**不配 = 门户拒绝任何人进入**（`access_disabled`） |
| `OBSIDIAN_AUTOSTART` | 建议 | 设 `0`。否则每次冷启动都尝试起 Obsidian watcher + 连 DB，白耗冷启动时间 |

可选（按需）：

| 变量 | 用途 |
|---|---|
| `FEISHU_APP_ID` / `FEISHU_APP_SECRET` | 飞书表格导入 |
| `FEISHU_REDIRECT_URI` / `FEISHU_FRONTEND_HOME` | 飞书 OAuth，**必须换成线上域名**并在飞书开放平台登记 |
| `EMBEDDING_ENABLED` | 关掉可省冷启动（默认行为未变） |

密钥生成：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

---

## 三、Vercel 项目设置

| 项 | 值 | 原因 |
|---|---|---|
| Framework Preset | Next.js | — |
| Node.js Version | 20.x 或 22.x | 与本地对齐 |
| **Plan** | **Pro 起步** | Hobby 函数上限 10s，而 LLM 传输超时 40s —— Hobby 上 AI 生成必被掐死 |
| Function Max Duration | 300s | 已给所有 nodejs 路由加 `export const maxDuration = 300`（门户 API 60s） |

---

## 四、数据库：Supabase（跳过就白搭）

### 4.1 连接串必须用事务池 6543

Serverless 每次并发都可能开新连接，5432 session 模式连接池上限仅 15，**必被打满**。

```
postgresql://postgres.<ref>:<密码>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

### 4.2 首次建表：必须用 5432 直连跑一次

事务池（6543）**不支持 DDL**（CREATE / ALTER）。应用内的 `reconcilePgSchema` 在 6543 上会静默失败，所以建表要手动跑一次：

```bash
# 临时用 5432 直连
export DATABASE_URL="postgresql://postgres:<密码>@db.<ref>.supabase.co:5432/postgres"
npm run db:push:pg

# 跑完把 Vercel 上的 DATABASE_URL 换回 6543
```

之后凡改过 `lib/db/schema.pg.ts` 的字段，都要重跑一次。

---

## 五、公开版自动隐藏的功能（代码保留，桌面端不受影响）

| 入口 | 位置 | 原因 |
|---|---|---|
| ima 导入按钮 + 导入弹窗 | 第二大脑顶部 | 需本机安装 ima 客户端 |
| ima 凭证绑定卡 | 设置页 | 同上，且凭证按档案 id 可枚举冒用 |
| 笔记「写回 ima」 | 笔记卡片 | ima 未绑定则不出现 |
| Obsidian 同步设置卡 | 第二大脑 → 高级工具 | 需访问本机 vault 目录，`validateVaultPath` 会直接拒绝 |
| Obsidian 连接器行 | 设置页 → 连接器与集成 | 同上 |
| 档案切换器 | 右上角 + 设置页档案区 | public 下身份由签名 cookie 锁定，前端切换无效且会破坏签名 |
| 知识库「本地文件夹地址」 | 知识库新增/详情 | 给访客看本机绝对路径无意义 |

public 模式下右上角改为「退出」按钮（清 HttpOnly cookie → 回门户）。

---

## 六、已知限制（上线前请知悉）

| # | 限制 | 影响 |
|---|---|---|
| 1 | **限流形同虚设** | `lib/rate-limit.ts` 是进程内存计数器，serverless 多实例各自计数。AI 端点理论上可被外部刷（但刷的是用户自己的 key） |
| 2 | 品牌 zip 打包占 `/tmp` | `brand-pack.ts` 整站 `cpSync` 到临时目录，Vercel `/tmp` 512MB 上限，含图大站可能爆 |
| 3 | 请求体 4.5MB 上限 | 大 CSV 表格上传会被 Vercel 拦 |
| 4 | 知识库内置 66 个 md | 随 repo 打包只读，内容更新 = 重新部署 |
| 5 | brain ask 全量内存检索 | 数据量涨后变慢（多用户场景更明显） |
| 6 | 单密钥边界 | `IMA_ENC_KEY` 一把全局密钥加密所有人的 LLM key 与 ima 凭证。PG 库泄漏 = 全员 key 可解密 |
| 7 | 国内访问 | Vercel 海外节点速度不稳；自有域名面向国内用户涉及备案问题 |
| 8 | `middleware.ts` 在 Next 16 已废弃 | 启动日志会警告 `The "middleware" file convention is deprecated. Please use "proxy" instead.`。当前 16.2.11 仍可用（框架内部已按 proxy 处理），但升级大版本前需改名为 `proxy.ts` |

---

## 六·五、两个已踩过的坑（改代码时别踩回去）

### 坑 1：middleware 的 matcher 不能排除 `enter`

`middleware.ts` 的 matcher 若写成 `"/((?!_next/static|_next/image|favicon.ico|enter).*)"`，
`/enter` 就完全不经过 middleware，后果有两个方向：

- **local 模式**：门户页谁都能打开，输入邀请码后 `POST /api/enter` 返回 404 `not_public` —— 一个「怎么输都失败」的死框
- **public 模式**：`/enter` 被放行但 `/` 会 307 到 `/enter`……若哪天 `/enter` 也被拦，就变成 `/` → `/enter` → `/` 无限重定向

正确写法（只排除静态资源）：

```ts
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

再由 middleware 内部显式判断：`/enter` 与 `/api/enter` 在 public 下放行、在 local 下把 `/enter` 307 回首页。

### 坑 2：`notFound()` 改不了已发出的状态码

App Router 流式 SSR 下响应头先发出，`notFound()` 只能替换渲染内容，**HTTP 状态码实测仍是 200**。
需要「明确的跳转语义」时用 `redirect()`，且**放在 middleware 里才能拿到真正的 307**
（在 page 里 `redirect()` 会渲染目标页内容但状态码仍是 200）。

---

## 七、部署步骤（ checklist ）

- [ ] Supabase 建项目，拿到 6543 事务池连接串
- [ ] 本地用 5432 直连跑一次 `npm run db:push:pg` 建表
- [ ] 生成 `PROFILE_HMAC_KEY` / `IMA_ENC_KEY` / `ACCESS_CODE`
- [ ] Vercel 导入仓库，配好第二节全部 env（`DATABASE_URL` 用 **6543**）
- [ ] Plan 升到 Pro（否则 10s 超时）
- [ ] 部署，访问 `/` → 应 307 跳 `/enter`
- [ ] 输邀请码 → 建档 + 种签名 cookie → 进入首页
- [ ] 手写一个假 cookie `xiye_profile=<别人的id>` → 应被踢回 `/enter`（验签失败）
- [ ] 退出按钮 → 清 cookie → 回门户

---

## 八、故障速查

| 现象 | 原因 / 处理 |
|---|---|
| 所有页面循环跳 `/enter` | ①`PROFILE_HMAC_KEY` 变更后旧签名失效（正常，重新输码）；② 有前端代码仍在写同名 cookie（见 `writeProfileCookie` 的 public 保护） |
| `/api/*` 全 500 `server_misconfigured` | `PROFILE_HMAC_KEY` 缺失或 <32 字符 |
| 进得去但一用 AI 就报错 | 未配模型（`model_not_configured` 412）或 `IMA_ENC_KEY` 缺失 |
| 接口报 `EMAXCONNSESSION` / 卡 60s | `DATABASE_URL` 用了 5432 → 换 6543 |
| 线上「表不存在」 | 没跑 `db:push:pg`（见 4.2） |
