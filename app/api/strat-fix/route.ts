import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 策略两层改造的一次性迁移工具（GET 手工调用）。此前完全无鉴权，
// 任何人 curl 即可触发 wipe（清空 brain_strategies）/ alter（改表结构）/
// sources（读取用户笔记正文）——已加登录门禁 + 生产环境禁用破坏性步骤。
const DESTRUCTIVE_STEPS = new Set(["alter", "wipe"]);

export async function GET(req: Request) {
  // 门禁 1：必须登录（此前裸奔）
  const { res } = await requireUser();
  if (res) return res;

  const step = new URL(req.url).searchParams.get("step") ?? "check";

  // 门禁 2：破坏性步骤仅限非生产环境执行
  if (DESTRUCTIVE_STEPS.has(step) && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "forbidden_in_production", message: "生产环境禁止执行破坏性迁移步骤" },
      { status: 403 },
    );
  }

  try {
    if (step === "alter") {
      for (const s of [
        "ALTER TABLE brain_strategies ADD COLUMN IF NOT EXISTS parent_id text",
        "ALTER TABLE brain_strategies ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'theme'",
        "ALTER TABLE brain_strategies ADD COLUMN IF NOT EXISTS goal text",
        "ALTER TABLE brain_strategies ADD COLUMN IF NOT EXISTS rationale text",
        "ALTER TABLE brain_strategies ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0",
      ]) {
        await db.execute(sql.raw(s));
      }
      return NextResponse.json({ ok: true, step: "alter" });
    }
    if (step === "wipe") {
      const before = await db.execute(sql`select count(*)::int as n from brain_strategies`);
      await db.execute(sql`delete from brain_strategies`);
      const after = await db.execute(sql`select count(*)::int as n from brain_strategies`);
      const n = (r: unknown) => Number((r as any)?.[0]?.n ?? (r as any)?.rows?.[0]?.n ?? -1);
      return NextResponse.json({ before: n(before), after: n(after) });
    }
    if (step === "cols") {
      const rows = await db.execute(sql`
        select column_name from information_schema.columns
        where table_name = 'brain_strategies' order by ordinal_position
      `);
      return NextResponse.json({ cols: (rows as any).rows ?? rows });
    }
    if (step === "sources") {
      const rows = await db.execute(sql`
        select id, left(title, 40) as title, category, left(content, 260) as content
        from brain_notes
        where category in ('工作','策略') or title like '%会议%'
        order by created_at desc limit 6
      `);
      return NextResponse.json({ notes: (rows as any).rows ?? rows });
    }
    if (step === "organize") {
      const id = new URL(req.url).searchParams.get("id");
      const { organizeNote } = await import("@/lib/brain-organizer");
      const src = await db.execute(
        sql`select content from brain_notes where id = ${id ?? ""} limit 1`,
      );
      const content = String(((src as any).rows ?? src)[0]?.content ?? "").slice(0, 3000);
      if (!content) return NextResponse.json({ error: "no content" }, { status: 400 });
      const o = await organizeNote(content, []);
      return NextResponse.json({
        title: o.title,
        category: o.category,
        aiUsed: o.aiUsed,
        strategies: o.strategies,
        actionItems: o.actionItems,
      });
    }
    return NextResponse.json({ error: "unknown step" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 400) }, { status: 500 });
  }
}
