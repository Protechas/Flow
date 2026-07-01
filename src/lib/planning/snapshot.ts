import { getScopeMemberIds } from "@/lib/auth/team-scope";
import { OPS_COPY } from "@/lib/copy/executive-terminology";
import { PLANNING_METRIC_HELP_KEYS } from "@/lib/help/help-text";
import { getDepartmentName } from "@/lib/departments/resolve";
import { getFlowStore, listDepartments } from "@/lib/data/flow-store";
import { getProjectHealthList } from "@/lib/data/project-health";
import { initProductionTracking, getProductionStore } from "@/lib/data/production-tracking";
import { buildForecastDashboardStats } from "@/lib/forecast/metrics";
import { productiveDayCapacityHours } from "@/lib/forecast/capacity";
import { getForecastSettings } from "@/lib/data/flow-store";
import { listHelpFlagsForViewer } from "@/lib/help-flags/engine";
import { listWorkloadAlertsForViewer } from "@/lib/workload-alerts/engine";
import { hydrateWorkVisibilitySettings } from "@/lib/work-visibility/hydrate";
import { buildScopedWorkVisibility } from "@/lib/work-visibility/engine";
import { summarizeTaskForecast } from "@/lib/planning/impact-preview";
import type {
  DepartmentForecastRow,
  ExecutiveForecastSummary,
  ExpectedOutcomesSummary,
  PlanningCenterSnapshot,
  PlanningMetricLink,
  PlanningRecommendation,
  ProjectForecastRow,
  TaskForecastRow,
} from "@/lib/planning/types";
import {
  capacityPctToStatus,
  departmentActionForStatus,
  dueStatusToOutcome,
  dueStatusToRisk,
} from "@/lib/planning/utils";
import { computePackageRemaining } from "@/lib/workload-alerts/calculator";
import { getWrapUpDashboardStats } from "@/lib/wrap-up/review";
import {
  alertCenterHref,
  operationsHref,
  peopleHref,
  projectHealthHref,
  projectsHref,
  qaCenterHref,
  wrapUpsHref,
} from "@/lib/navigation/deep-links";
import { refreshPlanningForecasts } from "@/lib/planning/refresh-forecasts";
import { isProductionEmployee } from "@/lib/users/production-roster";
import type { User, WorkPackage } from "@/types/flow";
import { addDays, addWeeks, format } from "date-fns";

const ACTIVE = new Set([
  "not_started",
  "assigned",
  "working_on_it",
  "waiting",
  "ready_for_qa",
  "in_qa",
  "correction_needed",
  "stuck",
]);

function scopePackages(packages: WorkPackage[], memberIds?: string[]) {
  if (!memberIds) return packages;
  const ids = new Set(memberIds);
  return packages.filter((p) => p.assigned_to && ids.has(p.assigned_to));
}

