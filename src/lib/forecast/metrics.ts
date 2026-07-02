import { appTodayDate } from "@/lib/datetime/timezone";
import { getDepartmentName } from "@/lib/departments/resolve";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { forecastVarianceDays } from "@/lib/forecast/engine";
import { isPreStartStatus, primaryDueDate } from "@/lib/forecast/live";
import type {
  ForecastDashboardStats,
  ForecastReportMetrics,
  User,
  WorkPackage,
} from "@/types/flow";
import { addDays, format } from "date-fns";

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

function isActive(pkg: WorkPackage) {
  return ACTIVE.has(pkg.status);
}

function isAtRiskStatus(status: string | null | undefined) {
  return status === "at_risk" || status === "behind_capacity";
}

function isBehindLiveForecast(pkg: WorkPackage) {
  return (
    pkg.live_forecast_status === "behind_forecast" ||
    (pkg.forecast_mode === "active" && pkg.due_date_status === "behind_capacity")
  );
}

function isWaitingToStart(pkg: WorkPackage) {
  return (
    isPreStartStatus(pkg.status) &&
    pkg.assigned_to != null &&
    (pkg.estimated_document_count ?? 0) > 0 &&
    pkg.forecast_mode !== "active"
  );
}

function filterByTeam<T extends { assigned_to?: string | null }>(
  packages: T[],
  viewer?: User,
  storeUsers?: { id: string; team_id?: string | null }[]
) {
  if (viewer?.role !== "teamlead" || !viewer.team_id || !storeUsers) return packages;
  const teamUserIds = new Set(
    storeUsers.filter((u) => u.team_id === viewer.team_id).map((u) => u.id)
  );
  return packages.filter((p) => p.assigned_to && teamUserIds.has(p.assigned_to));
}

export function buildForecastDashboardStats(viewer?: User): ForecastDashboardStats {
  initFlowStore();
  const store = getFlowStore();
  let packages = store.workPackages.filter(isActive);
  let projects = store.projects.filter((p) => p.status === "active");

  packages = filterByTeam(packages, viewer, store.users);
  if (viewer?.role === "teamlead" && viewer.team_id) {
    const projectIds = new Set(packages.map((p) => p.project_id));
    projects = projects.filter((p) => projectIds.has(p.id));
  }

  const in7 = format(addDays(new Date(), 7), "yyyy-MM-dd");
  const today = appTodayDate();

  const deptMap = new Map<string, { activeTasks: number; estimatedHours: number }>();
  for (const pkg of packages) {
    const deptId = pkg.department_id ?? "unknown";
    const cur = deptMap.get(deptId) ?? { activeTasks: 0, estimatedHours: 0 };
    cur.activeTasks += 1;
    cur.estimatedHours += pkg.estimated_work_hours ?? 0;
    deptMap.set(deptId, cur);
  }

  return {
    projectsAtRisk: projects.filter((p) => isAtRiskStatus(p.project_due_date_status)).length,
    tasksAtRisk: packages.filter((p) => isAtRiskStatus(p.due_date_status)).length,
    missingEstimates: packages.filter(
      (p) => !p.estimated_document_count || p.estimated_document_count <= 0
    ).length,
    upcomingDueDates: packages.filter((p) => {
      const due = primaryDueDate(p);
      return due && due >= today && due <= in7;
    }).length,
    behindCapacity: packages.filter((p) => p.due_date_status === "behind_capacity").length,
    needsReview: packages.filter((p) => p.due_date_status === "needs_review").length,
    tasksWaitingToStart: packages.filter(isWaitingToStart).length,
    activeForecasts: packages.filter((p) => p.forecast_mode === "active").length,
    tasksBehindForecast: packages.filter(isBehindLiveForecast).length,
    projectsBehindForecast: projects.filter((p) => {
      const target = p.manual_project_due_date ?? p.due_date;
      const active = p.active_project_due_date ?? p.suggested_project_due_date;
      if (!target || !active) return false;
      return active > target;
    }).length,
    departmentLoad: [...deptMap.entries()].map(([departmentId, v]) => ({
      departmentId,
      departmentName: getDepartmentName(departmentId),
      activeTasks: v.activeTasks,
      estimatedHours: Math.round(v.estimatedHours * 10) / 10,
    })),
  };
}

