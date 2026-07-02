import { appTodayDate } from "@/lib/datetime/timezone";
import { healthLevelFromScore } from "@/lib/design/department-health";
import { getFlowStore, initFlowStore, listDepartments } from "@/lib/data/flow-store";
import { forecastVarianceDays } from "@/lib/forecast/engine";
import { primaryDueDate } from "@/lib/forecast/live";
import { resolveLeadersForEmployee } from "@/lib/hierarchy/resolver";
import {
  deliverNotification,
} from "@/lib/notifications/notifications";
import { isOverdue } from "@/lib/scoring/flow-score";
import { getWrapUpComplianceStatus } from "@/lib/wrap-up/compliance";
import { isWrapUpRequiredForDate } from "@/lib/wrap-up/eligibility";
import { getManagersForPackage, getProjectOwner } from "@/lib/workflow/recipients";
import { requiresShiftClock } from "@/lib/users/pay-type";
import type { NotificationType, User, WorkPackage } from "@/types/flow";

const DEDUPE_HOURS = 12;

function notify(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  entityType: string,
  entityId: string,
  link: string,
  users: User[]
) {
  if (!userId) return;
  const user = users.find((u) => u.id === userId && u.is_active);
  if (!user) return;

  deliverNotification(
    {
      user_id: userId,
      type,
      title,
      message,
      related_entity_type: entityType,
      related_entity_id: entityId,
      link,
    },
    DEDUPE_HOURS
  );
}

function isBehindForecast(pkg: WorkPackage): boolean {
  return (
    pkg.live_forecast_status === "behind_forecast" ||
    (pkg.forecast_mode === "active" && pkg.due_date_status === "behind_capacity") ||
    pkg.due_date_status === "at_risk"
  );
}

/** Notify employees and leaders about missing daily wrap-ups. */
export function syncWrapUpNotifications(users: User[]) {
  const today = appTodayDate();

  for (const emp of users.filter((u) => u.is_active && requiresShiftClock(u))) {
    if (!isWrapUpRequiredForDate(emp, today)) continue;
    if (getWrapUpComplianceStatus(emp.id, today) !== "missing") continue;

    notify(
      emp.id,
      "missing_wrap_up",
      "Wrap-up missing",
      `Your daily wrap-up for ${today} has not been submitted.`,
      "user",
      emp.id,
      "/work",
      users
    );

    for (const leader of resolveLeadersForEmployee(emp, users, {
      includeSeniorManager: true,
      includeAdminFallback: false,
    })) {
      notify(
        leader.id,
        "missing_wrap_up",
        "Missing wrap-up",
        `${emp.full_name} has not submitted today's wrap-up.`,
        "user",
        emp.id,
        "/wrap-ups",
        users
      );
    }
  }
}

/** Notify assignees and leaders when tasks drift behind forecast. */
export function syncForecastRiskNotifications(
  users: User[],
  packages: WorkPackage[]
) {
  initFlowStore();
  const store = getFlowStore();

  for (const pkg of packages) {
    if (pkg.status === "done" || !isBehindForecast(pkg)) continue;

    const variance =
      pkg.forecast_variance_days ??
      forecastVarianceDays(pkg.manual_due_date ?? pkg.due_date, pkg.suggested_due_date);
    const due = primaryDueDate(pkg);
    const detail = variance != null ? `${variance}d behind forecast` : "Behind forecast";
    const message = `"${pkg.title}" is at risk — ${detail}${due ? ` (due ${due})` : ""}.`;

    if (pkg.assigned_to) {
      notify(
        pkg.assigned_to,
        "forecast_risk",
        "Forecast risk on your task",
        message,
        "work_package",
        pkg.id,
        `/work/${pkg.id}`,
        users
      );
    }

    const leaders = new Set<string>();
    for (const mgr of getManagersForPackage(pkg, users, store.projects)) {
      leaders.add(mgr.id);
    }
    const owner = getProjectOwner(pkg.project_id, store.projects, users);
    if (owner) leaders.add(owner.id);

    for (const leaderId of leaders) {
      notify(
        leaderId,
        "forecast_risk",
        "Forecast risk",
        message,
        "work_package",
        pkg.id,
        `/operations?package=${pkg.id}`,
        users
      );
    }
  }
}

/** Notify department leads when health drops to at-risk or critical. */
export function syncDepartmentAlertNotifications(users: User[]) {
  initFlowStore();
  const store = getFlowStore();
  const departments = listDepartments().filter((d) => d.status === "active");

  for (const dept of departments) {
    const teamIds = store.teams.filter((t) => t.department_id === dept.id).map((t) => t.id);
    const memberIds = store.users
      .filter((u) => u.is_active && u.team_id && teamIds.includes(u.team_id))
      .map((u) => u.id);

    const deptPackages = store.workPackages.filter(
      (p) =>
        p.department_id === dept.id ||
        (p.assigned_to && memberIds.includes(p.assigned_to))
    );
    const activeTasks = deptPackages.filter((p) => p.status !== "done").length;
    const overdueTasks = deptPackages.filter(isOverdue).length;

    let score = 100;
    const factors: string[] = [];
    if (overdueTasks > 0) {
      score -= Math.min(30, overdueTasks * 4);
      factors.push(`${overdueTasks} overdue`);
    }
    if (activeTasks > 0 && overdueTasks / activeTasks > 0.2) {
      score -= 10;
      factors.push("High overdue ratio");
    }
    score = Math.max(0, Math.min(100, score));

    const level = healthLevelFromScore(score);
    if (level !== "at_risk" && level !== "critical") continue;

    const recipients = new Set<string>();
    if (dept.lead_user_id) recipients.add(dept.lead_user_id);
    for (const u of users.filter(
      (x) => x.is_active && ["admin", "super_admin", "senior_manager"].includes(x.role)
    )) {
      recipients.add(u.id);
    }

    const message = `${dept.name} is ${level.replace("_", " ")} — ${factors.join(", ") || "review department metrics"}.`;

    for (const userId of recipients) {
      notify(
        userId,
        "department_alert",
        `Department ${level === "critical" ? "critical" : "at risk"}`,
        message,
        "department",
        dept.id,
        "/executive",
        users
      );
    }
  }
}

export function syncOperationalNotifications() {
  initFlowStore();
  const store = getFlowStore();
  const users = store.users.filter((u) => u.is_active);

  syncWrapUpNotifications(users);
  syncForecastRiskNotifications(users, store.workPackages);
  syncDepartmentAlertNotifications(users);
}
