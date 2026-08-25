"use client";

import { useMemo } from "react";
import {
  KNOWLEDGE_RELATION_META,
  type KnowledgeEntry,
  type KnowledgeRelationType,
} from "@/lib/knowledge-types";

// 关系类型 → 语义色（图谱内固定，保证可读性；不跟随主题主色）
const REL_COLOR: Record<KnowledgeRelationType, string> = {
  depends: "#ef4444",
  extends: "#3b82f6",
  example: "#22c55e",
  alternative: "#f59e0b",
  contrasts: "#a855f7",
};
const WEAK_COLOR = "#94a3b8";

const REL_LABEL: Record<KnowledgeRelationType, string> = {
  depends: "依赖",
  extends: "延伸",
  example: "案例",
  alternative: "替代",
  contrasts: "对比",
};

const REL_ORDER: KnowledgeRelationType[] = [
  "depends",
  "extends",
  "example",
  "alternative",
  "contrasts",
];

interface GraphNode {
  id: string;
  name: string;
  type: KnowledgeEntry["type"];
  x: number;
  y: number;
  isCenter?: boolean;
  rel?: KnowledgeRelationType | "related";
  relNote?: string;
}

interface GraphEdge {
  from: string;
  to: string;
  rel: KnowledgeRelationType | "related";
  note?: string;
}

/** 按 name / 去前缀 name / slug 匹配条目（frontmatter 关系字段可能用其中任意一种） */
function findByName(entries: KnowledgeEntry[], name: string): KnowledgeEntry | undefined {
  return entries.find(
    (e) =>
      e.name === name ||
      e.name.replace(/^.*?·\s*/, "") === name ||
      e.slug === name,
  );
}

function entryRelations(e: KnowledgeEntry): { to: string; rel: KnowledgeRelationType }[] {
  const out: { to: string; rel: KnowledgeRelationType }[] = [];
  for (const rel of REL_ORDER) {
    const list = e[rel];
    if (Array.isArray(list)) {
      for (const t of list) out.push({ to: t, rel });
    }
  }
  return out;
}

/** 局部图谱：中心条目 + 按关系类型分组的关联节点（环形布局） */
function buildLocalGraph(
  entries: KnowledgeEntry[],
  center: KnowledgeEntry,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const cx = 150;
  const cy = 150;
  const radius = 108;

  nodes.push({ id: center.slug, name: center.name, type: center.type, x: cx, y: cy, isCenter: true });

  // 收集强关系 + 弱关系（related）
  const strong = entryRelations(center);
  const weak = (center.related ?? []).map((t) => ({ to: t, rel: "related" as const }));

  // 按类型分组（强关系在前，弱关系最后）
  const groups = new Map<string, { to: string; rel: KnowledgeRelationType | "related" }[]>();
  for (const rel of REL_ORDER) groups.set(rel, []);
  groups.set("related", []);
  for (const s of strong) groups.get(s.rel)?.push(s);
  for (const w of weak) groups.get("related")?.push(w);

  const activeGroups = [...groups.entries()].filter(([, list]) => list.length > 0);
  const total = activeGroups.reduce((n, [, list]) => n + list.length, 0);
  if (total === 0) return { nodes, edges };

  // 每个节点占一个角度槽，按组连续排布
  const slotAngle = (Math.PI * 2) / total;
  let slot = 0;
  for (const [rel, list] of activeGroups) {
    for (const item of list) {
      const angle = -Math.PI / 2 + slotAngle * (slot + 0.5);
      const target = findByName(entries, item.to);
      const id = target?.slug ?? `missing:${item.to}`;
      nodes.push({
        id,
        name: target?.name ?? item.to,
        type: target?.type ?? "reference",
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        rel: item.rel,
        relNote: item.rel !== "related" ? (center[`${item.rel}Note` as keyof KnowledgeEntry] as string | undefined) : undefined,
      });
      edges.push({
        from: center.slug,
        to: id,
        rel: item.rel,
        note: item.rel !== "related" ? (center[`${item.rel}Note` as keyof KnowledgeEntry] as string | undefined) : undefined,
      });
      slot++;
    }
  }

  return { nodes, edges };
}

/** 全局图谱：全部条目节点（按类型分组网格）+ 关系边 */
function buildGlobalGraph(entries: KnowledgeEntry[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const byType = new Map<string, KnowledgeEntry[]>();
  for (const e of entries) {
    const list = byType.get(e.type) ?? [];
    list.push(e);
    byType.set(e.type, list);
  }

  const colW = 96;
  const rowH = 44;
  const padX = 48;
  const padY = 36;
  let maxCols = 0;
  let col = 0;
  let row = 0;
  for (const [type, list] of byType) {
    void type;
    list.forEach((e, i) => {
      const c = i % 5;
      const r = Math.floor(i / 5);
      nodes.push({
        id: e.slug,
        name: e.name,
        type: e.type,
        x: padX + c * colW,
        y: padY + r * rowH,
      });
      maxCols = Math.max(maxCols, c + 1);
      col = Math.max(col, c);
      row = Math.max(row, r);
    });
  }
  void col;

  // 关系边：强关系 + 弱关系
  const idByName = new Map<string, string>();
  for (const e of entries) idByName.set(e.name, e.slug);
  const seen = new Set<string>();
  for (const e of entries) {
    for (const { to, rel } of entryRelations(e)) {
      const target = findByName(entries, to);
      if (!target) continue;
      const key = [e.slug, target.slug].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({
        from: e.slug,
        to: target.slug,
        rel,
        note: (e[`${rel}Note` as keyof KnowledgeEntry] as string | undefined) ?? undefined,
      });
    }
    for (const t of e.related ?? []) {
      const target = findByName(entries, t);
      if (!target) continue;
      const key = [e.slug, target.slug].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: e.slug, to: target.slug, rel: "related" });
    }
  }

  return { nodes, edges };
}