export function buildForecastReportMetrics(teamMemberIds?: string[]): ForecastReportMetrics {
  initFlowStore();
  const store = getFlowStore();
  let packages = store.workPackages.filter(isActive);
  let projects = store.projects.filter((p) => p.status === "active");

  if (teamMemberIds?.length) {
    const ids = new Set(teamMemberIds);
    packages = packages.filter((p) => p.assigned_to && ids.has(p.assigned_to));
    const projectIds = new Set(packages.map((p) => p.project_id));
    projects = projects.filter((p) => projectIds.has(p.id));
  }

  const withForecast = packages.filter(
    (p) => p.estimated_document_count != null && p.estimated_document_count > 0
  );
  const activeForecastTasks = withForecast.filter((p) => p.forecast_mode === "active");

  const variances = withForecast
    .map((p) =>
      forecastVarianceDays(p.manual_due_date ?? p.due_date, p.suggested_due_date)
    )
    .filter((v): v is number => v != null);

  const activeVariances = activeForecastTasks
    .map((p) => p.forecast_variance_days)
    .filter((v): v is number => v != null);

  const deptMap = new Map<
    string,
    { estimatedHours: number; activeTasks: number; atRisk: number }
  >();
  for (const pkg of packages) {
    const deptId = pkg.department_id ?? "unknown";
    const cur = deptMap.get(deptId) ?? { estimatedHours: 0, activeTasks: 0, atRisk: 0 };
    cur.activeTasks += 1;
    cur.estimatedHours += pkg.estimated_work_hours ?? 0;
    if (isAtRiskStatus(pkg.due_date_status) || isBehindLiveForecast(pkg)) cur.atRisk += 1;
    deptMap.set(deptId, cur);
  }

  const atRiskTasks = packages
    .filter((p) => isAtRiskStatus(p.due_date_status) || isBehindLiveForecast(p))
    .slice(0, 20)
    .map((p) => ({
      id: p.id,
      title: p.title,
      employeeName:
        store.users.find((u) => u.id === p.assigned_to)?.full_name ?? "Unassigned",
      suggestedDueDate: primaryDueDate(p),
      manualDueDate: p.manual_due_date ?? p.due_date ?? null,
      status: p.due_date_status ?? "no_forecast",
    }));

  const atRiskProjects = projects
    .filter((p) => isAtRiskStatus(p.project_due_date_status))
    .map((p) => ({
      id: p.id,
      name: p.name,
      suggestedDueDate: p.active_project_due_date ?? p.suggested_project_due_date ?? null,
      manualDueDate: p.manual_project_due_date ?? p.due_date ?? null,
      status: p.project_due_date_status ?? "no_forecast",
    }));

  return {
    totalEstimatedDocuments: withForecast.reduce(
      (s, p) => s + (p.estimated_document_count ?? 0),
      0
    ),
    totalEstimatedHours: Math.round(
      withForecast.reduce((s, p) => s + (p.estimated_work_hours ?? 0), 0) * 10
    ) / 10,
    totalEstimatedWorkDays: Math.round(
      withForecast.reduce((s, p) => s + (p.estimated_work_days ?? 0), 0) * 10
    ) / 10,
    tasksMissingEstimates: packages.filter(
      (p) => !p.estimated_document_count || p.estimated_document_count <= 0
    ).length,
    projectsMissingEstimates: projects.filter(
      (p) => !p.estimated_total_documents || p.estimated_total_documents <= 0
    ).length,
    tasksAtRisk: packages.filter((p) => isAtRiskStatus(p.due_date_status)).length,
    projectsAtRisk: projects.filter((p) => isAtRiskStatus(p.project_due_date_status)).length,
    tasksOnTrack: packages.filter((p) => p.due_date_status === "on_track").length,
    forecastVarianceAvgDays:
      variances.length > 0
        ? Math.round((variances.reduce((a, b) => a + b, 0) / variances.length) * 10) / 10
        : 0,
    byDepartment: [...deptMap.entries()].map(([departmentId, v]) => ({
      departmentId,
      departmentName: getDepartmentName(departmentId),
      estimatedHours: Math.round(v.estimatedHours * 10) / 10,
      activeTasks: v.activeTasks,
      atRisk: v.atRisk,
    })),
    atRiskTasks,
    atRiskProjects,
    planningVsActiveVarianceAvgDays:
      activeVariances.length > 0
        ? Math.round((activeVariances.reduce((a, b) => a + b, 0) / activeVariances.length) * 10) / 10
        : 0,
    activeForecastCount: activeForecastTasks.length,
    tasksBehindActiveForecast: packages.filter(isBehindLiveForecast).length,
  };
}
