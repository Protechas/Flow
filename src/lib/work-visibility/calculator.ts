import { getDepartmentName } from "@/lib/departments/resolve";
import {
  getActiveClockEntry,
  getActiveTaskTimeEntry,
  getProductionStore,
  getShiftMinutesToday,
  getTaskMinutesToday,
  initProductionTracking,
} from "@/lib/data/production-tracking";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { getWrapUpComplianceStatus } from "@/lib/wrap-up/compliance";
import { isWrapUpRequiredForDate } from "@/lib/wrap-up/eligibility";
import { evaluateEmployeeWorkload } from "@/lib/workload-alerts/calculator";
import { requiresShiftClock } from "@/lib/users/pay-type";
import type {
  EmployeeWorkVisibilityMetrics,
  User,
  WorkPackage,
  WorkVisibilitySummary,
  WorkVisibilityTrendPoint,
} from "@/types/flow";
import { format, subDays } from "date-fns";
import { minutesBetween } from "@/lib/production/metrics";

export function computeDayTimeMetrics(
  clockedMinutes: number,
  recordedTaskMinutes: number
): {
  unassignedMinutes: number;
  taskTrackingCompliancePct: number | null;
} {
  const unassignedMinutes = Math.max(0, clockedMinutes - recordedTaskMinutes);
  const taskTrackingCompliancePct =
    clockedMinutes > 0
      ? Math.min(100, Math.round((recordedTaskMinutes / clockedMinutes) * 100))
      : null;
  return { unassignedMinutes, taskTrackingCompliancePct };
}

function shiftMinutesForDate(userId: string, dateStr: string): number {
  initProductionTracking();
  const { timeClockEntries } = getProductionStore();
  const active = getActiveClockEntry(userId);
  if (active && active.clock_in_at.startsWith(dateStr)) {
    return minutesBetween(active.clock_in_at, new Date().toISOString());
  }
  return timeClockEntries
    .filter(
      (e) =>
        e.user_id === userId &&
        e.clock_in_at.startsWith(dateStr) &&
        e.total_minutes != null
    )
    .reduce((s, e) => s + (e.total_minutes ?? 0), 0);
}

function taskMinutesForDate(userId: string, dateStr: string): number {
  initProductionTracking();
  const { taskTimeEntries } = getProductionStore();
  const now = new Date().toISOString();
  let total = 0;
  for (const entry of taskTimeEntries) {
    if (entry.user_id !== userId || !entry.started_at.startsWith(dateStr)) continue;
    if (entry.status === "active") {
      total += minutesBetween(entry.started_at, now);
    } else {
      total += entry.total_active_minutes;
    }
  }
  return total;
}

export function buildEmployeeWorkVisibilityMetrics(
  user: User,
  packages: WorkPackage[],
  options?: { date?: string; hasActiveActivityGap?: boolean }
): EmployeeWorkVisibilityMetrics {
  initFlowStore();
  const store = getFlowStore();
  const dateStr = options?.date ?? format(new Date(), "yyyy-MM-dd");
  const clockedMinutes = requiresShiftClock(user)
    ? shiftMinutesForDate(user.id, dateStr)
    : taskMinutesForDate(user.id, dateStr);
  const recordedTaskMinutes = taskMinutesForDate(user.id, dateStr);
  const { unassignedMinutes, taskTrackingCompliancePct } = computeDayTimeMetrics(
    clockedMinutes,
    recordedTaskMinutes
  );

  const workload = evaluateEmployeeWorkload(user, packages, store.forecastSettings);
  const threshold = store.forecastSettings.productive_hours_per_day * 2 || 16;
  const remaining = workload.remainingHours ?? 0;
  const workloadCoveragePct =
    remaining >= threshold
      ? 100
      : remaining > 0
        ? Math.min(100, Math.round((remaining / threshold) * 100))
        : workload.openAssigned.length > 0
          ? 50
          : 0;

  const capacityUtilizationPct = Math.min(
    100,
    Math.round((workload.openAssigned.length / 6) * 100)
  );

  const wrapStatus = getWrapUpComplianceStatus(user.id, dateStr);
  let dailyReportCompliancePct: number | null = null;
  if (requiresShiftClock(user) && isWrapUpRequiredForDate(user, dateStr)) {
    dailyReportCompliancePct =
      wrapStatus === "submitted" || wrapStatus === "overridden" ? 100 : 0;
  }

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const documentsCompleted =
    dateStr === todayStr
      ? getProductionStore().taskFileUploads.filter(
          (f) => f.user_id === user.id && f.uploaded_at.startsWith(dateStr)
        ).length
      : 0;

  const wrapUp = store.dailyWrapUps.find(
    (w) => w.user_id === user.id && w.wrap_date === dateStr
  );
  const activityNotes =
    wrapUp?.activity_documentation_note ??
    wrapUp?.activity_documentation_category ??
    null;

  const qaReviews = store.qaReviews.filter((r) => r.analyst_id === user.id);
  const qaAccuracyPct =
    qaReviews.length > 0
      ? Math.round(
          (qaReviews.filter((r) => r.result === "pass").length / qaReviews.length) * 100
        )
      : null;

  const deptId = user.team_id
    ? store.teams.find((t) => t.id === user.team_id)?.department_id ?? null
    : null;

  return {
    userId: user.id,
    userName: user.full_name,
    departmentId: deptId,
    departmentName: deptId ? getDepartmentName(deptId) : null,
    clockedMinutes,
    recordedTaskMinutes,
    unassignedMinutes,
    taskTrackingCompliancePct,
    documentsCompleted,
    qaAccuracyPct,
    dailyReportCompliancePct,
    workloadCoveragePct,
    capacityUtilizationPct,
    activityNotes: activityNotes ? String(activityNotes) : null,
    hasActiveActivityGap: options?.hasActiveActivityGap ?? false,
  };
}

