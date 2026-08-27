"use client";

// 客户端快照工具：把一个 builder 工作区（flow-store + skeleton-store）序列化为
// 可落库的 JSON，或从 JSON 回填。仅在浏览器端调用（两个 store 都是客户端状态）。

import { useFlowStore } from "@/lib/store/flow-store";
import { useSkeletonStore } from "@/lib/skeleton-store";

export interface ProjectSnapshot {
  version: 1;
  flow: Record<string, unknown>;
  skeleton: Record<string, unknown>;
}

export function captureSnapshot(): ProjectSnapshot {
  const f = useFlowStore.getState();
  const s = useSkeletonStore.getState();
  return {
    version: 1,
    flow: {
      currentStep: f.currentStep,
      projectType: f.projectType,
      aiCapabilities: f.aiCapabilities,
      techStack: f.techStack,
      designSystem: f.designSystem,
      uiLibrary: f.uiLibrary,
      componentVariants: f.componentVariants,
      projectInfo: f.projectInfo,
      apiKeys: f.apiKeys,
      visualStyle: f.visualStyle,
      motionSelections: f.motionSelections,
      pageBlueprint: f.pageBlueprint,
      builderReturnStep: f.builderReturnStep,
      intentNarrative: f.intentNarrative,
      conceptBrief: f.conceptBrief,
      blueprint: f.blueprint,
    },
    skeleton: {
      picks: s.picks,
      schemes: s.schemes,
      content: s.content,
      elementInteractions: s.elementInteractions,
      componentMotion: s.componentMotion,
      componentOverride: s.componentOverride,
      buttonStyles: s.buttonStyles,
    },
  };
}

export function applySnapshot(snap: ProjectSnapshot) {
  if (snap?.flow) {
    useFlowStore.setState(
      snap.flow as unknown as Parameters<typeof useFlowStore.setState>[0],
    );
  }
  if (snap?.skeleton) {
    useSkeletonStore.setState(
      snap.skeleton as unknown as Parameters<typeof useSkeletonStore.setState>[0],
    );
  }
}