function buildRecommendations(
  viewer: User,
  snapshot: Omit<PlanningCenterSnapshot, "recommendations">
): PlanningRecommendation[] {
  const recs: PlanningRecommendation[] = [];
  let n = 0;

  const atRisk = snapshot.operationsStatus.find((m) => m.id === "projects_at_risk");
  if (atRisk && Number(atRisk.value) > 0) {
    recs.push({
      id: `rec-${++n}`,
      priority: "high",
      title: "Review projects at risk",
      reasoning: `${atRisk.value} project(s) are forecasted to miss target dates. Review scope, assignments, and due dates.`,
      href: projectHealthHref({ risk: "at_risk" }),
      category: "project",
    });
  }

  const capacity = snapshot.executiveForecast.capacityUtilizationPct;
  if (capacity >= 85) {
    recs.push({
      id: `rec-${++n}`,
      priority: "high",
      title: "Capacity approaching limit",
      reasoning: `Organization capacity utilization is ${capacity}%. Consider rebalancing assignments before adding work.`,
      href: "/planning#departments",
      category: "capacity",
    });
  }

  const qa = snapshot.operationsStatus.find((m) => m.id === "qa_queue");
  if (qa && Number(qa.value) >= 5) {
    recs.push({
      id: `rec-${++n}`,
      priority: "medium",
      title: "QA review bottleneck detected",
      reasoning: `${qa.value} items are in the QA queue. Prioritize reviews to avoid delivery delays.`,
      href: qaCenterHref(),
      category: "qa",
    });
  }

  const wrapUps = snapshot.operationsStatus.find((m) => m.id === "wrap_ups");
  if (wrapUps && Number(wrapUps.value) > 0) {
    recs.push({
      id: `rec-${++n}`,
      priority: "medium",
      title: "Follow up on outstanding daily reports",
      reasoning: `${wrapUps.value} required daily report(s) are still missing today.`,
      href: wrapUpsHref({ status: "missing" }),
      category: "compliance",
    });
  }

  for (const dept of snapshot.departmentForecasts.filter(
    (d) => d.status === "over_capacity" || d.status === "critical"
  )) {
    recs.push({
      id: `rec-${++n}`,
      priority: dept.status === "critical" ? "high" : "medium",
      title: `${dept.departmentName} nearing capacity`,
      reasoning: dept.recommendedAction,
      href: operationsHref({ department: dept.departmentId }),
      category: "department",
    });
  }

  if (snapshot.workVisibility.openActivityGaps > 0) {
    recs.push({
      id: `rec-${++n}`,
      priority: snapshot.workVisibility.score < 70 ? "high" : "medium",
      title: "Review activity documentation gaps",
      reasoning: `${snapshot.workVisibility.openActivityGaps} open activity gap(s) — clocked time without a matching work record.`,
      href: "/reports/work-visibility#gaps",
      category: "visibility",
    });
  }

  if (snapshot.workVisibility.score < 75) {
    recs.push({
      id: `rec-${++n}`,
      priority: "medium",
      title: "Improve work visibility",
      reasoning: `Organization work visibility score is ${snapshot.workVisibility.score}% with ${snapshot.workVisibility.taskTrackingCompliancePct}% task tracking compliance.`,
      href: "/reports/work-visibility",
      category: "visibility",
    });
  }

  const awaiting = snapshot.operationsStatus.find((m) => m.id === "awaiting_assignment");
  if (awaiting && Number(awaiting.value) > 0) {
    recs.push({
      id: `rec-${++n}`,
      priority: "medium",
      title: "Assign available capacity",
      reasoning: `${awaiting.value} team member(s) have capacity for additional assignments.`,
      href: alertCenterHref({ type: "workload" }),
      category: "assignment",
    });
  }

  return recs.slice(0, 12);
}

