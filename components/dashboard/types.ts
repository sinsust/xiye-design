"use client";

import { useCallback, useEffect, useState } from "react";

// —— 与 GET /api/brain/dashboard 返回结构对齐 ——
export interface DashboardTask {
  id: string;
  title: string;
  status: string;
  priority: "high" | "medium" | "low";
  dueDate: string | null;
  daysOverdue: number;
  strategyName: string | null;
}
export interface DashboardReview {
  noteId: string;
  title: string;
  reviewCount: number;
  easeFactor: number;
}
export interface DecayAlert {
  noteId: string;
  title: string;
  lastAccessedAt: string;
  daysSinceAccess: number;
}
export interface StrategyReview {
  strategyId: string;
  name: string;
  lastUpdated: string;
  daysSinceUpdate: number;
}
export interface ProjectProgress {
  id: string;
  name: string;
  color: string;
  totalTasks: number;
  completedTasks: number;
  progress: number;
}

export interface DashboardData {
  today: string;
  tasks: {
    overdue: DashboardTask[];
    dueToday: DashboardTask[];
    dueThisWeek: DashboardTask[];
    total: { overdue: number; today: number; week: number };
  };
  reviews: { dueToday: DashboardReview[]; total: number };
  inbox: { pending: number };
  insights: {
    weekSummary: {
      newNotes: number;
      completedTasks: number;
      newStrategies: number;
      topCategory: string;
      topTags: string[];
    };
    decayAlerts: DecayAlert[];
    strategyReviews: StrategyReview[];
  };
  projects: ProjectProgress[];
}

export interface DashboardPanelProps {
  onOpenInbox: () => void;
  onGoto: (view: string) => void;
  onNewTask: () => void;
}

export function formatDue(dueDate: string | null): string {
  if (!dueDate) return "";
  const mm = dueDate.slice(5, 7);
  const dd = dueDate.slice(8, 10);
  return `${Number(mm)}月${Number(dd)}日`;
}