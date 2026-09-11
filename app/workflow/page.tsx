"use client";

/**
 * 流程工作台 v2 · 多 Agent 协同工作台（统一框架版）
 *
 * 布局：顶部 4 阶段步骤条 + 内容区 + 底部步骤导航。
 * 阶段 1（collab）使用非对称布局（左对话 + 右上下双卡），由 CollabStage 自带布局；
 * 其余阶段（3col）由 Workspace 三栏母版承载。
 *
 * 红线与约定：
 * - 数据层：复用 useFlowStore 现有字段，零新增零重命名
 * - 步骤导航：store.currentStep 仍是 1..4（老 /flow），不可改；
 *   新 4 阶段由本页本地 state 管理（STEP_DEFS）
 * - 切步不丢内容：4 个阶段组件常驻挂载，仅用 display:none 切换显隐（对话等本地状态保留）
 * - 离开守卫：仅在本页，用户主动点击切换到其他顶层区域时弹出「保存草稿 / 放弃 / 取消」；
 *   刷新、flow 内部跳转、/builder、外部链接一律不弹
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Brain, FolderOpen, Info, Package, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildFlowSedimentPayload, hasFlowConclusions } from "@/lib/flow-sediment";
import { refineOverallProgress } from "@/lib/flow-refine-gate";
import { STEP_DEFS, type StepDef } from "./steps";
import { StepBar } from "./components/step-bar";
import { CollabStage } from "./components/collab-stage";
import { RefineStage } from "./components/refine-stage";
import { BuildStage } from "./components/build-stage";
import { DeliverStage } from "./components/deliver-stage";
import { LeaveDialog } from "./components/leave-dialog";

// 阶段 ↔ store.currentStep（老 /flow 的 1..4）双向映射。历史遗留顺序，语义不可改，
// 故抽成命名常量，消除散落多处的魔法数组错位（P2-⑥ 工程债清理）。
const ACTIVE_TO_CURRENT_STEP: number[] = [1, 3, 2, 4]; // active 0..3 → currentStep 1..4
const CURRENT_STEP_TO_ACTIVE: Record<number, number> = { 1: 0, 2: 2, 3: 1, 4: 3 };
const CURRENT_STEP_TO_STEP_ID: Record<number, string> = { 1: "collab", 2: "build", 3: "refine", 4: "deliver" };
import { useFlowStore } from "@/lib/store/flow-store";
import { coerceConceptBrief, getConceptReadiness } from "@/lib/flow-concept";
import { useAgentsStore } from "./agents-store";

/** 点击导航到这些顶层区域时才触发保存守卫（离开 flow） */
const GUARD_PREFIXES = ["/", "/components", "/library", "/account"];
/** 在这些区域内的跳转视为「留在流程内部」，不弹守卫 */
const STAY_PREFIXES = ["/workflow", "/builder"];

