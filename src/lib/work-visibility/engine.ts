import { canViewerSeeUser } from "@/lib/hierarchy/visibility-core";
import { resolveLeadersForEmployee } from "@/lib/hierarchy/resolver";
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
import { requiresShiftClock } from "@/lib/users/pay-type";
import {
  buildEmployeeWorkVisibilityMetrics,
  buildWorkVisibilitySummary,
} from "@/lib/work-visibility/calculator";
import { getWorkVisibilitySettings } from "@/lib/work-visibility/hydrate";
import {
  getGapTracking,
  getOpenActivityGapsForEmployee,
  listActivityGapRecords,
  resolveActivityGapsForEmployee,
  setGapTracking,
  upsertActivityGap,
} from "@/lib/work-visibility/store";
import type {
  ActivityGapView,
  EmployeeWorkVisibilityMetrics,
  User,
  WorkPackage,
  WorkVisibilitySummary,
} from "@/types/flow";
import { minutesBetween } from "@/lib/production/metrics";

const GAP_MESSAGE =
  "No active work record currently associated with this clocked session.";

function notifyActivityGap(employee: User, users: User[]) {
  const leaders = resolveLeadersForEmployee(employee, users, {
    includeSeniorManager: true,
    includeAdminFallback: true,
  });
  for (const leader of leaders) {
    deliverNotification(
      {
        user_id: leader.id,
        type: "activity_gap",
        title: "Activity gap",
        message: `${employee.full_name}: ${GAP_MESSAGE}`,
        related_entity_type: "user",
        related_entity_id: employee.id,
        link: `/reports/work-visibility?userId=${employee.id}`,
      },
      4
    );
  }
}

export function syncActivityGaps(users: User[]): void {
  initProductionTracking();
  const settings = getWorkVisibilitySettings();
  if (!settings.enabled || !settings.alerts_enabled) return;

  const threshold = settings.activity_gap_threshold_minutes;
  const employees = users.filter(
    (u) => u.is_active && requiresShiftClock(u) && (u.role === "employee" || u.role === "teamlead")
  );

  for (const employee of employees) {
    const clocked = getActiveClockEntry(employee.id);
    const hasTaskTimer = !!getActiveTaskTimeEntry(employee.id);

    if (!clocked || hasTaskTimer) {
      resolveActivityGapsForEmployee(employee.id);
      setGapTracking(employee.id, null);
      continue;
    }

    const now = new Date().toISOString();
    let tracking = getGapTracking(employee.id);
    if (!tracking) {
      tracking = { startedAt: now, alerted: false };
      setGapTracking(employee.id, tracking);
      continue;
    }

    const gapMinutes = minutesBetween(tracking.startedAt, now);
    if (gapMinutes < threshold) continue;

    if (!tracking.alerted) {
      upsertActivityGap({
        employee_id: employee.id,
        department_id: getUserPrimaryDepartmentId(employee.id),
        started_at: tracking.startedAt,
        detected_at: now,
        status: "open",
        message: GAP_MESSAGE,
        resolved_at: null,
      });
      notifyActivityGap(employee, users);
      setGapTracking(employee.id, { ...tracking, alerted: true });
    }
  }
}

export function listActivityGapsForViewer(
  viewer: User,
  users: User[]
): ActivityGapView[] {
  const store = getFlowStore();
  const now = new Date().toISOString();
  return listActivityGapRecords()
    .filter((g) => g.status === "open")
    .filter((g) => {
      const employee = users.find((u) => u.id === g.employee_id);
      return employee && canViewerSeeUser(viewer, employee.id, users, store.teams);
    })
    .map((g) => {
      const employee = users.find((u) => u.id === g.employee_id);
      const dept = store.departments?.find((d) => d.id === g.department_id);
      return {
        ...g,
        employee_name: employee?.full_name ?? "Unknown",
        department_name: dept?.name ?? null,
        gap_minutes: minutesBetween(g.started_at, now),
      };
    })
    .sort((a, b) => b.gap_minutes - a.gap_minutes);
}

export function buildScopedWorkVisibility(
  viewer: User,
  users: User[],
  packages: WorkPackage[]
): {
  summary: WorkVisibilitySummary;
  employees: EmployeeWorkVisibilityMetrics[];
  activityGaps: ActivityGapView[];
} {
  const store = getFlowStore();
  const settings = getWorkVisibilitySettings();
  const activityGaps = listActivityGapsForViewer(viewer, users);
  const openGapIds = new Set(activityGaps.map((g) => g.employee_id));

  const scoped = users.filter(
    (u) =>
      u.is_active &&
      (u.role === "employee" || u.role === "teamlead") &&
      canViewerSeeUser(viewer, u.id, users, store.teams)
  );

  const employees = scoped.map((u) =>
    buildEmployeeWorkVisibilityMetrics(u, packages, {
      hasActiveActivityGap: openGapIds.has(u.id),
    })
  );

  const summary = buildWorkVisibilitySummary(
    employees,
    activityGaps.length,
    settings.task_tracking_compliance_target_pct
  );

  return { summary, employees, activityGaps };
}
