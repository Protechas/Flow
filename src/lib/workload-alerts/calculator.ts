import { getComplexityMultiplier } from "@/lib/forecast/engine";
import type {
  ForecastSettings,
  User,
  WorkPackage,
  WorkloadAlertSeverity,
  WorkloadAlertType,
  WorkStatus,
} from "@/types/flow";

const ACTIVE_STATUSES: WorkStatus[] = [
  "working_on_it",
  "waiting",
  "ready_for_qa",
  "in_qa",
  "correction_needed",
  "stuck",
];

const UPCOMING_STATUSES: WorkStatus[] = ["assigned", "not_started"];

export interface PackageRemainingResult {
  packageId: string;
  title: string;
  remainingMinutes: number | null;
  remainingHours: number | null;
  needsEstimate: boolean;
  almostComplete: boolean;
}

export interface EmployeeWorkloadSnapshot {
  employeeId: string;
  activeTask: WorkPackage | null;
  upcomingTasks: WorkPackage[];
  openAssigned: WorkPackage[];
  remainingHours: number | null;
  needsEstimate: boolean;
  activeTaskAlmostComplete: boolean;
  packageBreakdown: PackageRemainingResult[];
}

function isOpenAssigned(pkg: WorkPackage): boolean {
  return pkg.status !== "done" && !!pkg.assigned_to;
}

export function computePackageRemaining(
  pkg: WorkPackage,
  settings: ForecastSettings
): PackageRemainingResult {
  const docCount = pkg.estimated_document_count;
  const completed =
    pkg.current_documents_completed ?? pkg.file_count ?? 0;
  const multiplier =
    pkg.complexity_multiplier ??
    getComplexityMultiplier(pkg.complexity_level ?? "standard");
  const minutesPerDoc =
    pkg.estimated_minutes_per_document ?? settings.minutes_per_document;

  if (docCount != null && docCount > 0) {
    const remainingDocs = Math.max(0, docCount - completed);
    const remainingMinutes = Math.round(remainingDocs * minutesPerDoc * multiplier);
    const remainingHours = Math.round((remainingMinutes / 60) * 100) / 100;
    const almostComplete =
      remainingDocs <= 1 || remainingDocs / docCount <= 0.1;
    return {
      packageId: pkg.id,
      title: pkg.title,
      remainingMinutes,
      remainingHours,
      needsEstimate: false,
      almostComplete,
    };
  }

  if (pkg.estimated_work_hours != null && pkg.estimated_work_hours > 0) {
    const progress =
      pkg.status === "done"
        ? 1
        : ACTIVE_STATUSES.includes(pkg.status)
          ? 0.35
          : UPCOMING_STATUSES.includes(pkg.status)
            ? 0
            : 0.15;
    const remainingHours =
      Math.round(pkg.estimated_work_hours * (1 - progress) * 100) / 100;
    return {
      packageId: pkg.id,
      title: pkg.title,
      remainingMinutes: Math.round(remainingHours * 60),
      remainingHours,
      needsEstimate: false,
      almostComplete: remainingHours < 0.5,
    };
  }

  if (pkg.estimated_hours > 0) {
    const progress = ACTIVE_STATUSES.includes(pkg.status) ? 0.4 : 0;
    const remainingHours =
      Math.round(pkg.estimated_hours * (1 - progress) * 100) / 100;
    return {
      packageId: pkg.id,
      title: pkg.title,
      remainingMinutes: Math.round(remainingHours * 60),
      remainingHours,
      needsEstimate: false,
      almostComplete: remainingHours < 0.5,
    };
  }

  return {
    packageId: pkg.id,
    title: pkg.title,
    remainingMinutes: null,
    remainingHours: null,
    needsEstimate: true,
    almostComplete: false,
  };
}

export function evaluateEmployeeWorkload(
  employee: User,
  packages: WorkPackage[],
  settings: ForecastSettings
): EmployeeWorkloadSnapshot {
  const mine = packages.filter(
    (p) => p.assigned_to === employee.id && isOpenAssigned(p)
  );

  const activeTask =
    mine.find((p) => ACTIVE_STATUSES.includes(p.status)) ??
    mine.find((p) => p.status === "working_on_it") ??
    null;

  const upcomingTasks = mine.filter((p) =>
    UPCOMING_STATUSES.includes(p.status)
  );

  const packageBreakdown = mine.map((p) => computePackageRemaining(p, settings));
  const estimatable = packageBreakdown.filter((p) => !p.needsEstimate);
  const needsEstimate = packageBreakdown.some((p) => p.needsEstimate);

  let remainingHours: number | null = null;
  if (estimatable.length > 0) {
    remainingHours =
      Math.round(
        estimatable.reduce((s, p) => s + (p.remainingHours ?? 0), 0) * 100
      ) / 100;
  } else if (mine.length > 0) {
    remainingHours = null;
  } else {
    remainingHours = 0;
  }

  const activeBreakdown = activeTask
    ? packageBreakdown.find((p) => p.packageId === activeTask.id)
    : null;

  return {
    employeeId: employee.id,
    activeTask,
    upcomingTasks,
    openAssigned: mine,
    remainingHours,
    needsEstimate: needsEstimate && estimatable.length === 0,
    activeTaskAlmostComplete: activeBreakdown?.almostComplete ?? false,
    packageBreakdown,
  };
}

