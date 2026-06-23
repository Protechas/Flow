import { getOrganizationalPosition } from "@/lib/auth/access-level";
import { getUserPrimaryDepartmentId } from "@/lib/departments/resolve";
import { getDirectReportIds, getPrimarySupervisorId, getReportingChain } from "@/lib/hierarchy/resolver";
import { HELP_FLAG_REASON_LABELS } from "@/lib/help-flags/constants";
import { listOpenHelpFlags } from "@/lib/help-flags/store";
import { getWorkloadAlertSettings } from "@/lib/workload-alerts/hydrate";
import { listWorkloadAlertRecords } from "@/lib/workload-alerts/store";
import {
  deriveWorkloadAlerts,
  evaluateEmployeeWorkload,
} from "@/lib/workload-alerts/calculator";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { initProductionTracking } from "@/lib/data/production-tracking";
import { getTeamAvailability } from "@/lib/time-clock/get-team-availability";
import { getWrapUpComplianceStatus } from "@/lib/wrap-up/compliance";
import { buildEmployeeScorecard, type PerformanceStoreSlice } from "@/lib/scoring/performance-engine";
import { requiresShiftClock } from "@/lib/users/pay-type";
import type {
  OrgChartNode,
  OrgChartProfileDetail,
  OrgChartStatusFlag,
  OrgChartUserOps,
  User,
  WorkPackage,
} from "@/types/flow";
import { getOrgChartNodeUserId } from "@/lib/positions/resolver";
import { format } from "date-fns";

export function collectOrgChartUserIds(nodes: OrgChartNode[]): string[] {
  const ids: string[] = [];
  function walk(n: OrgChartNode) {
    const uid = getOrgChartNodeUserId(n);
    if (uid) ids.push(uid);
    n.children.forEach(walk);
  }
  nodes.forEach(walk);
  return ids;
}

function buildPerformanceSlice(): PerformanceStoreSlice {
  initFlowStore();
  const store = getFlowStore();
  return {
    users: store.users,
    teams: store.teams,
    workPackages: store.workPackages,
    timeLogs: store.timeLogs,
    qaReviews: store.qaReviews,
    activity: store.activity,
    corrections: store.corrections,
  };
}

export function buildOrgChartOpsMap(
  userIds: string[],
  users: User[],
  packages: WorkPackage[]
): Record<string, OrgChartUserOps> {
  initFlowStore();
  initProductionTracking();
  const store = getFlowStore();
  const settings = getWorkloadAlertSettings();
  const threshold = settings.work_remaining_threshold_hours;
  const today = format(new Date(), "yyyy-MM-dd");

  const openHelp = listOpenHelpFlags();
  const activeAlerts = listWorkloadAlertRecords().filter(
    (a) => a.status === "open"
  );
  const availability = getTeamAvailability(users);
  const availabilityMap = new Map(availability.map((a) => [a.userId, a]));

  const perfSlice = buildPerformanceSlice();
  const result: Record<string, OrgChartUserOps> = {};

  for (const userId of userIds) {
    const user = users.find((u) => u.id === userId);
    if (!user) continue;

    const flags: OrgChartStatusFlag[] = [];
    if (!user.is_active) {
      result[userId] = { userId, flags: ["inactive"], openHelpCount: 0 };
      continue;
    }

    flags.push("active");
    let clockLabel: string | undefined;
    let activeTaskTitle: string | null = null;
    let remainingHours: number | null = null;
    let wrapUpStatus = undefined;
    let flowScore: number | null = null;
    let engagementLevel: "high" | "medium" | "low" | null = null;
    let tasksCompleted: number | undefined;

    const helpForUser = openHelp.filter((h) => h.employee_id === userId);
    if (helpForUser.length) {
      flags.push("needs_help");
    }

    let helpFlagStatus: string | null = null;
    if (helpForUser.length) {
      helpFlagStatus =
        helpForUser.length === 1
          ? HELP_FLAG_REASON_LABELS[helpForUser[0].reason] ?? "Needs help"
          : `${helpForUser.length} open help flags`;
    }

    let workloadStatus: string | null = null;
    let clockStatus: OrgChartUserOps["clockStatus"] = "na";

    if (getOrganizationalPosition(user) === "employee") {
      const avail = availabilityMap.get(userId);
      if (avail) {
        clockLabel = avail.statusLabel;
        activeTaskTitle = avail.activeTaskTitle;
        if (avail.requiresShiftClock) {
          wrapUpStatus = avail.wrapUpStatus ?? getWrapUpComplianceStatus(userId, today);
          if (avail.status === "on_shift" || avail.status === "on_lunch") {
            flags.push("clocked_in");
            clockStatus = "in";
          } else if (avail.status === "off_shift") {
            flags.push("clocked_out");
            clockStatus = "out";
          }
          if (wrapUpStatus === "missing" && requiresShiftClock(user)) {
            flags.push("missing_wrap_up");
          }
        }
      }

      const snapshot = evaluateEmployeeWorkload(user, packages, store.forecastSettings);
      remainingHours = snapshot.remainingHours;
      activeTaskTitle = activeTaskTitle ?? snapshot.activeTask?.title ?? null;

      const derived = deriveWorkloadAlerts(snapshot, threshold);
      const hasWorkloadAlert = activeAlerts.some((a) => a.employee_id === userId);
      const needsWork =
        hasWorkloadAlert ||
        derived.some(
          (d) =>
            d.alert_type === "no_assigned_work" ||
            d.alert_type === "running_out_of_work" ||
            d.alert_type === "needs_more_work_soon"
        ) ||
        (remainingHours !== null && remainingHours <= threshold);

      if (needsWork) {
        flags.push("needs_work");
        workloadStatus =
          derived[0]?.recommended_action ??
          (remainingHours != null ? `${remainingHours}h remaining` : "Needs work");
      } else {
        workloadStatus =
          remainingHours != null ? `${remainingHours}h remaining` : "Healthy workload";
      }

      try {
        const scorecard = buildEmployeeScorecard(user, perfSlice);
        flowScore = scorecard.scoreBreakdown.flowScore;
        engagementLevel = scorecard.engagementLevel;
        tasksCompleted = scorecard.tasksCompleted;
      } catch {
        /* scorecard optional */
      }
    } else if (["manager", "teamlead", "senior_manager"].includes(user.role)) {
      workloadStatus = `${getDirectReportIds(userId, users).length} direct reports`;
      clockStatus = "na";
    }

    result[userId] = {
      userId,
      flags: [...new Set(flags)],
      clockLabel,
      clockStatus,
      activeTaskTitle,
      remainingHours,
      openHelpCount: helpForUser.length,
      helpFlagStatus,
      workloadStatus,
      wrapUpStatus,
      flowScore,
      engagementLevel,
      tasksCompleted,
    };
  }

  return result;
}

