import { getTeamMemberIds, canViewerSeeUser } from "@/lib/auth/team-scope";
import { resolveLeadersForEmployee } from "@/lib/hierarchy/resolver";
import { canAssignWork } from "@/lib/auth/permissions";
import { getUserPrimaryDepartmentId } from "@/lib/departments/resolve";
import { getFlowStore } from "@/lib/data/flow-store";
import {
  getActiveClockEntry,
  getActiveTaskTimeEntry,
  initProductionTracking,
} from "@/lib/data/production-tracking";
import {
  deliverNotification,
} from "@/lib/notifications/notifications";
import {
  deriveWorkloadAlerts,
  evaluateEmployeeWorkload,
  SEVERITY_ORDER,
} from "@/lib/workload-alerts/calculator";
import { getWorkloadAlertSettings } from "@/lib/workload-alerts/hydrate";
import { getWorkVisibilitySettings } from "@/lib/work-visibility/hydrate";
import {
  listWorkloadAlertRecords,
  upsertWorkloadAlertRecord,
  avgAlertResponseTimeHours,
  countAlertsForEmployee,
} from "@/lib/workload-alerts/store";
import type {
  User,
  UserRole,
  WorkPackage,
  WorkloadAlertRecord,
  WorkloadAlertReportMetrics,
  WorkloadAlertView,
} from "@/types/flow";

function employeeInScope(
  employee: User,
  viewer: User,
  allUsers: User[]
): boolean {
  return canViewerSeeUser(viewer, employee.id, allUsers, getFlowStore().teams);
}

function passesSettingsFilter(employee: User, settings: ReturnType<typeof getWorkloadAlertSettings>): boolean {
  const deptId = getUserPrimaryDepartmentId(employee.id);
  if (settings.department_ids.length > 0) {
    if (!deptId || !settings.department_ids.includes(deptId)) {
      return false;
    }
  }
  if (settings.team_ids.length > 0) {
    if (!employee.team_id || !settings.team_ids.includes(employee.team_id)) {
      return false;
    }
  }
  return true;
}

function getNotificationRecipients(
  employee: User,
  users: User[]
): User[] {
  return resolveLeadersForEmployee(employee, users, {
    includeSeniorManager: true,
    includeAdminFallback: true,
  });
}

function notifyLeaders(
  employee: User,
  users: User[],
  type: "workload_low" | "workload_empty" | "workload_needs_estimate" | "workload_clocked_idle",
  title: string,
  message: string
) {
  const recipients = getNotificationRecipients(employee, users);
  for (const leader of recipients) {
    deliverNotification(
      {
        user_id: leader.id,
        type,
        title,
        message,
        related_entity_type: "user",
        related_entity_id: employee.id,
        link: `/people/${employee.id}`,
      },
      8
    );
  }
}

export function syncWorkloadAlerts(
  packages: WorkPackage[],
  users: User[]
): WorkloadAlertRecord[] {
  initProductionTracking();
  const settings = getWorkloadAlertSettings();
  if (!settings.enabled) return listWorkloadAlertRecords();

  const employees = users.filter(
    (u) => u.is_active && (u.role === "employee" || u.role === "teamlead")
  );
  const store = getFlowStore();
  const departments = store.departments ?? [];
  const teams = store.teams ?? [];

  for (const employee of employees) {
    if (!passesSettingsFilter(employee, settings)) continue;

    const snapshot = evaluateEmployeeWorkload(
      employee,
      packages,
      store.forecastSettings
    );
    const derived = deriveWorkloadAlerts(
      snapshot,
      settings.work_remaining_threshold_hours
    );

    const isClockedIn = !!getActiveClockEntry(employee.id);
    const hasActiveTimer = !!getActiveTaskTimeEntry(employee.id);

    for (const alert of derived) {
      upsertWorkloadAlertRecord({
        employee_id: employee.id,
        department_id: getUserPrimaryDepartmentId(employee.id),
        team_id: employee.team_id ?? null,
        alert_type: alert.alert_type,
        severity: alert.severity,
        remaining_hours: alert.remaining_hours,
        current_task_id: alert.current_task_id,
        status: "open",
        recommended_action: alert.recommended_action,
        reviewed_by: null,
        reviewed_at: null,
        snoozed_until: null,
        dismissed_by: null,
        dismissed_at: null,
      });
    }

    const primary = derived.sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    )[0];

    if (primary) {
      if (primary.alert_type === "no_assigned_work") {
        notifyLeaders(
          employee,
          users,
          "workload_empty",
          "No assigned work",
          `${employee.full_name} has no active or upcoming tasks.`
        );
      } else if (primary.alert_type === "needs_estimate") {
        notifyLeaders(
          employee,
          users,
          "workload_needs_estimate",
          "Workload needs estimate",
          `${employee.full_name} has assigned work without forecast estimates.`
        );
      } else if (
        primary.remaining_hours != null &&
        primary.remaining_hours < settings.work_remaining_threshold_hours
      ) {
        notifyLeaders(
          employee,
          users,
          "workload_low",
          "Low workload remaining",
          `${employee.full_name} has ~${primary.remaining_hours}h of work remaining.`
        );
      }
    }

    if (isClockedIn && !snapshot.activeTask) {
      const visSettings = getWorkVisibilitySettings();
      if (!visSettings.enabled || !visSettings.alerts_enabled) {
        notifyLeaders(
          employee,
          users,
          "workload_clocked_idle",
          "Clocked in without active task",
          `${employee.full_name} is clocked in but has no active task.`
        );
      }
    }
  }

  return listWorkloadAlertRecords();
}

