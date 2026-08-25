// 登录/注册迁移 Supabase Auth 的存量数据脚本。
// 对每个「仍使用业务侧 bcrypt 密码」的账号（users.password_hash 非空）：
//   1. 在 Supabase Auth 中创建该邮箱的账号（email_confirm=true，随机临时密码），拿到 auth id；
//   2. 把该用户在各子表（projects / brain_* / user_preferences / agent_settings 等）里的 user_id
//      从旧 id 整体重订为新 auth id（幂等、不丢数据）；
//   3. 建成 public.users 里 id = auth id 的 profile，password_hash 置空（密码改由 Auth 托管）；
//   4. 调用 admin generate_link 生成恢复链接并打印，供开发分发给账号所有者设置新密码。
//
// 用法：
//   node scripts/migrate-supabase-auth.mjs            # 干跑：仅打印将要发生的事，不改数据
//   node scripts/migrate-supabase-auth.mjs --apply    # 真正执行
//
// 需要环境变量：DATABASE_URL、NEXT_PUBLIC_SUPABASE_URL、NEXT_PUBLIC_SUPABASE_ANON_KEY、SUPABASE_SERVICE_ROLE_KEY
import postgres from "postgres";
import crypto from "node:crypto";

const APPLY = process.argv.includes("--apply");
const LINKS_ONLY = process.argv.includes("--links");
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SITE_ORIGIN = process.env.SITE_ORIGIN || "http://localhost:3200";

