"use client";

import { ClipboardList, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";

/** 快捷操作：记一笔（打开工作台并聚焦输入）/ 新任务（跳转看板） */
export function QuickActions({
  onGoto,
  onNewTask,
}: {
  onGoto: (view: string) => void;
  onNewTask: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={onNewTask}>
        <ClipboardList className="size-3.5" /> 新任务
      </Button>
      <Button size="sm" onClick={() => onGoto("input")}>
        <PencilLine className="size-3.5" /> 记一笔
      </Button>
    </div>
  );
}