function recordToView(
  record: WorkloadAlertRecord,
  users: User[],
  packages: WorkPackage[],
  viewerRole: UserRole
): WorkloadAlertView {
  initProductionTracking();
  const employee = users.find((u) => u.id === record.employee_id);
  const store = getFlowStore();
  const dept = store.departments?.find((d) => d.id === record.department_id);
  const team = store.teams?.find((t) => t.id === record.team_id);
  const currentTask = record.current_task_id
    ? packages.find((p) => p.id === record.current_task_id)
    : null;
  const snapshot = employee
    ? evaluateEmployeeWorkload(employee, packages, store.forecastSettings)
    : null;

  return {
    ...record,
    employee_name: employee?.full_name ?? "Unknown",
    department_name: dept?.name ?? null,
    team_name: team?.name ?? null,
    current_task_title: currentTask?.title ?? null,
    upcoming_task_count: snapshot?.upcomingTasks.length ?? 0,
    upcoming_task_titles: snapshot?.upcomingTasks.map((t) => t.title) ?? [],
    is_clocked_in: employee ? !!getActiveClockEntry(employee.id) : false,
    has_active_timer: employee ? !!getActiveTaskTimeEntry(employee.id) : false,
    can_assign: canAssignWork(viewerRole),
  };
}

export function listWorkloadAlertsForViewer(
  viewer: User,
  packages: WorkPackage[],
  users: User[],
  options?: { includeSnoozed?: boolean; includeDismissed?: boolean }
): WorkloadAlertView[] {
  const settings = getWorkloadAlertSettings();
  if (!settings.enabled) return [];
  if (!["admin", "super_admin", "senior_manager", "manager", "teamlead"].includes(viewer.role)) return [];

  syncWorkloadAlerts(packages, users);

  const now = Date.now();
  const records = listWorkloadAlertRecords().filter((r) => {
    const employee = users.find((u) => u.id === r.employee_id);
    if (!employee || !employeeInScope(employee, viewer, users)) return false;
    // Records created before a team was excluded in settings (e.g. Email
    // Team) must not keep rendering — re-check the filter on display too.
    if (!passesSettingsFilter(employee, settings)) return false;
    if (r.status === "dismissed" || r.status === "reviewed") {
      return options?.includeDismissed ?? false;
    }
    if (r.status === "snoozed" && r.snoozed_until) {
      if (new Date(r.snoozed_until).getTime() > now) {
        return options?.includeSnoozed ?? false;
      }
    }
    return r.status === "open" || r.status === "snoozed";
  });

  return records
    .map((r) => recordToView(r, users, packages, viewer.role))
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        (a.remaining_hours ?? 999) - (b.remaining_hours ?? 999)
    );
}

export function buildWorkloadAlertSummary(
  alerts: WorkloadAlertView[]
): { open: number; critical: number; warning: number; needsReview: number } {
  return {
    open: alerts.length,
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    needsReview: alerts.filter((a) => a.severity === "needs_review").length,
  };
}

export function buildWorkloadAlertReportMetrics(
  packages: WorkPackage[],
  users: User[],
  teamMemberIds?: string[]
): WorkloadAlertReportMetrics {
  syncWorkloadAlerts(packages, users);
  const store = getFlowStore();
  let records = listWorkloadAlertRecords().filter((r) => r.status === "open");

  if (teamMemberIds?.length) {
    const ids = new Set(teamMemberIds);
    records = records.filter((r) => ids.has(r.employee_id));
  }

  const employees = users.filter((u) => u.is_active);
  const threshold = getWorkloadAlertSettings().work_remaining_threshold_hours;

  let totalUnused = 0;
  let countWithCapacity = 0;

  for (const emp of employees) {
    if (teamMemberIds?.length && !teamMemberIds.includes(emp.id)) continue;
    const snap = evaluateEmployeeWorkload(emp, packages, store.forecastSettings);
    if (snap.remainingHours != null) {
      const unused = Math.max(0, threshold * 2 - snap.remainingHours);
      totalUnused += unused;
      countWithCapacity += 1;
    }
  }

  const byDept = new Map<
    string,
    { departmentName: string; alertCount: number; criticalCount: number }
  >();

  for (const r of records) {
    const deptId = r.department_id ?? "unassigned";
    const dept = store.departments?.find((d) => d.id === deptId);
    const cur = byDept.get(deptId) ?? {
      departmentName: dept?.name ?? "Unassigned",
      alertCount: 0,
      criticalCount: 0,
    };
    cur.alertCount += 1;
    if (r.severity === "critical") cur.criticalCount += 1;
    byDept.set(deptId, cur);
  }

  const repeated = employees
    .map((u) => ({
      userId: u.id,
      name: u.full_name,
      alertCount: countAlertsForEmployee(u.id, 30),
    }))
    .filter((r) => r.alertCount >= 2)
    .sort((a, b) => b.alertCount - a.alertCount)
    .slice(0, 10);

  return {
    lowWorkloadCount: records.filter(
      (r) =>
        r.alert_type === "needs_more_work_soon" ||
        r.alert_type === "running_out_of_work"
    ).length,
    noWorkCount: records.filter((r) => r.alert_type === "no_assigned_work").length,
    avgUnusedCapacityHours:
      countWithCapacity > 0
        ? Math.round((totalUnused / countWithCapacity) * 10) / 10
        : 0,
    byDepartment: [...byDept.entries()].map(([departmentId, v]) => ({
      departmentId,
      departmentName: v.departmentName,
      alertCount: v.alertCount,
      criticalCount: v.criticalCount,
    })),
    avgResponseTimeHours: avgAlertResponseTimeHours(),
    repeatedLowWorkload: repeated,
    openAlerts: records.length,
  };
}