export default function FlowV2Page() {
  const [active, setActive] = useState(0);
  const [done, setDone] = useState<Set<number>>(new Set());
  // A1 阶段门禁：到达过的最远阶段下标（可自由回跳不回锁）+ 被门禁拦截时的原因提示
  const [maxReached, setMaxReached] = useState(0);
  const [gateMsg, setGateMsg] = useState<string | null>(null);
  const didInitRef = useRef(false);

  // 从 ?step= 恢复当前步骤：放在 effect 里而非 useState 初始化，
  // 避免 SSR 阶段 typeof window 为 undefined 造成的水合失配（曾导致深链一律落回第 1 步）。
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    const id = new URLSearchParams(window.location.search).get("step");
    if (id) {
      const idx = STEP_DEFS.findIndex((s) => s.id === id);
      if (idx >= 0) {
        setActive(idx);
        setMaxReached(idx);
      }
    } else {
      // 无显式 step 参数：从持久化的 store.currentStep（1..4）反推阶段，刷新/重开可续
      const cs = useFlowStore.getState().currentStep ?? 1;
      const map = CURRENT_STEP_TO_ACTIVE;
      const idx = map[Math.min(4, Math.max(1, cs))] ?? 0;
      setActive(idx);
      // 深链/续作恢复视为「曾到达」，避免恢复后的阶段条被门禁锁死
      setMaxReached(idx);
    }
  }, []);

  // 阶段 ↔ store.currentStep 双向同步，持久化以便刷新/重开后回到同一阶段
  useEffect(() => {
    const map = ACTIVE_TO_CURRENT_STEP; // active 0..3 → store currentStep 1..4
    useFlowStore.setState({ currentStep: map[active] });
  }, [active]);

  // 加载用户自定义「后宫智囊团」人设（登录则以服务端为权威合并）
  useEffect(() => {
    useAgentsStore.getState().boot();
  }, []);

  // 从「我的项目 · 打开流程草稿」进入（/workflow?pid=）：拉取并恢复 flow 状态与阶段
  useEffect(() => {
    const pid = new URLSearchParams(window.location.search).get("pid");
    if (!pid) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${pid}`);
        if (!res.ok || cancelled) return;
        const d = await res.json();
        const snapSrc =
          typeof d.project?.data === "string"
            ? JSON.parse(d.project.data)
            : d.project?.data;
        if (!snapSrc || cancelled) return;
        const st = snapSrc.flow && !snapSrc.skeleton ? snapSrc.flow : snapSrc;
        // 结构补齐：旧版本草稿的 conceptBrief 可能缺 decisions/openCriticalQuestions，
        // 恢复时补齐，避免 CollabStage 渲染期 getConceptReadiness 读取 .length 崩溃。
        if (st.conceptBrief) st.conceptBrief = coerceConceptBrief(st.conceptBrief);
        useFlowStore.setState(st);
        useFlowStore.getState().setSavedProjectId(pid);
        // 旧 currentStep 1..4 → 新 4 阶段（1 协同 / 2 搭建 / 3 完善 / 4 交付）
        const map = CURRENT_STEP_TO_ACTIVE;
        const cs = Math.min(4, Math.max(1, Number(st.currentStep ?? 1)));
        setActive(map[cs] ?? 0);
        if (!cancelled) window.history.replaceState({}, "", "/workflow");
      } catch {
        /* 恢复失败保持现状 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 步骤位置同步到查询参数（replace，不进历史栈）：刷新/重开/深链都续到当前步骤
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const id = STEP_DEFS[active].id;
    if (sp.get("step") !== id) {
      sp.set("step", id);
      history.replaceState(null, "", `${window.location.pathname}?${sp.toString()}`);
    }
  }, [active]);
  // 守卫相关
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const authedRef = useRef<boolean | null>(null);
  const router = useRouter();

  // 是否存在有效流程草稿（决定是否需要守卫/能否保存）
  const productBrief = useFlowStore((s) => s.productBrief);
  const pageBlueprint = useFlowStore((s) => s.pageBlueprint);
  const projectName = useFlowStore(
    (s) => s.productBrief?.name ?? s.projectInfo?.projectName,
  );
  const hasDraft = Boolean(
    projectName || pageBlueprint?.length || productBrief?.description || productBrief?.vision,
  );

  // —— A1 阶段门禁：进入某阶段需其前一阶段产出非空（PRD「流程清晰」）——
  // 已到达过的阶段（reachedTo）自由回跳、不回锁；门禁只拦「没到达过的前进方向」。
  const conceptBrief = useFlowStore((s) => s.conceptBrief);
  const techStack = useFlowStore((s) => s.techStack);
  const visualStyle = useFlowStore((s) => s.visualStyle);
  const panelOutput = useFlowStore((s) => s.panelOutput);
  const gates = useMemo(() => {
    // 与 collab 阶段自身按钮同一判据（getConceptReadiness().canProceed），避免两处规则不一致
    const briefReady = getConceptReadiness(conceptBrief).canProceed;
    // C2 门禁统一：refine 的「下一步」要求完善度 ≥80%（refine-stage 内部判据），
    // 这里用同一函数（lib/flow-refine-gate.ts）计算，堵住「步骤条绕过门禁」的口子
    const refineReady =
      Boolean(techStack) &&
      Boolean(visualStyle) &&
      refineOverallProgress({ productBrief, visualStyle, techStack, panelOutput }) >= 80;
    const buildReady = pageBlueprint.length > 0;
    return [
      { ok: true, reason: "" },
      { ok: briefReady, reason: "「产品创意」还有待确认项，先把方案收敛完整，再进入「方案落地」。" },
      { ok: briefReady && refineReady, reason: "先在「方案落地」确认技术栈与视觉风格、完善度达 80%（可运行一次会诊补齐），再进入「页面搭建」。" },
      { ok: briefReady && refineReady && buildReady, reason: "「页面搭建」还没有页面蓝图，先搭好至少一个页面，再进入「交付逻辑」。" },
    ];
  }, [conceptBrief, techStack, visualStyle, pageBlueprint, productBrief, panelOutput]);
  const reachedTo = Math.max(maxReached, active);

  // —— C4：产物库入口 ——
  // 中间产物（蓝图/会诊/交付件）的查看入口此前只在 collab 阶段 JSX 内，
  // 进 refine/build/deliver 后想回看必须退回流。这里给一个常驻下拉，跨阶段可达。
  const deliverArtifacts = useFlowStore((s) => s.deliverArtifacts);
  const [artifactOpen, setArtifactOpen] = useState(false);

  // —— P5-A：沉淀到第二大脑 ——
  // 只要有已确认结论即可用；点击 → 提取结论 → organize 生成待确认计划 → 跳脑机调起确认。
  const [sedimenting, setSedimenting] = useState(false);
  const [sedimentError, setSedimentError] = useState<string | null>(null);
  const hasSediment = useFlowStore((s) => hasFlowConclusions(s));
  const sedimentToBrain = useCallback(async () => {
    if (sedimenting) return;
    const store = useFlowStore.getState();
    if (!hasFlowConclusions(store)) return;
    const payload = buildFlowSedimentPayload(store);
    if (!payload.content) return;
    setSedimenting(true);
    setSedimentError(null);
    try {
      const res = await fetch("/api/brain/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: payload.content,
          source: "flow-sediment",
          preset: {
            title: payload.title,
            category: payload.category,
            tags: payload.tags,
            suggestedProjectName: payload.suggestedProjectName,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "organize_failed");
      const planId = data?.plan?.id;
      if (!planId) throw new Error("no_plan");
      // 跳脑机：打开整理工作台并自动续写该待确认计划（StructPreview 确认链）
      router.push(`/brain?tab=workbench&plan=${planId}`);
    } catch {
      setSedimentError("沉淀失败，请稍后重试");
    } finally {
      setSedimenting(false);
    }
  }, [sedimenting, router]);

  // 离开弹窗摘要数据
  const stageLabel = STEP_DEFS[active]?.label ?? "产品创意";
  const dialogRounds = useFlowStore((s) =>
    s.intentSession?.messages?.filter((m) => m.role === "user").length ?? 0,
  );
  const dialogHistory = useFlowStore((s) => s.intentSession?.messages?.length ?? 0);
  const dialogPages = useFlowStore((s) => s.pageBlueprint.length);
  const hasBrief = Boolean(productBrief?.description || productBrief?.vision);

  const markDone = useCallback((i: number) => {
    setDone((prev) => {
      if (prev.has(i)) return prev;
      const next = new Set(prev);
      next.add(i);
      return next;
    });
  }, []);

  /** 能否进入某阶段：已到达过（i <= reachedTo）放行；否则看该阶段门禁。 */
  const canEnter = useCallback(
    (i: number) => i <= reachedTo || (gates[i]?.ok ?? false),
    [reachedTo, gates],
  );

  const goTo = useCallback(
    (i: number) => {
      if (i < 0 || i >= STEP_DEFS.length || i === active) return;
      if (!canEnter(i)) {
        // 跳步拦截：不静默失败，给出「缺什么」的原因
        setGateMsg(gates[i]?.reason || "请先完成当前阶段");
        return;
      }
      if (i < active) markDone(i);
      else markDone(active);
      setActive(i);
      setMaxReached((m) => (m > i ? m : i));
      setGateMsg(null);
    },
    [active, canEnter, gates, markDone],
  );

  const onPrev = useCallback(() => setActive((a) => Math.max(0, a - 1)), []);
  const onNext = useCallback(() => goTo(active + 1), [active, goTo]);

  /** 保存当前流程快照到「我的项目」（未登录先引导登录） */
  const saveProject = useCallback(async (): Promise<"ok" | "unauthed" | "fail"> => {
    // 不做前端预检登录，交由保存接口 401 兜底，减少一次网络往返（鉴权是纯 JWT 校验）
    setSaving(true);
    try {
      const store = useFlowStore.getState();
      const snap = store.captureFlowSnapshot();
      const brief = store.productBrief;
      const name =
        brief?.name ||
        store.projectInfo?.projectName ||
        brief?.vision?.slice(0, 40) ||
        "未命名项目";
      const existing = store.savedProjectId;
      let res = existing
        ? await fetch(`/api/projects/${existing}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, data: snap }),
          })
        : await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, data: snap }),
          });
      // savedProjectId 残留/越权（PUT 404）→ 降级新建项目，避免一直保存失败
      if (existing && res.status === 404) {
        useFlowStore.setState({ savedProjectId: null });
        res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, data: snap }),
        });
      }
      if (res.status === 401) return "unauthed";
      if (!res.ok) return "fail";
      const j = await res.json();
      if (j.project?.id) store.setSavedProjectId(j.project.id);
      setLastSavedAt(Date.now());
      // 把项目 id 写进 URL（保留 step），刷新/深链都能续到同一项目
      const pid2 = j?.project?.id ?? existing;
      if (pid2) {
        const sp = new URLSearchParams(window.location.search);
        sp.set("pid", String(pid2));
        const cs2 = store.currentStep ?? 1;
        const stepIdMap = CURRENT_STEP_TO_STEP_ID;
        sp.set("step", stepIdMap[Math.min(4, Math.max(1, cs2))] ?? "collab");
        history.replaceState(null, "", `${window.location.pathname}?${sp.toString()}`);
      }
      return "ok";
    } catch {
      return "fail";
    } finally {
      setSaving(false);
    }
  }, []);

  const onTopbarSave = async () => {
    const res = await saveProject();
    setSaveMsg(res === "ok" ? "已保存" : res === "unauthed" ? "请先登录" : "保存失败");
    if (res === "unauthed") router.push("/login");
    else if (res) setTimeout(() => setSaveMsg(null), 2000);
  };

  // 自动保存：登录后，草稿内容有变化时防抖写回项目（不打扰未登录用户）
  useEffect(() => {
    if (!hasDraft) return;
    if (authedRef.current === false) return;
    const t = setTimeout(() => {
      void (async () => {
        const res = await saveProject();
        if (res === "unauthed") authedRef.current = false;
        else if (res === "ok") setSaveMsg("已保存");
        else setSaveMsg(null);
      })();
    }, 900);
    return () => clearTimeout(t);
  }, [saveProject, hasDraft]);

  const onLeaveSave = async () => {
    const t = leaveTarget ?? "/";
    const res = await saveProject();
    if (res === "ok") {
      setLeaveTarget(null);
      router.push(t);
    } else if (res === "unauthed") {
      setLeaveTarget(null);
      router.push("/login");
    } else {
      setSaveFailed(true);
    }
  };

  const onLeaveDiscard = () => {
    const t = leaveTarget ?? "/";
    setLeaveTarget(null);
    useFlowStore.getState().resetAll(1);
    useFlowStore.getState().setSavedProjectId(null);
    // 彻底清空持久层：仅 resetAll 只清内存，跳转瞬间可能被在途 AI/自动保存重新写回
    try {
      useFlowStore.persist?.clearStorage?.();
    } catch {
      /* noop */
    }
    try {
      window.localStorage.removeItem("xiye-flow-design");
    } catch {
      /* noop */
    }
    router.push(t);
  };

  /* 离开守卫：仅拦截「主动点击切换到其他顶层区域」的链接点击 */
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a) return;
      const raw = a.getAttribute("href");
      if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) return;
      let targetUrl: URL;
      try {
        targetUrl = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (targetUrl.origin !== window.location.origin) return; // 外部链接不拦截
      const path = targetUrl.pathname;
      if (path === window.location.pathname) return;
      if (STAY_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) return;
      if (!GUARD_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) return;
      if (!hasDraft) return;
      const recentlySaved = lastSavedAt && Date.now() - lastSavedAt < 5000;
      if (recentlySaved) return;
      e.preventDefault();
      e.stopPropagation();
      setSaveFailed(false);
      setLeaveTarget(path);
    };
    document.addEventListener("click", onDoc, true);
    return () => document.removeEventListener("click", onDoc, true);
  }, [hasDraft]);

  const renderStage = (s: StepDef) => {
    switch (s.id) {
      case "collab":
        return <CollabStage onAdvance={onNext} />;
      case "refine":
        return <RefineStage onAdvance={onNext} onBack={onPrev} />;
      case "build":
        return <BuildStage onAdvance={onNext} />;
      case "deliver":
        return <DeliverStage visible={active === 3} onBack={onPrev} />;
    }
  };

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          {projectName ? (
            <>
              <p
                className="max-w-[150px] truncate text-xs font-semibold text-foreground"
                title={projectName}
              >
                {projectName}
              </p>
              <span className="hidden h-4 w-px shrink-0 bg-border sm:block" />
            </>
          ) : null}
          {saving ? (
            <span className="shrink-0 text-xs text-muted-foreground">保存中…</span>
          ) : lastSavedAt ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              已保存{" "}
              {new Date(lastSavedAt).toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <StepBar active={active} done={done} onJump={goTo} maxReached={reachedTo} />
        </div>
        {/* C4：产物库——跨阶段回看中间产物的常驻入口 */}
        <div className="relative shrink-0">
          <Button
            size="icon"
            variant="outline"
            aria-label="产物库"
            aria-expanded={artifactOpen}
            title="产物库：查看各阶段已生成的中间产物"
            onClick={() => setArtifactOpen((o) => !o)}
          >
            <Package className="size-4" />
          </Button>
          {artifactOpen && (
            <>
              <button
                type="button"
                aria-label="关闭产物库"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setArtifactOpen(false)}
              />
              <div className="absolute right-0 top-10 z-50 w-72 rounded-xl border border-border bg-card p-3 shadow-xl">
                <p className="mb-2 text-xs font-semibold text-foreground">产物库</p>
                <ul className="space-y-1">
                  <ArtifactRow
                    label="方案会诊产出"
                    desc="完善度面板 · guard 检查"
                    ready={Boolean(panelOutput)}
                    onJump={() => { setArtifactOpen(false); goTo(1); }}
                  />
                  <ArtifactRow
                    label="页面蓝图"
                    desc={pageBlueprint.length > 0 ? `${pageBlueprint.length} 个页面` : "未生成"}
                    ready={pageBlueprint.length > 0}
                    onJump={() => { setArtifactOpen(false); goTo(2); }}
                  />
                  <ArtifactRow
                    label="交付产物"
                    desc="交付阶段生成的文件包"
                    ready={Boolean(deliverArtifacts)}
                    onJump={() => { setArtifactOpen(false); goTo(3); }}
                  />
                  <li>
                    <Link
                      href="/account"
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    >
                      <FolderOpen className="size-3.5 shrink-0" />
                      <span className="flex-1">已保存项目</span>
                      <span aria-hidden>→</span>
                    </Link>
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>
        <Button
          size="icon"
          variant="outline"
          className="shrink-0"
          disabled={sedimenting || !hasSediment}
          onClick={() => void sedimentToBrain()}
          title="把已确认的产品定位 / 目标用户 / 关键功能决策等沉淀到第二大脑"
          aria-label="沉淀到第二大脑"
        >
          <Brain className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="shrink-0"
          disabled={saving || !hasDraft}
          onClick={() => void onTopbarSave()}
          title="保存"
        >
          <Save className="size-4" />
        </Button>
      </div>

      {/* A1：跳步被门禁拦截时，说明「缺什么」，不静默失败 */}
      {gateMsg && (
        <div
          role="status"
          className="flex shrink-0 items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning"
        >
          <Info className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1">{gateMsg}</span>
          <button
            type="button"
            onClick={() => setGateMsg(null)}
            aria-label="关闭提示"
            className="shrink-0 rounded p-0.5 transition hover:bg-warning/20"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {STEP_DEFS.map((s, i) => (
        <div key={s.id} className={i === active ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
          {renderStage(s)}
        </div>
      ))}

      <LeaveDialog
        open={leaveTarget !== null}
        saving={saving}
        saveFailed={saveFailed}
        onSave={onLeaveSave}
        onDiscard={onLeaveDiscard}
        onCancel={() => setLeaveTarget(null)}
        projectName={projectName}
        stageLabel={stageLabel}
        historyCount={dialogHistory}
        roundCount={dialogRounds}
        hasBrief={hasBrief}
        pageCount={dialogPages}
      />

      {saveMsg && <div className="pointer-events-none fixed bottom-4 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-foreground px-3 py-1.5 text-xs text-background shadow-lg">{saveMsg}</div>}
      {sedimentError && <div className="pointer-events-none fixed bottom-4 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-destructive px-3 py-1.5 text-xs text-white shadow-lg">{sedimentError}</div>}
    </div>
  );
}
/** 产物库下拉的行：已生成 → 可点击跳到对应阶段；未生成 → 置灰展示 */
function ArtifactRow({
  label,
  desc,
  ready,
  onJump,
}: {
  label: string;
  desc: string;
  ready: boolean;
  onJump: () => void;
}) {
  return (
    <li>
      {ready ? (
        <button
          type="button"
          onClick={onJump}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted/50"
        >
          <span className="flex-1">
            <span className="block font-medium text-foreground">{label}</span>
            <span className="block text-muted-foreground">{desc}</span>
          </span>
          <span className="shrink-0 text-muted-foreground" aria-hidden>
            →
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs opacity-50">
          <span className="flex-1">
            <span className="block font-medium text-foreground">{label}</span>
            <span className="block text-muted-foreground">未生成</span>
          </span>
        </div>
      )}
    </li>
  );
}