export function buildWorkVisibilitySummary(
  metrics: EmployeeWorkVisibilityMetrics[],
  openActivityGaps: number,
  complianceTargetPct: number
): WorkVisibilitySummary {
  const withClock = metrics.filter((m) => m.clockedMinutes > 0);
  const taskTrackingCompliancePct =
    withClock.length > 0
      ? Math.round(
          withClock.reduce((s, m) => s + (m.taskTrackingCompliancePct ?? 0), 0) / withClock.length
        )
      : 100;

  const reportEligible = metrics.filter((m) => m.dailyReportCompliancePct !== null);
  const dailyReportCompliancePct =
    reportEligible.length > 0
      ? Math.round(
          reportEligible.reduce((s, m) => s + (m.dailyReportCompliancePct ?? 0), 0) /
            reportEligible.length
        )
      : 100;

  const workloadCoveragePct =
    metrics.length > 0
      ? Math.round(
          metrics.reduce((s, m) => s + (m.workloadCoveragePct ?? 0), 0) / metrics.length
        )
      : 100;

  const capacityVisibilityPct =
    metrics.length > 0
      ? Math.round(
          (withClock.length / Math.max(metrics.length, 1)) * 100
        )
      : 100;

  const withUnassigned = metrics.filter((m) => m.unassignedMinutes > 15);
  const documented = withUnassigned.filter((m) => m.activityNotes);
  const workDocumentationPct =
    withUnassigned.length > 0
      ? Math.round((documented.length / withUnassigned.length) * 100)
      : 100;

  const components = [
    taskTrackingCompliancePct,
    dailyReportCompliancePct,
    workloadCoveragePct,
    capacityVisibilityPct,
    workDocumentationPct,
  ];
  const score = Math.round(components.reduce((a, b) => a + b, 0) / components.length);

  return {
    score: Math.max(0, Math.min(100, score)),
    taskTrackingCompliancePct,
    dailyReportCompliancePct,
    workloadCoveragePct,
    capacityVisibilityPct,
    workDocumentationPct,
    openActivityGaps,
  };
}

export function buildWorkVisibilityTrend(
  users: User[],
  packages: WorkPackage[],
  days: 7 | 30 | 90
): WorkVisibilityTrendPoint[] {
  const points: WorkVisibilityTrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = format(subDays(new Date(), i), "yyyy-MM-dd");
    const dayMetrics = users
      .filter((u) => u.is_active && (u.role === "employee" || u.role === "teamlead"))
      .map((u) => buildEmployeeWorkVisibilityMetrics(u, packages, { date }));
    const summary = buildWorkVisibilitySummary(dayMetrics, 0, 85);
    points.push({
      date,
      score: summary.score,
      taskTrackingCompliancePct: summary.taskTrackingCompliancePct,
      dailyReportCompliancePct: summary.dailyReportCompliancePct,
    });
  }
  return points;
}

/** Convenience for employee wrap-up / clock-out UI. */
export function getTodayVisibilityForUser(userId: string) {
  initFlowStore();
  const user = getFlowStore().users.find((u) => u.id === userId);
  if (!user) {
    return {
      clockedMinutes: 0,
      recordedTaskMinutes: 0,
      unassignedMinutes: 0,
      taskTrackingCompliancePct: null as number | null,
    };
  }
  const clocked = requiresShiftClock(user)
    ? getShiftMinutesToday(userId)
    : getTaskMinutesToday(userId);
  const task = getTaskMinutesToday(userId);
  return { clockedMinutes: clocked, recordedTaskMinutes: task, ...computeDayTimeMetrics(clocked, task) };
}
