// B1 · 历史偏好注入：从用户已保存的项目快照中确定性统计常用技术栈 / 视觉风格 / UI 主库 /
// 项目类型 / AI 能力，作为新项目访谈的「推荐底座」注入给 LLM（可解释、可覆盖，不强制）。
//
// 仅服务端使用（读 DB，绝不进入客户端 bundle）。

import { db, projects } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import { TECH_STACKS } from "@/data/tech-stacks";
import { VISUAL_STYLE_MAP } from "@/data/visual-styles";
import { UI_LIBRARIES } from "@/data/ui-libraries";
import { PROJECT_TYPES } from "@/data/project-types";
import { AI_CAPABILITIES } from "@/data/ai-capabilities";

export interface ProjectPreferences {
  /** 最常用技术栈 id */
  techStack: string | null;
  /** 最常用视觉风格 id */
  visualStyle: string | null;
  /** 最常用 UI 主库 id */
  uiLibraryMain: string | null;
  /** 高频 AI 能力 id（最多 3 个，按出现频率） */
  aiCapabilities: string[];
  /** 最常用项目类型 id */
  projectType: string | null;
  /** 参与统计的已保存项目数 */
  sampleCount: number;
}

function mostFrequent(values: (string | null | undefined)[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

/** 从 projects 表读取用户最近的项目快照，统计偏好；无可用偏好时返回 null（调用方静默忽略） */
export async function loadProjectPreferences(
  userId: string,
  limit = 8,
): Promise<ProjectPreferences | null> {
  let rows: { data: string }[];
  try {
    rows = await db
      .select({ data: projects.data })
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.updatedAt))
      .limit(limit);
  } catch {
    // DB 不可用（如本地库未初始化）不应阻断访谈，返回 null 走无偏好路径
    return null;
  }

  const techStack: (string | null)[] = [];
  const visualStyle: (string | null)[] = [];
  const uiLibraryMain: (string | null)[] = [];
  const projectType: (string | null)[] = [];
  const aiCapabilities: string[] = [];
  let parsedCount = 0;

  for (const r of rows) {
    try {
      const d = JSON.parse(r.data) as Record<string, unknown>;
      if (!d || typeof d !== "object") continue;
      // 只统计 flow 工作流快照（builder 快照缺这些字段，跳过；解析失败也跳过）
      techStack.push(typeof d.techStack === "string" ? d.techStack : null);
      visualStyle.push(typeof d.visualStyle === "string" ? d.visualStyle : null);
      const lib = d.uiLibrary as { main?: unknown } | null | undefined;
      uiLibraryMain.push(
        lib && typeof lib.main === "string" ? lib.main : null,
      );
      projectType.push(typeof d.projectType === "string" ? d.projectType : null);
      if (Array.isArray(d.aiCapabilities)) {
        for (const c of d.aiCapabilities) {
          if (typeof c === "string") aiCapabilities.push(c);
        }
      }
      parsedCount++;
    } catch {
      /* 单条快照解析失败不影响统计 */
    }
  }

  if (!parsedCount) return null;

  // AI 能力按出现频率去重取前 3
  const capCounts = new Map<string, number>();
  for (const c of aiCapabilities) capCounts.set(c, (capCounts.get(c) ?? 0) + 1);
  const topCaps = [...capCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id);

  const prefs: ProjectPreferences = {
    techStack: mostFrequent(techStack),
    visualStyle: mostFrequent(visualStyle),
    uiLibraryMain: mostFrequent(uiLibraryMain),
    aiCapabilities: topCaps,
    projectType: mostFrequent(projectType),
    sampleCount: parsedCount,
  };

  const hasAny =
    prefs.techStack ||
    prefs.visualStyle ||
    prefs.uiLibraryMain ||
    prefs.aiCapabilities.length > 0 ||
    prefs.projectType;
  return hasAny ? prefs : null;
}

// ───────────────────────── 可读化（id → 名称） ─────────────────────────

function nameOf(entries: { id: string; name: string }[], id: string | null): string | null {
  if (!id) return null;
  return entries.find((e) => e.id === id)?.name ?? id;
}

/** 把偏好格式化为注入 system prompt 的中文段落（LLM 可读、可解释） */
export function formatPreferencesBlock(prefs: ProjectPreferences): string {
  const lines: string[] = [];
  const stack = nameOf(TECH_STACKS, prefs.techStack);
  const style = prefs.visualStyle ? (VISUAL_STYLE_MAP[prefs.visualStyle]?.name ?? prefs.visualStyle) : null;
  const lib = nameOf(UI_LIBRARIES, prefs.uiLibraryMain);
  const type = nameOf(PROJECT_TYPES, prefs.projectType);
  const caps = prefs.aiCapabilities
    .map((id) => nameOf(AI_CAPABILITIES, id))
    .filter((x): x is string => !!x);

  if (stack) lines.push(`- 常用技术栈：${stack}`);
  if (style) lines.push(`- 常用视觉风格：${style}`);
  if (lib) lines.push(`- 常用 UI 主库：${lib}`);
  if (type) lines.push(`- 常做产品类型：${type}`);
  if (caps.length) lines.push(`- 高频 AI 能力：${caps.join("、")}`);
  if (!lines.length) return "";

  return [
    `\n\n【用户历史偏好（确定性统计，来自其最近 ${prefs.sampleCount} 个已保存项目；仅作推荐底座，用户可覆盖）】`,
    ...lines,
    `使用规则：推荐技术栈 / 视觉风格 / UI 主库 / AI 能力时，优先考虑与历史偏好一致（用户大概率更接受熟悉的选择）；但如果当前产品业务明显需要更契合的其他选择，以业务契合为准，并在 summary 或 reply 中用一句话说明为什么这次没有沿用历史偏好。`,
  ].join("\n");
}

/** 前端提示条的短摘要（如「常用技术栈 · 视觉风格」） */
export function formatPreferencesSummary(prefs: ProjectPreferences): string {
  const parts: string[] = [];
  const stack = nameOf(TECH_STACKS, prefs.techStack);
  const style = prefs.visualStyle ? (VISUAL_STYLE_MAP[prefs.visualStyle]?.name ?? prefs.visualStyle) : null;
  const lib = nameOf(UI_LIBRARIES, prefs.uiLibraryMain);
  if (stack) parts.push(`技术栈 ${stack}`);
  if (style) parts.push(`风格 ${style}`);
  if (lib) parts.push(`UI 库 ${lib}`);
  return parts.length ? parts.join(" · ") : "常用选型";
}