export function buildOrgChartProfileDetail(
  userId: string,
  users: User[],
  packages: WorkPackage[],
  opsMap: Record<string, OrgChartUserOps>,
  departments: { id: string; name: string }[],
  teams: { id: string; name: string }[]
): OrgChartProfileDetail | null {
  const user = users.find((u) => u.id === userId);
  if (!user) return null;

  initFlowStore();
  const store = getFlowStore();
  const team = teams.find((t) => t.id === user.team_id);
  const supervisorId = getPrimarySupervisorId(userId, users);
  const supervisor = supervisorId ? users.find((u) => u.id === supervisorId) : null;

  const directReportIds = getDirectReportIds(userId, users);
  const directReports = directReportIds
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is User => !!u)
    .map((u) => ({ id: u.id, name: u.full_name, role: u.role }));

  const openHelp = listOpenHelpFlags().filter((h) => h.employee_id === userId);
  const ops = opsMap[userId] ?? { userId, flags: ["active"], openHelpCount: 0 };
  const reportingChain = getReportingChain(userId, users);

  const activeTasks = packages
    .filter((p) => p.assigned_to === userId && p.status !== "done")
    .slice(0, 8)
    .map((p) => ({ id: p.id, title: p.title, status: p.status }));

  let workloadSummary: string | null = null;
  if (getOrganizationalPosition(user) === "employee") {
    const snapshot = evaluateEmployeeWorkload(user, packages, store.forecastSettings);
    const settings = getWorkloadAlertSettings();
    const derived = deriveWorkloadAlerts(snapshot, settings.work_remaining_threshold_hours);
    if (derived.length) {
      workloadSummary = derived[0].recommended_action;
    } else if (snapshot.remainingHours != null) {
      workloadSummary = `${snapshot.remainingHours}h of work remaining`;
    } else if (snapshot.activeTask) {
      workloadSummary = `Working on ${snapshot.activeTask.title}`;
    } else {
      workloadSummary = "Workload looks healthy";
    }
  }

  const departmentName =
    departments.find((d) => d.id === getUserPrimaryDepartmentId(userId))?.name ?? "—";

  return {
    userId,
    departmentName: departmentName ?? "—",
    teamName: team?.name ?? "—",
    reportsTo: supervisor
      ? { id: supervisor.id, name: supervisor.full_name, role: supervisor.role }
      : null,
    directReports,
    reportingChain,
    activeTasks,
    ops,
    helpFlags: openHelp.map((h) => ({
      id: h.id,
      reason: HELP_FLAG_REASON_LABELS[h.reason] ?? h.reason,
      status: h.status,
      notes: h.notes,
      created_at: h.created_at,
    })),
    workloadSummary,
  };
}

export function countOrgChartAttention(opsMap: Record<string, OrgChartUserOps>) {
  let needsHelp = 0;
  let needsWork = 0;
  let missingWrapUp = 0;
  for (const ops of Object.values(opsMap)) {
    if (ops.flags.includes("needs_help")) needsHelp++;
    if (ops.flags.includes("needs_work")) needsWork++;
    if (ops.flags.includes("missing_wrap_up")) missingWrapUp++;
  }
  return { needsHelp, needsWork, missingWrapUp };
}
