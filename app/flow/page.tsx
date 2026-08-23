"use client";

import { Suspense, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, PanelTopOpen, RotateCcw, Copy, Check, FolderDown, Save, Loader2 } from "lucide-react";
import { useFlowStore } from "@/lib/store/flow-store";
import { Button } from "@/components/ui/button";
import { Step0Intent } from "./steps/step0-intent";
import { Step2Skeleton } from "./steps/step2-skeleton";
import { Step3Wrapup } from "./steps/step3-wrapup";
import { Step11Generate } from "./steps/step11-generate";
import { buildAiKickoffPrompt } from "@/lib/ai-prompt";
import { generateProject, buildProjectZipFiles } from "@/lib/project-generator";
import { buildZip, downloadBlob } from "@/lib/zip";

const TOTAL_STEPS = 4;
const STEP_NAMES = ["AI 意图", "页面搭建", "收尾配置", "生成项目"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max items-center justify-center">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => {
          const step = i + 1;
          const isCompleted = step < current;
          const isCurrent = step === current;
          const isFuture = step > current;

          return (
            <div key={step} className="flex items-center">
              <div
                className={[
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors",
                  isCompleted && "bg-primary text-primary-foreground",
                  isCurrent &&
                    "bg-primary text-primary-foreground ring-4 ring-primary/25",
                  isFuture &&
                    "border border-border bg-background text-muted-foreground",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {isCompleted ? "✓" : step}
              </div>
              {step < TOTAL_STEPS && (
                <div
                  className={[
                    "h-0.5 w-10 shrink-0 sm:w-16 md:w-24",
                    step < current ? "bg-primary" : "bg-border",
                  ].join(" ")}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 底部操作栏：用 createPortal 挂到 <body>，脱离页面内任何带 transform 的祖先容器，
    保证 fixed 相对真实视口钉在底部（否则祖先 transform 会把 fixed 的包含块偷换成祖先，条会落在页面中部）；
    仅在客户端渲染，避免 SSR 水合差异 */
function FlowFooter() {
  const currentStep = useFlowStore((s) => s.currentStep);
  const nextStep = useFlowStore((s) => s.nextStep);
  const prevStep = useFlowStore((s) => s.prevStep);
  const goToStep = useFlowStore((s) => s.goToStep);
  const setBuilderReturnStep = useFlowStore((s) => s.setBuilderReturnStep);
  const savedProjectId = useFlowStore((s) => s.savedProjectId);
  const setSavedProjectId = useFlowStore((s) => s.setSavedProjectId);
  const captureFlowSnapshot = useFlowStore((s) => s.captureFlowSnapshot);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => setMounted(true), []);

  // 进入第 4 步且已登录、本地尚无项目记录时，自动存一份到「我的项目」（首次建，之后手动保存覆盖更新）
  useEffect(() => {
    if (currentStep !== 4 || savedProjectId) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await fetch("/api/auth/me");
        if (!me.ok || cancelled) return;
        const snap = useFlowStore.getState().captureFlowSnapshot();
        const name = useFlowStore.getState().projectInfo?.projectName || "未命名项目";
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, data: snap }),
        });
        if (res.ok && !cancelled) {
          const j = await res.json();
          if (j.project?.id) useFlowStore.getState().setSavedProjectId(j.project.id);
        }
      } catch {
        /* 静默：localStorage 持久化已兜底防丢 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentStep, savedProjectId]);

  const saveProject = async () => {
    const me = await fetch("/api/auth/me");
    if (!me.ok) {
      router.push("/login");
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const snap = useFlowStore.getState().captureFlowSnapshot();
      const name = useFlowStore.getState().projectInfo?.projectName || "未命名项目";
      const existing = useFlowStore.getState().savedProjectId;
      const res = existing
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
      if (res.ok) {
        const j = await res.json();
        if (!existing && j.project?.id) useFlowStore.getState().setSavedProjectId(j.project.id);
        setSaveMsg("已保存");
      } else {
        setSaveMsg("保存失败");
      }
    } catch {
      setSaveMsg("保存失败");
    }
    setSaving(false);
  };

  const copyPrompt = async () => {
    const text = buildAiKickoffPrompt(useFlowStore.getState());
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 剪贴板不可用静默 */
    }
  };

  const downloadZip = () => {
    const project = generateProject(useFlowStore.getState());
    const safe = (project.projectName || "xiye-project").replace(/[\\/:*?"<>|\s]+/g, "-").trim() || "xiye-project";
    downloadBlob(buildZip(buildProjectZipFiles(project)), `${safe}.zip`);
  };

  return mounted
    ? createPortal(
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              {currentStep > 1 ? (
                <Button variant="ghost" onClick={prevStep}>
                  <ArrowLeft className="size-4" /> 上一步
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  想法越具体，AI 回填的页面越准 · 完成后点右侧「下一步」进入页面搭建
                </span>
              )}
              {currentStep === 4 && (
                <Button variant="ghost" onClick={() => goToStep(1)} title="回到第一步重新配置（已生成的 PRD 与项目不会丢失）">
                  <RotateCcw className="size-4" /> 重新配置
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {currentStep === 1 && (
                <Button onClick={nextStep}>
                  下一步 <ArrowRight className="size-4" />
                </Button>
              )}
              {currentStep === 2 && (
                <>
                  <Button variant="outline" onClick={() => { setBuilderReturnStep(currentStep); router.push("/builder?from=flow"); }}>
                    <PanelTopOpen className="size-4" /> 视觉微调
                  </Button>
                  <Button onClick={nextStep}>
                    下一步 <ArrowRight className="size-4" />
                  </Button>
                </>
              )}
              {currentStep === 3 && <Button onClick={nextStep}>进入生成</Button>}
              {currentStep === 4 && (
                <>
                  <Button variant="outline" onClick={copyPrompt}>
                    {copied ? (
                      <>
                        <Check className="size-3.5" /> 已复制
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" /> 复制提示词
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={downloadZip}>
                    <FolderDown className="size-4" /> 下载全部
                  </Button>
                  <Button onClick={saveProject} disabled={saving}>
                    {saving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    {saveMsg ?? "保存项目"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;
}

export default function FlowPage() {
  const currentStep = useFlowStore((s) => s.currentStep);
  const stepName = STEP_NAMES[currentStep - 1] ?? `Step ${currentStep}`;

  return (
    <div className="flex min-h-full flex-1 flex-col gap-6 pb-[88px]">
      <div className="flex flex-col items-center gap-4">
        <StepIndicator current={currentStep} />
        <p className="text-center text-sm text-muted-foreground">
          第 {currentStep} / {TOTAL_STEPS} 步 · {stepName}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {currentStep === 1 && (
          <Suspense
            fallback={
              <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                加载 AI 意图…
              </div>
            }
          >
            <Step0Intent />
          </Suspense>
        )}
        {currentStep === 2 && <Step2Skeleton />}
        {currentStep === 3 && <Step3Wrapup />}
        {currentStep === 4 && <Step11Generate />}
      </div>

      <FlowFooter />
    </div>
  );
}