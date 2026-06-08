import type { QaReview, TimeLog, User, WorkPackage } from "@/types/flow";
import {
  endOfMonth,
  isAfter,
  isBefore,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  subDays,
} from "date-fns";

export function computeProductivityScore(
  completedToday: number,
  hoursLoggedToday: number,
  targetCompleted = 3
): number {
  const completionRatio = Math.min(completedToday / targetCompleted, 1) * 70;
  const hoursRatio = Math.min(hoursLoggedToday / 8, 1) * 30;
  return Math.round(completionRatio + hoursRatio);
}

export function computeQualityScore(
  qaPassRate: number,
  correctionCount: number
): number {
  const penalty = Math.min(correctionCount * 4, 35);
  return Math.max(0, Math.round(qaPassRate - penalty));
}

export function computeOnTimeScore(onTimeRate: number): number {
  return Math.round(onTimeRate);
}

export function computeActivityScore(
  recentActions: number,
  targetActions = 5
): number {
  return Math.round(Math.min(recentActions / targetActions, 1) * 100);
}

/** Flow Score: 40% productivity, 30% quality, 20% on-time, 10% activity */
export function computeFlowScore(
  productivityScore: number,
  qualityScore: number,
  onTimeScore: number,
  activityScore: number
): number {
  return Math.round(
    productivityScore * 0.4 +
      qualityScore * 0.3 +
      onTimeScore * 0.2 +
      activityScore * 0.1
  );
}

export function computeQaPassRate(reviews: QaReview[], analystId?: string): number {
  const filtered = analystId
    ? reviews.filter((r) => r.analyst_id === analystId)
    : reviews;
  if (filtered.length === 0) return 100;
  const passed = filtered.filter((r) => r.result === "pass").length;
  return Math.round((passed / filtered.length) * 100);
}

export function computeOnTimeRate(packages: WorkPackage[]): number {
  const done = packages.filter(
    (i) => i.status === "done" && i.due_date && i.completed_date
  );
  if (done.length === 0) return 100;
  const onTime = done.filter(
    (i) => !isAfter(parseISO(i.completed_date!), parseISO(i.due_date!))
  ).length;
  return Math.round((onTime / done.length) * 100);
}

export function computeAvgCompletionHours(packages: WorkPackage[]): number {
  const done = packages.filter((i) => i.status === "done" && i.actual_hours > 0);
  if (done.length === 0) return 0;
  const total = done.reduce((s, i) => s + Number(i.actual_hours), 0);
  return Math.round((total / done.length) * 10) / 10;
}

export function isOverdue(pkg: WorkPackage): boolean {
  if (!pkg.due_date || pkg.status === "done") return false;
  return isBefore(parseISO(pkg.due_date), startOfDay(new Date()));
}

export function isStuck(pkg: WorkPackage): boolean {
  return pkg.status === "stuck";
}

export function completedInRange(
  packages: WorkPackage[],
  start: Date,
  end: Date
): number {
  return packages.filter((i) => {
    if (i.status !== "done" || !i.completed_date) return false;
    const d = parseISO(i.completed_date);
    return isWithinInterval(d, { start, end });
  }).length;
}

export function completedThisWeek(packages: WorkPackage[]): number {
  return completedInRange(packages, subDays(startOfDay(new Date()), 7), new Date());
}

export function completedToday(packages: WorkPackage[]): number {
  const today = startOfDay(new Date());
  return completedInRange(packages, today, new Date());
}

export function completedThisMonth(packages: WorkPackage[]): number {
  const now = new Date();
  return completedInRange(packages, startOfMonth(now), endOfMonth(now));
}

export function completionPct(packages: WorkPackage[]): number {
  if (packages.length === 0) return 0;
  const done = packages.filter((p) => p.status === "done").length;
  return Math.round((done / packages.length) * 100);
}