export async function buildPlanningCenterSnapshot(viewer: User): Promise<PlanningCenterSnapshot> {
  const forecastRefreshedAt = await refreshPlanningForecasts();
  initProductionTracking();
  const store = getFlowStore();
  const settings = getForecastSettings();
  const teams = store.teams;
  const memberIds = getScopeMemberIds(viewer, store.users, teams);

  let packages = store.workPackages.filter((p) => ACTIVE.has(p.status));
  let projects = store.projects.filter((p) => p.status === "active");
  packages = scopePackages(packages, memberIds);
  if (memberIds) {
    const projectIds = new Set(packages.map((p) => p.project_id));
    projects = projects.filter((p) => projectIds.has(p.id));
  }

  const forecastStats = buildForecastDashboardStats(viewer);
  const production = getProductionStore();
  const clockedIn = production.timeClockEntries.filter(
    (e) => e.status === "active" && !e.clock_out_at
  ).length;

  const workloadAlerts = ["admin", "super_admin", "senior_manager", "manager", "teamlead"].includes(
    viewer.role
  )
    ? listWorkloadAlertsForViewer(viewer, store.workPackages, store.users)
    : [];
  const helpFlags = ["admin", "super_admin", "senior_manager", "manager", "teamlead"].includes(
    viewer.role
  )
    ? listHelpFlagsForViewer(viewer, store.workPackages, store.users)
    : [];

  const wrapUpStats = getWrapUpDashboardStats(viewer);
  hydrateWorkVisibilitySettings();
  const { summary: workVisibilitySummary, activityGaps } = buildScopedWorkVisibility(
    viewer,
    store.users,
    packages
  );
  const openActivityGaps = activityGaps.filter((g) => g.status === "open").length;
  const qaQueue = packages.filter((p) =>
    ["ready_for_qa", "in_qa", "correction_needed"].includes(p.status)
  ).length;

  const awaitingAssignment = workloadAlerts.filter(
    (a) => a.alert_type === "no_assigned_work" || a.alert_type === "running_out_of_work"
  ).length;

  const totalRemainingHours = packages.reduce((sum, pkg) => {
    const rem = computePackageRemaining(pkg, settings);
    return sum + (rem.remainingHours ?? 0);
  }, 0);

  const scopedEmployees = memberIds
    ? store.users.filter((u) => memberIds.includes(u.id) && isProductionEmployee(u))
    : store.users.filter(isProductionEmployee);
  const dailyCapacity =
    Math.max(scopedEmployees.length, 1) * productiveDayCapacityHours(settings);
  const capacityUtilizationPct = Math.min(
    100,
    Math.round((totalRemainingHours / dailyCapacity) * 100)
  );

  const projectHealth = await getProjectHealthList();
  const scopedHealth = memberIds
    ? projectHealth.filter((ph) => projects.some((p) => p.id === ph.project.id))
    : projectHealth;

  const operationsStatus: PlanningMetricLink[] = [
    {
      id: "active_projects",
      label: OPS_COPY.activeProjects,
      value: projects.length,
      href: projectsHref(),
    },
    {
      id: "active_tasks",
      label: OPS_COPY.activeTasks,
      value: packages.length,
      href: operationsHref(),
    },
    {
      id: "projects_at_risk",
      label: OPS_COPY.projectsAtRisk,
      value: forecastStats.projectsAtRisk,
      href: projectHealthHref({ risk: "at_risk" }),
      warn: forecastStats.projectsAtRisk > 0,
      critical: forecastStats.projectsAtRisk > 0,
    },
    {
      id: "clocked_in",
      label: OPS_COPY.employeesClockedIn,
      value: clockedIn,
      href: "/time-clock",
    },
    {
      id: "awaiting_assignment",
      label: OPS_COPY.availableCapacity,
      value: awaitingAssignment,
      href: alertCenterHref({ type: "workload" }),
      warn: awaitingAssignment > 0,
    },
    {
      id: "help_flags",
      label: OPS_COPY.openEscalations,
      value: helpFlags.length,
      href: alertCenterHref({ type: "help" }),
      warn: helpFlags.length > 0,
    },
    {
      id: "wrap_ups",
      label: OPS_COPY.outstandingDailyReports,
      value: wrapUpStats.missingToday,
      href: wrapUpsHref({ status: "missing" }),
      warn: wrapUpStats.missingToday > 0,
    },
    {
      id: "qa_queue",
      label: "QA Queue",
      value: qaQueue,
      href: qaCenterHref(),
      warn: qaQueue > 0,
    },
    {
      id: "capacity",
      label: OPS_COPY.capacityUtilization,
      value: `${capacityUtilizationPct}%`,
      href: "/planning#forecast",
      warn: capacityUtilizationPct >= 70,
      critical: capacityUtilizationPct >= 90,
    },
    {
      id: "workload_risk",
      label: OPS_COPY.workloadRisk,
      value: forecastStats.tasksAtRisk + forecastStats.behindCapacity,
      href: operationsHref({ view: "at_risk" }),
      warn: forecastStats.tasksAtRisk > 0,
    },
    {
      id: "work_visibility",
      label: OPS_COPY.workVisibilityScore,
      value: `${workVisibilitySummary.score}%`,
      href: "/reports/work-visibility",
      warn: workVisibilitySummary.score < 85,
      sublabel: `${workVisibilitySummary.taskTrackingCompliancePct}% task tracking`,
    },
    {
      id: "activity_gaps",
      label: OPS_COPY.activityGap,
      value: openActivityGaps,
      href: "/reports/work-visibility#gaps",
      warn: openActivityGaps > 0,
      sublabel:
        openActivityGaps > 0
          ? `${new Set(activityGaps.map((g) => g.employee_id)).size} employees`
          : undefined,
    },
    {
      id: "dept_health",
      label: "Active Departments",
      value: listDepartments().filter((d) => d.status === "active").length,
      href: "/settings/departments",
    },
  ].map((metric) => ({
    ...metric,
    helpKey: PLANNING_METRIC_HELP_KEYS[metric.id],
  }));

  const onTimeProjects = projects.filter(
    (p) => p.project_due_date_status === "on_track" || !p.project_due_date_status
  ).length;
  const lateProjects = projects.filter(
    (p) => p.project_due_date_status === "at_risk" || p.project_due_date_status === "behind_capacity"
  ).length;

  const executiveForecast: ExecutiveForecastSummary = {
    projectsForecastedOnTime: onTimeProjects,
    projectsForecastedLate: lateProjects,
    forecastCompletionRate:
      projects.length > 0 ? Math.round((onTimeProjects / projects.length) * 100) : 100,
    capacityUtilizationPct,
    expectedBacklogHours: Math.round(totalRemainingHours * 10) / 10,
    expectedDeliveriesThisWeek: packages.filter((p) => {
      const due = p.due_date ?? p.suggested_due_date;
      if (!due) return false;
      const in7 = format(addDays(new Date(), 7), "yyyy-MM-dd");
      return due <= in7;
    }).length,
    expectedQaVolume: qaQueue,
    expectedComplianceRate:
      wrapUpStats.submittedToday + wrapUpStats.missingToday > 0
        ? Math.round(
            (wrapUpStats.submittedToday / (wrapUpStats.submittedToday + wrapUpStats.missingToday)) *
              100
          )
        : 100,
    operationalRiskLevel:
      lateProjects > 0 || capacityUtilizationPct >= 90
        ? "critical"
        : forecastStats.tasksAtRisk > 0 || capacityUtilizationPct >= 75
          ? "at_risk"
          : "on_track",
    forecastConfidence:
      packages.length > 0
        ? Math.round(
            (packages.filter((p) => (p.estimated_document_count ?? 0) > 0).length / packages.length) *
              100
          )
        : 100,
  };

  const weekEnd = format(addDays(new Date(), 7), "yyyy-MM-dd");
  const monthEnd = format(addWeeks(new Date(), 4), "yyyy-MM-dd");

  const expectedOutcomes: ExpectedOutcomesSummary = {
    projectCompletionsThisWeek: projects.filter((p) => {
      const due = p.active_project_due_date ?? p.planning_project_due_date ?? p.suggested_project_due_date;
      return due && due <= weekEnd;
    }).length,
    projectCompletionsThisMonth: projects.filter((p) => {
      const due = p.active_project_due_date ?? p.planning_project_due_date ?? p.suggested_project_due_date;
      return due && due <= monthEnd;
    }).length,
    projectsLikelyOnTime: onTimeProjects,
    projectsLikelyLate: lateProjects,
    expectedAvailableCapacityHours: Math.max(
      0,
      Math.round((dailyCapacity - totalRemainingHours) * 10) / 10
    ),
    expectedBacklogGrowthHours: forecastStats.tasksWaitingToStart * (settings.minutes_per_document * 10) / 60,
    expectedBacklogReductionHours: packages.filter((p) => p.status === "done").length,
    expectedQaWorkload: qaQueue,
    expectedComplianceRate: executiveForecast.expectedComplianceRate,
  };

  const departments = listDepartments().filter((d) => d.status === "active");
  const departmentForecasts: DepartmentForecastRow[] = departments.map((dept) => {
    const teamIds = teams.filter((t) => t.department_id === dept.id).map((t) => t.id);
    const deptUserIds = store.users
      .filter((u) => u.is_active && u.team_id && teamIds.includes(u.team_id))
      .map((u) => u.id);
    if (memberIds && !deptUserIds.some((id) => memberIds.includes(id))) {
      return null;
    }

    const deptPackages = packages.filter(
      (p) =>
        p.department_id === dept.id ||
        (p.assigned_to && deptUserIds.includes(p.assigned_to))
    );
    const assignedHours = deptPackages.reduce((sum, pkg) => {
      const rem = computePackageRemaining(pkg, settings);
      return sum + (rem.remainingHours ?? 0);
    }, 0);
    const empCount = Math.max(deptUserIds.length, 1);
    const dailyCap = empCount * productiveDayCapacityHours(settings);
    const currentPct = Math.min(100, Math.round((assignedHours / dailyCap) * 100));
    const status = capacityPctToStatus(currentPct);

    const projectsAtRisk = deptPackages.filter(
      (p) => p.due_date_status === "at_risk" || p.due_date_status === "behind_capacity"
    ).length;

    const latestDue = deptPackages
      .map((p) => p.active_due_date ?? p.planning_due_date ?? p.suggested_due_date)
      .filter(Boolean)
      .sort()
      .pop() ?? null;

    return {
      departmentId: dept.id,
      departmentName: dept.name,
      currentCapacityPct: currentPct,
      forecastCapacityPct: currentPct,
      assignedHours: Math.round(assignedHours * 10) / 10,
      remainingHours: Math.round(assignedHours * 10) / 10,
      availableHours: Math.max(0, Math.round((dailyCap - assignedHours) * 10) / 10),
      projectsAtRisk,
      forecastCompletionDate: latestDue,
      capacityIn7DaysPct: Math.min(100, currentPct + 5),
      capacityIn30DaysPct: Math.min(100, currentPct + 10),
      capacityIn60DaysPct: Math.min(100, currentPct + 15),
      status,
      recommendedAction: departmentActionForStatus(status, dept.name),
    };
  }).filter((d): d is DepartmentForecastRow => d != null);

  const projectForecasts: ProjectForecastRow[] = scopedHealth.map((ph) => {
    const proj = ph.project;
    const risk = dueStatusToRisk(proj.project_due_date_status);
    return {
      projectId: proj.id,
      projectName: proj.name,
      currentStatus: proj.status,
      forecastStatus: proj.project_due_date_status ?? null,
      progressPct: ph.overallProgress,
      forecastCompletionDate:
        proj.active_project_due_date ??
        proj.planning_project_due_date ??
        proj.suggested_project_due_date ??
        ph.projectedCompletion ??
        null,
      forecastConfidence: proj.forecast_confidence ?? 0,
      remainingHours: ph.estimatedRemaining,
      remainingDocuments: Math.max(0, (proj.estimated_total_documents ?? 0) - ph.overallProgress),
      workloadTrend:
        ph.overdueCount > 0 ? "increasing" : ph.blockedCount > 0 ? "stable" : "decreasing",
      riskLevel: risk,
      expectedOutcome: dueStatusToOutcome(proj.project_due_date_status),
    };
  });

  const taskForecasts: TaskForecastRow[] = packages
    .map((pkg) => {
      const summary = summarizeTaskForecast(pkg, settings);
      const project = projects.find((p) => p.id === pkg.project_id);
      const assignee = pkg.assigned_to
        ? store.users.find((u) => u.id === pkg.assigned_to)
        : null;
      return {
        taskId: pkg.id,
        taskTitle: pkg.title,
        projectName: project?.name ?? "—",
        assigneeName: assignee?.full_name ?? null,
        currentStatus: pkg.status,
        progressPct: summary.progressPct,
        documentsCompleted: summary.documentsCompleted,
        documentsRemaining: summary.documentsRemaining,
        estimatedRemainingHours: summary.estimatedRemainingHours,
        forecastCompletionDate: summary.forecastCompletionDate,
        forecastConfidence: summary.forecastConfidence,
        expectedOutcome: summary.expectedOutcome,
        riskLevel: summary.riskLevel,
      };
    })
    .sort((a, b) => {
      const riskOrder = { critical: 0, at_risk: 1, minor_risk: 2, on_track: 3, healthy: 4, near_capacity: 5, over_capacity: 6 };
      return (riskOrder[a.riskLevel] ?? 9) - (riskOrder[b.riskLevel] ?? 9);
    })
    .slice(0, 40);

  const scopeLabel = memberIds
    ? viewer.role === "teamlead"
      ? "Team planning view"
      : "Branch planning view"
    : "Company-wide planning view";

  const partial: Omit<PlanningCenterSnapshot, "recommendations"> = {
    scopeLabel,
    forecastRefreshedAt,
    operationsStatus,
    executiveForecast,
    expectedOutcomes,
    departmentForecasts,
    projectForecasts,
    taskForecasts,
    workVisibility: {
      score: workVisibilitySummary.score,
      taskTrackingCompliancePct: workVisibilitySummary.taskTrackingCompliancePct,
      openActivityGaps,
      employeesWithGaps: new Set(activityGaps.map((g) => g.employee_id)).size,
    },
  };

  return {
    ...partial,
    recommendations: buildRecommendations(viewer, partial),
  };
}
