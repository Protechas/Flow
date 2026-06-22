import {
  aggregateProjectForecast,
  calculateTaskForecast,
  forecastVarianceDays,
} from "@/lib/forecast/engine";
import { recommendAssignees, type AssigneeLiveHints } from "@/lib/planning/assignee-recommendations";
import type {
  DelayImpactLevel,
  TaskImpactDraft,
  TaskImpactPreview,
  WhatIfInput,
  WhatIfResult,
} from "@/lib/planning/types";
import {
  capacityPctToStatus,
  dueStatusToOutcome,
  dueStatusToRisk,
} from "@/lib/planning/utils";
import { computePackageRemaining } from "@/lib/workload-alerts/calculator";
import { primaryDueDate } from "@/lib/forecast/live";
import type { ForecastSettings, Project, User, WorkPackage } from "@/types/flow";
import { format } from "date-fns";

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

function deptAssignedHours(
  departmentId: string,
  packages: WorkPackage[],
  settings: ForecastSettings
): number {
  return packages
    .filter((p) => ACTIVE.has(p.status) && p.department_id === departmentId)
    .reduce((sum, pkg) => {
      const rem = computePackageRemaining(pkg, settings);
      return sum + (rem.remainingHours ?? 0);
    }, 0);
}

function deptEmployeeCount(
  departmentId: string,
  users: User[],
  teams: { id: string; department_id: string }[]
): number {
  const teamIds = new Set(teams.filter((t) => t.department_id === departmentId).map((t) => t.id));
  return users.filter((u) => u.is_active && u.team_id && teamIds.has(u.team_id)).length;
}

function capacityPct(
  assignedHours: number,
  employeeCount: number,
  productiveHoursPerDay: number
): number {
  const dailyCapacity = Math.max(employeeCount, 1) * productiveHoursPerDay;
  if (dailyCapacity <= 0) return 0;
  return Math.min(100, Math.round((assignedHours / dailyCapacity) * 100));
}

function delayLevel(businessDays: number): DelayImpactLevel {
  if (businessDays <= 0) return "none";
  if (businessDays <= 1) return "minor";
  if (businessDays <= 3) return "moderate";
  return "severe";
}

function departmentLabel(
  departmentId: string,
  departments?: { id: string; name: string }[]
): string {
  if (!departmentId || departmentId === "unknown") return "department";
  return departments?.find((d) => d.id === departmentId)?.name ?? departmentId;
}

