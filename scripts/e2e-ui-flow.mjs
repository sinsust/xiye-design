/* 真浏览器 UI 回归（登录状态持久 + 右上角即时刷新的核心诉求）
 * 账号用 service_role 直接预建（email_confirm=true，绕过注册限流），
 * 之后全部走真实页面：登录页填表 → 头部邮箱即时显示 → 刷新持久 → 登出回首页 → 再登录。
 * 用法：node scripts/e2e-ui-flow.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium, request } from "playwright";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BASE = process.env.E2E_BASE ?? "http://localhost:3200";
const envRaw = readFileSync(path.join(root, ".env.local"), "utf8");
const env = {};
for (const line of envRaw.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;

const results = [];
let failed = 0;
function step(name, ok, info = "") {
  results.push({ name, ok: !!ok, info });
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  -- " + info : ""}`);
}

const email = `uiflow_${Date.now()}_${Math.floor(Math.random() * 1e4).toString(36)}@e2e.dev`;
const pw = "UiFlow#2026Pw";

async function headerShows(page, em) {
  const el = page.locator("button").filter({ has: page.locator(`text=${em}`) }).first();
  if ((await el.count()) === 0) return false;
  return el.isVisible().catch(() => false);
}
// 轮询等待头部出现邮箱（等待 AuthMenu 完成 fetchSession 挂载）
async function waitHeader(page, em, timeout = 20000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await headerShows(page, em).catch(() => false)) return true;
    await page.waitForTimeout(250);
  }
  return false;
}
async function dumpHeaderButtons(page, tag) {
  try {
    const texts = await page.locator("header button").allTextContents();
    console.log(`  [debug ${tag}] header buttons = ${JSON.stringify(texts.slice(0, 8))}`);
  } catch {
    console.log(`  [debug ${tag}] header read failed`);
  }
}

async function main() {
  console.log(`▶ target=${BASE}\n▶ 账号 ${email}`);
  // 用 service_role 预建确认账号（绕过注册限流）
  const admin = await request.newContext({
    baseURL: SUPABASE_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${SVC}`, apikey: SVC, "Content-Type": "application/json" },
  });
  const created = await admin.post("/auth/v1/admin/users", {
    data: { email, password: pw, email_confirm: true },
  });
  step("预建确认账号成功", created.ok(), `status=${created.status()}`);
  await admin.dispose();
  if (!created.ok()) process.exit(2);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(75000);

  // ===== 1. 登录页：真实填写并提交，头部即时显示邮箱 =====
  console.log("\n[1] 登录页 → 头部即时显示邮箱 → 进入受保护页");
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pw);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/builder/, { timeout: 75000 }).catch(() => {});
  await page.waitForTimeout(1500);
  step("登录后进入受保护页 /builder", page.url().includes("/builder"), page.url());
  const shown1 = await waitHeader(page, email);
  step("头部即时显示邮箱（登录后无需刷新）", shown1);

  // ===== 2. 刷新：会话持久 =====
  console.log("\n[2] 刷新 → 会话持久");
  await page.reload({ waitUntil: "domcontentloaded" });
  await dumpHeaderButtons(page, "after-reload");
  const shown2 = await waitHeader(page, email);
  step("刷新后头部仍显示邮箱", shown2, page.url());
  step("刷新后仍可访问 /builder（受保护页未回跳）", page.url().includes("/builder"), page.url());

  // ===== 3. 退出登录 → 回首页 =====
  console.log("\n[3] 下拉退出 → 回首页 → 头部未登录");
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const accBtn = page.locator("button").filter({ has: page.locator(`text=${email}`) }).first();
  await accBtn.click().catch(() => {});
  await page.waitForTimeout(500);
  const logoutVisible = (await page.getByRole("button", { name: /退出登录/ }).count()) > 0;
  await page.click('button:has-text("退出登录")').catch(() => {});
  const wentHome = await page
    .waitForURL((u) => u.pathname === "/", { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  await page.waitForTimeout(1000);
  const loggedOut = (await page.getByRole("button", { name: /退出登录/ }).count()) === 0
    && !(await headerShows(page, email));
  step("下拉出现「退出登录」", logoutVisible);
  step("登出后回到首页", wentHome, page.url());
  step("登出后头部未登录", loggedOut);

  // ===== 4. 再次登录（回到同一会话的持久） =====
  console.log("\n[4] 再次登录 → 头部显示邮箱");
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pw);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/builder/, { timeout: 75000 }).catch(() => {});
  await page.waitForTimeout(1200);
  step("再次登录进入受保护页", page.url().includes("/builder"), page.url());
  step("再次登录头部显示邮箱", await waitHeader(page, email));

  // ===== 5. 受保护页未登录拦截（新无痕会话） =====
  console.log("\n[5] 未登录浏览器访问 /builder → 弹登录");
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
  await p2.waitForTimeout(1200);
  step("未登录访问 /builder 被重定向到登录页", p2.url().includes("/login"), p2.url());
  await ctx2.close();

  // ===== 6. 登录页「忘记密码」入口 =====
  console.log("\n[6] 登录页「忘记密码？」入口");
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  step("登录页存在「忘记密码？」", (await page.getByText("忘记密码？").count()) > 0);

  await browser.close();
  console.log(`\n===== UI 流程汇总：${results.filter((r) => r.ok).length}/${results.length} 通过，${failed} 失败 =====`);
  if (failed) {
    results.filter((r) => !r.ok).forEach((r) => console.log(`  - ${r.name}: ${r.info}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("UI 流程异常：", e.message || e);
  process.exit(2);
});