import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  listBrainProjects,
  insertBrainProject,
  listBrainTasks,
  type BrainProject,
} from "@/lib/brain-db";

export const runtime = "nodejs";

/** 距今天数（可为负=已过期）。 */
function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00Z").getTime();
  const today = new Date().toISOString().slice(0, 10) + "T00:00:00Z";
  return Math.round((target - Date.parse(today)) / 86400000);
}

const STATUSES = ["active", "paused", "completed", "archived"] as const;
const PRIORITIES = ["high", "medium", "low"] as const;
function isStatus(v: unknown): v is (typeof STATUSES)[number] {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}
function isPriority(v: unknown): v is (typeof PRIORITIES)[number] {
  return typeof v === "string" && (PRIORITIES as readonly string[]).includes(v);
}
function normalizeDate(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim().slice(0, 10);
  return null;
}

// GET /api/brain/projects → 项目列表 + 任务统计
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const projects = await listBrainProjects(user.sub);
  const tasks = await listBrainTasks(user.sub);
  const rows = projects.map((p): BrainProject & {
    totalTasks: number;
    completedTasks: number;
    progress: number;
    daysRemaining: number | null;
  } => {
    const owned = tasks.filter((t) => t.projectId === p.id);
    const completed = owned.filter((t) => t.status === "done").length;
    const progress = owned.length ? Math.round((completed / owned.length) * 100) : 0;
    const daysRemaining = p.dueDate ? daysUntil(p.dueDate) : null;
    return { ...p, totalTasks: owned.length, completedTasks: completed, progress, daysRemaining };
  });
  rows.sort((a, b) => {
    const rank = (s: string) => (s === "active" ? 0 : s === "paused" ? 1 : s === "completed" ? 2 : 3);
    return rank(a.status) - rank(b.status) || a.createdAt - b.createdAt;
  });
  return NextResponse.json({ projects: rows });
}

// POST /api/brain/projects → 创建项目
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 200) : "";
  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });
  const project = await insertBrainProject(user.sub, {
    name,
    description: typeof body?.description === "string" ? body.description.slice(0, 2000) || null : null,
    status: isStatus(body?.status) ? body.status : "active",
    priority: isPriority(body?.priority) ? body.priority : "medium",
    objective: typeof body?.objective === "string" ? body.objective.slice(0, 2000) || null : null,
    color: typeof body?.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(body.color) ? body.color : "#3B82F6",
    startDate: normalizeDate(body?.startDate),
    dueDate: normalizeDate(body?.dueDate),
  });
  if (!project) return NextResponse.json({ error: "create_failed" }, { status: 500 });
  return NextResponse.json({ project });
}