export function previewTaskImpact(
  draft: TaskImpactDraft,
  context: {
    viewer: User;
    users: User[];
    packages: WorkPackage[];
    projects: Project[];
    teams: { id: string; department_id: string }[];
    settings: ForecastSettings;
    departments?: { id: string; name: string }[];
    liveHints?: AssigneeLiveHints;
  }
): TaskImpactPreview {
  const { users, packages, projects, teams, settings, viewer, departments, liveHints } = context;
  const startDate = format(new Date(), "yyyy-MM-dd");

  const taskForecast = calculateTaskForecast(
    {
      estimated_document_count: draft.estimated_document_count,
      complexity_level: draft.complexity_level,
      start_date: startDate,
      manual_due_date: draft.manual_due_date ?? null,
      due_date: draft.manual_due_date ?? null,
    },
    { settings }
  );

  const addedHours = taskForecast.estimated_work_hours ?? 0;
  const deptId = draft.department_id ?? "unknown";
  const empCount = deptEmployeeCount(deptId, users, teams);
  const beforeHours = deptAssignedHours(deptId, packages, settings);
  const afterHours = beforeHours + addedHours;
  const currentPct = capacityPct(beforeHours, empCount, settings.productive_hours_per_day);
  const afterPct = capacityPct(afterHours, empCount, settings.productive_hours_per_day);

  const businessDaysDelayed =
    addedHours > 0
      ? Math.ceil(addedHours / Math.max(settings.productive_hours_per_day, 0.5))
      : 0;

  const deptDelayLevel = delayLevel(businessDaysDelayed);
  const deptName = departmentLabel(deptId, departments);
  const atRiskProjects = packages.filter(
    (p) =>
      ACTIVE.has(p.status) &&
      p.department_id === deptId &&
      (p.due_date_status === "at_risk" || p.due_date_status === "behind_capacity")
  ).length;

  let deptExplanation = `This task adds ${addedHours.toFixed(1)} estimated hours to ${deptName}.`;
  if (deptDelayLevel === "none") {
    deptExplanation += " No material delay to active delivery is projected.";
  } else if (deptDelayLevel === "minor") {
    deptExplanation += ` May add minor scheduling pressure (~${businessDaysDelayed} business day).`;
  } else {
    deptExplanation += ` May delay approximately ${businessDaysDelayed} business day(s) across active work${
      atRiskProjects > 0 ? ` and affect ${atRiskProjects} at-risk project(s)` : ""
    }.`;
  }

  let projectDelay: TaskImpactPreview["projectDelay"] = {
    currentForecastDate: null,
    newForecastDate: null,
    daysAdded: 0,
    riskChange: "No project scope",
    applies: false,
  };

  if (draft.project_id) {
    const project = projects.find((p) => p.id === draft.project_id);
    const projectPackages = packages.filter((p) => p.project_id === draft.project_id);
    const beforeRollup = aggregateProjectForecast(
      projectPackages,
      project?.manual_project_due_date ?? project?.due_date,
      project?.due_date
    );
    const currentDate =
      beforeRollup.active_project_due_date ??
      beforeRollup.planning_project_due_date ??
      beforeRollup.suggested_project_due_date;

    const syntheticPkg = {
      id: "__preview__",
      project_id: draft.project_id,
      title: draft.title,
      status: "not_started",
      priority: "medium",
      estimated_document_count: draft.estimated_document_count,
      complexity_level: draft.complexity_level,
      estimated_work_hours: addedHours,
      estimated_work_days: taskForecast.estimated_work_days,
      suggested_due_date: taskForecast.suggested_due_date,
      planning_due_date: taskForecast.suggested_due_date,
      due_date_status: taskForecast.due_date_status,
      forecast_mode: "planning",
      assigned_to: draft.assigned_to ?? null,
      department_id: draft.department_id ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as WorkPackage;

    const afterRollup = aggregateProjectForecast(
      [...projectPackages, syntheticPkg],
      project?.manual_project_due_date ?? project?.due_date,
      project?.due_date
    );
    const newDate =
      afterRollup.active_project_due_date ??
      afterRollup.planning_project_due_date ??
      afterRollup.suggested_project_due_date;

    const daysAdded =
      currentDate && newDate ? forecastVarianceDays(currentDate, newDate) : businessDaysDelayed;

    const beforeRisk = beforeRollup.project_due_date_status;
    const afterRisk = afterRollup.project_due_date_status;

    projectDelay = {
      currentForecastDate: currentDate,
      newForecastDate: newDate,
      daysAdded: Math.max(0, daysAdded ?? businessDaysDelayed),
      riskChange:
        beforeRisk === afterRisk
          ? "Unchanged"
          : `${beforeRisk ?? "unknown"} → ${afterRisk ?? "unknown"}`,
      applies: true,
    };
  }

  const recommendedAssignees = recommendAssignees(
    draft,
    viewer,
    users,
    packages,
    settings,
    5,
    2,
    liveHints
  );

  return {
    taskForecast: {
      estimatedHours: addedHours,
      estimatedWorkDays: taskForecast.estimated_work_days ?? 0,
      suggestedDueDate: taskForecast.suggested_due_date,
      dueDateStatus: taskForecast.due_date_status,
      forecastConfidence: draft.estimated_document_count ? 100 : 0,
    },
    departmentDelay: {
      level: deptDelayLevel,
      explanation: deptExplanation,
      addedHours,
      businessDaysDelayed,
    },
    projectDelay,
    capacity: {
      currentPct,
      afterPct,
      changePct: afterPct - currentPct,
      status: capacityPctToStatus(afterPct),
    },
    riskLevel: dueStatusToRisk(taskForecast.due_date_status),
    expectedOutcome: dueStatusToOutcome(taskForecast.due_date_status),
    recommendedAssignees,
  };
}

export function simulateWhatIf(
  input: WhatIfInput,
  context: {
    users: User[];
    packages: WorkPackage[];
    projects: Project[];
    teams: { id: string; department_id: string }[];
    settings: ForecastSettings;
    departments?: { id: string; name: string }[];
  }
): WhatIfResult {
  const draft: TaskImpactDraft = {
    title: "What-if task",
    estimated_document_count: input.documentCount > 0 ? input.documentCount : null,
    complexity_level: input.complexity,
    manual_due_date: input.manualDueDate,
    department_id: input.departmentId,
    project_id: input.projectId,
    assigned_to: input.assigneeId,
  };

  const preview = previewTaskImpact(draft, {
    viewer: context.users[0],
    ...context,
  });

  return {
    taskHours: preview.taskForecast.estimatedHours,
    taskDays: preview.taskForecast.estimatedWorkDays,
    suggestedDue: preview.taskForecast.suggestedDueDate,
    departmentCapacityAfterPct: preview.capacity.afterPct,
    projectDaysAdded: preview.projectDelay.daysAdded,
    riskLevel: preview.riskLevel,
    expectedOutcome: preview.expectedOutcome,
  };
}

export function summarizeTaskForecast(pkg: WorkPackage, settings: ForecastSettings) {
  const docTotal = pkg.estimated_document_count ?? 0;
  const completed = pkg.current_documents_completed ?? pkg.file_count ?? 0;
  const remaining = Math.max(0, docTotal - completed);
  const rem = computePackageRemaining(pkg, settings);
  const due = primaryDueDate(pkg);
  const progressPct =
    docTotal > 0 ? Math.round((completed / docTotal) * 100) : pkg.status === "done" ? 100 : 0;

  return {
    progressPct,
    documentsCompleted: completed,
    documentsRemaining: remaining,
    estimatedRemainingHours: rem.remainingHours ?? 0,
    forecastCompletionDate: due,
    forecastConfidence: docTotal > 0 ? 100 : 0,
    riskLevel: dueStatusToRisk(pkg.due_date_status),
    expectedOutcome: dueStatusToOutcome(pkg.due_date_status),
  };
}