if (!process.env.DATABASE_URL || !SUPABASE_URL || !SVC) {
  console.error("[FATAL] 缺少 DATABASE_URL / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

function log(msg) {
  console.log(`[${APPLY ? "APPLY" : "DRY"}] ${msg}`);
}

async function admin(path, init) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    ...init,
    headers: {
      apikey: SVC,
      Authorization: `Bearer ${SVC}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  if (!res.ok) return { ok: false, status: res.status, body: json ?? text };
  return { ok: true, status: res.status, body: json };
}

// 找出所有通过 FK 引用 users.id 的「用户子表 + 用户列」，用于重订 key。
async function findUserChildTables(c) {
  const rows = await c`
    select
      tc.table_name,
      kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and ccu.table_name = 'users' and ccu.column_name = 'id'
      and tc.table_schema = 'public'
  `;
  return rows.map((r) => ({ table: r.table_name, column: r.column_name }));
}

// 确保 auth.users 存在该邮箱，返回 { newId, created }
async function ensureAuthUser(email) {
  const pw = crypto.randomBytes(24).toString("base64url");
  const created = await admin("/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password: pw, email_confirm: true }),
  });
  if (created.ok) {
    return { newId: created.body?.id, created: true, tempPassword: pw };
  }
  if (created.status === 422 || /already/.test(String(created.body?.msg || created.body?.code || ""))) {
    // 已存在：查列表按邮箱定位
    const list = await admin("/admin/users?per_page=1000", { method: "GET" });
    const usersArr = Array.isArray(list.body) ? list.body : list.body?.users;
    if (list.ok && Array.isArray(usersArr)) {
      const found = usersArr.find((u) => u.email && u.email.toLowerCase() === email.toLowerCase());
      if (found) return { newId: found.id, created: false, tempPassword: pw };
    }
    throw new Error(`邮箱 ${email} 已存在于 Auth 但未按邮箱定位到 id`);
  }
  throw new Error(`创建 Auth 账号失败(${created.status}): ${JSON.stringify(created.body)}`);
}

async function generateRecoveryLink(email) {
  const r = await admin("/admin/generate_link", {
    method: "POST",
    body: JSON.stringify({ type: "recovery", email }),
  });
  if (!r.ok) return null;
  const token = r.body?.hashed_token || (() => {
    const u = r.body?.action_link ? new URL(r.body.action_link) : null;
    return u ? u.searchParams.get("token") : null;
  })();
  if (!token) return null;
  // 用 token + type 构造指向自家 /auth/confirm 的链接，不依赖项目 Site URL 的重定向
  return `${SITE_ORIGIN}/auth/confirm?token=${encodeURIComponent(token)}&type=${r.body?.verification_type || "recovery"}`;
}

// 仅打印链接模式：针对已迁入 Auth 的账号再生成一次恢复链接（幂等补充用）
async function printLinksOnly(c) {
  const emails = (
    await c`select email from users where password_hash is null order by created_at`
  ).map((r) => r.email);
  if (emails.length === 0) {
    console.log("没有待打印链接的业务账号");
    return;
  }
  for (const email of emails) {
    const link = await generateRecoveryLink(email);
    if (link) console.log(`[恢复链接]\n  ${email}\n  ${link}`);
    else console.log(`[未能生成] ${email}`);
  }
}

async function main() {
  const c = postgres(process.env.DATABASE_URL, { prepare: false });
  try {
    if (LINKS_ONLY) {
      await printLinksOnly(c);
      await c.end();
      return;
    }

    // 1) password_hash 改可空（幂等）
    if (APPLY) {
      await c`alter table public.users alter column password_hash drop not null`;
      log("users.password_hash 已去除 NOT NULL 约束");
    } else {
      log("[计划] users.password_hash 去除 NOT NULL 约束");
    }

    const childTables = await findUserChildTables(c);
    log(`检测到引用 users.id 的子表：${childTables.map((t) => `${t.table}.${t.column}`).join(", ") || "（无）"}`);

    const legacy = await c`
      select id, email, created_at from users where password_hash is not null order by created_at
    `;
    log(`待迁移的存量 bcrypt 账号：${legacy.length} 个`);
    for (const u of legacy) console.log(`   - ${u.email}  (旧 id=${u.id})`);

    if (!APPLY) {
      console.log("\n[干跑完成] 未改动任何数据。确认无误后加 --apply 执行。");
      await c.end();
      return;
    }

    for (const u of legacy) {
      const oldId = u.id;
      const { newId, created } = await ensureAuthUser(u.email);
      console.log(`\n→ ${u.email}: auth id=${newId} (${created ? "新建" : "已存在"})`);

      if (`${newId}` === `${oldId}`) {
        log(`${u.email} 已是目标 id，跳过重订`);
        continue;
      }

      // 新 profile 尚未存在，而子表又通过 FK 引用 users.id：必须先建新 profile（占位邮箱
      // 避免与旧行 email 唯一冲突），再移子表，删旧行后把邮箱回填为真实值。全程一个事务保证原子。
      const dummy = `migrate+${newId}@local.invalid`;
      await c.begin(async (tx) => {
        await tx`
          insert into public.users (id, email, password_hash, created_at)
          values (${newId}, ${dummy}, null, ${u.created_at})
          on conflict (id) do nothing
        `;
        for (const { table, column } of childTables) {
          const cnt = await tx`
            update public.${tx(table)} set ${tx(column)} = ${newId} where ${tx(column)} = ${oldId}
          `;
          if (cnt.count > 0) log(`  ${table}.${column}: 迁移 ${cnt.count} 行`);
        }
        await tx`delete from public.users where id = ${oldId}`;
        await tx`update public.users set email = ${u.email} where id = ${newId}`;
      });
      log(`  完成重订：users(id=${newId}, email=${u.email})，旧 profile 已删除`);

      // 5) 生成恢复链接（供设置新密码）
      const link = await generateRecoveryLink(u.email);
      if (link) {
        console.log(`  [恢复链接] ${u.email}\n    ${link}`);
      } else {
        console.log(`  [警告] 未能为 ${u.email} 生成恢复链接，可用登录页「忘记密码」重置`);
      }
    }

    console.log("\n[完成] 存量账号已迁移到 Supabase Auth。");
  } catch (e) {
    console.error("[ERROR]", e.message || e);
    process.exit(1);
  } finally {
    await c.end();
  }
}

main();