export interface DerivedWorkloadAlert {
  alert_type: WorkloadAlertType;
  severity: WorkloadAlertSeverity;
  remaining_hours: number | null;
  current_task_id: string | null;
  recommended_action: string;
}

export function deriveWorkloadAlerts(
  snapshot: EmployeeWorkloadSnapshot,
  thresholdHours: number
): DerivedWorkloadAlert[] {
  const alerts: DerivedWorkloadAlert[] = [];
  const { activeTask, upcomingTasks, remainingHours, needsEstimate } = snapshot;

  if (needsEstimate && snapshot.openAssigned.length > 0) {
    alerts.push({
      alert_type: "needs_estimate",
      severity: "needs_review",
      remaining_hours: remainingHours,
      current_task_id: activeTask?.id ?? snapshot.openAssigned[0]?.id ?? null,
      recommended_action:
        "Add document estimates or forecast hours so remaining work can be calculated.",
    });
  }

  if (!activeTask && upcomingTasks.length === 0 && snapshot.openAssigned.length === 0) {
    alerts.push({
      alert_type: "no_assigned_work",
      severity: "critical",
      remaining_hours: 0,
      current_task_id: null,
      recommended_action: "Assign new work from Operations or the project backlog.",
    });
    return dedupeByType(alerts);
  }

  if (!activeTask && upcomingTasks.length > 0) {
    alerts.push({
      alert_type: "running_out_of_work",
      severity: "warning",
      remaining_hours: remainingHours,
      current_task_id: upcomingTasks[0]?.id ?? null,
      recommended_action:
        "Employee has no active task — start the next assigned package or assign additional work.",
    });
  }

  if (snapshot.activeTaskAlmostComplete && activeTask) {
    alerts.push({
      alert_type: "task_almost_complete",
      severity: "info",
      remaining_hours: remainingHours,
      current_task_id: activeTask.id,
      recommended_action:
        "Current task is nearly done — queue the next assignment before the employee goes idle.",
    });
  }

  if (
    remainingHours != null &&
    remainingHours > 0 &&
    remainingHours < thresholdHours &&
    snapshot.openAssigned.length > 0
  ) {
    alerts.push({
      alert_type: "needs_more_work_soon",
      severity: "warning",
      remaining_hours: remainingHours,
      current_task_id: activeTask?.id ?? snapshot.openAssigned[0]?.id ?? null,
      recommended_action: `Less than ${thresholdHours}h of forecasted work remains — assign follow-on tasks.`,
    });
  }

  if (
    remainingHours != null &&
    remainingHours <= thresholdHours &&
    upcomingTasks.length === 0 &&
    snapshot.openAssigned.length > 0
  ) {
    alerts.push({
      alert_type: "running_out_of_work",
      severity: remainingHours === 0 ? "critical" : "warning",
      remaining_hours: remainingHours,
      current_task_id: activeTask?.id ?? snapshot.openAssigned[0]?.id ?? null,
      recommended_action:
        "No upcoming assignments after current work — assign additional packages.",
    });
  }

  if (
    remainingHours != null &&
    remainingHours > thresholdHours &&
    upcomingTasks.length <= 1 &&
    snapshot.openAssigned.length > 0 &&
    !activeTask
  ) {
    alerts.push({
      alert_type: "running_out_of_work",
      severity: "info",
      remaining_hours: remainingHours,
      current_task_id: snapshot.openAssigned[0]?.id ?? null,
      recommended_action: "Low upcoming workload — consider assigning more work.",
    });
  }

  return dedupeByType(alerts);
}

function dedupeByType(alerts: DerivedWorkloadAlert[]): DerivedWorkloadAlert[] {
  const seen = new Set<WorkloadAlertType>();
  return alerts.filter((a) => {
    if (seen.has(a.alert_type)) return false;
    seen.add(a.alert_type);
    return true;
  });
}

export const SEVERITY_ORDER: Record<WorkloadAlertSeverity, number> = {
  critical: 0,
  warning: 1,
  needs_review: 2,
  info: 3,
};