function edgeStyle(rel: KnowledgeRelationType | "related") {
  if (rel === "related") {
    return { stroke: WEAK_COLOR, strokeWidth: 1, strokeDasharray: "3 3", opacity: 0.55 };
  }
  const meta = KNOWLEDGE_RELATION_META.find((m) => m.id === rel);
  const color = REL_COLOR[rel];
  return {
    stroke: color,
    strokeWidth: 1.6,
    strokeDasharray: rel === "contrasts" ? "5 3" : rel === "alternative" ? "2 2" : undefined,
    opacity: 0.8,
    markerEnd: meta?.directed ? `url(#arrow-${rel})` : undefined,
  };
}

function nodeColor(type: KnowledgeEntry["type"]): string {
  switch (type) {
    case "skill":
      return "#3b82f6";
    case "service":
      return "#10b981";
    case "repository":
      return "#f59e0b";
    case "prompt":
      return "#8b5cf6";
    case "pattern":
      return "#ef4444";
    case "design":
      return "#ec4899";
    default:
      return "#64748b";
  }
}

export function KnowledgeGraph({
  entries,
  center,
  onSelect,
  height = 320,
}: {
  entries: KnowledgeEntry[];
  center?: KnowledgeEntry;
  onSelect?: (e: KnowledgeEntry) => void;
  height?: number;
}) {
  const { nodes, edges } = useMemo(
    () => (center ? buildLocalGraph(entries, center) : buildGlobalGraph(entries)),
    [entries, center],
  );

  const nodeById = useMemo(() => {
    const m = new Map<string, KnowledgeEntry>();
    for (const e of entries) m.set(e.slug, e);
    return m;
  }, [entries]);

  if (nodes.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        暂无关联条目
      </div>
    );
  }

  const width = center ? 300 : 480;
  const W = width;
  // 全局图谱按行数动态计算高度，避免底部节点被裁剪
  const rows = center ? 1 : Math.ceil(nodes.length / 5);
  const H = center ? height : Math.max(height, 36 + (rows - 1) * 44 + 44);

  return (
    <div className="w-full overflow-hidden rounded-[var(--radius)] border border-border bg-muted/20">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        style={{ height }}
        role="img"
        aria-label={center ? `${center.name} 的关联图谱` : "知识库全局图谱"}
      >
        <defs>
          {REL_ORDER.map((rel) => (
            <marker
              key={rel}
              id={`arrow-${rel}`}
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L8,4 L0,8 z" fill={REL_COLOR[rel]} />
            </marker>
          ))}
        </defs>

        {/* 边 */}
        {edges.map((e, i) => {
          const from = nodes.find((n) => n.id === e.from);
          const to = nodes.find((n) => n.id === e.to);
          if (!from || !to) return null;
          const style = edgeStyle(e.rel);
          return (
            <g key={`e${i}`}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
                strokeDasharray={style.strokeDasharray}
                opacity={style.opacity}
                markerEnd={style.markerEnd}
              />
            </g>
          );
        })}

        {/* 节点 */}
        {nodes.map((n) => {
          const entry = nodeById.get(n.id);
          const fill = n.isCenter ? "var(--primary)" : nodeColor(n.type);
          const isMissing = !entry;
          const maxLen = center ? 16 : 9;
          const label = n.name.length > maxLen ? n.name.slice(0, maxLen) + "…" : n.name;
          return (
            <g
              key={n.id}
              transform={`translate(${n.x},${n.y})`}
              className="cursor-pointer"
              onClick={() => {
                if (entry && onSelect) onSelect(entry);
              }}
            >
              <title>{n.name}</title>
              <circle
                r={n.isCenter ? 13 : 9}
                fill={isMissing ? "#cbd5e1" : fill}
                stroke="#fff"
                strokeWidth={1.5}
                opacity={isMissing ? 0.5 : 1}
              />
              <text
                y={n.isCenter ? 30 : 22}
                textAnchor="middle"
                fontSize={n.isCenter ? 11 : 9.5}
                fontWeight={n.isCenter ? 700 : 500}
                fill="var(--foreground)"
                className="select-none"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* 图例 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-3 py-1.5">
        {REL_ORDER.map((rel) => (
          <span key={rel} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <span
              className="inline-block h-1.5 w-3 rounded-full"
              style={{ background: REL_COLOR[rel] }}
            />
            {REL_LABEL[rel]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="inline-block h-1.5 w-3 rounded-full" style={{ background: WEAK_COLOR }} />
          相关
        </span>
      </div>
    </div>
  );
}
