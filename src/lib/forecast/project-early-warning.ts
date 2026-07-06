import { appTodayDate } from "@/lib/datetime/timezone";
import { calibratedMinutesPerDoc, type CalibratedMinutes } from "@/lib/forecast/calibration";
import { forecastVarianceDays } from "@/lib/forecast/engine";
import { isQueueForecastTask } from "@/lib/forecast/assignee-queue";
import { rankAssigneesForTaskSync } from "@/lib/operations/assignment-suggest";
import { resolveUserLabel } from "@/lib/users/display-name";
import { computePackageRemaining } from "@/lib/workload-alerts/calculator";
import type {
  DueDateStatus,
  ForecastSettings,
  Project,
  QaReview,
  User,
  WorkPackage,
} from "@/types/flow";

const ACTIVE_STATUSES = new Set([
  "not_started",
  "assigned",
  "working_on_it",
  "waiting",
  "ready_for_qa",
  "in_qa",
  "correction_needed",
  "stuck",
]);

const AT_RISK_STATUSES = new Set<DueDateStatus>(["at_risk", "behind_capacity"]);

export type ProjectEarlyWarningSeverity = "critical" | "warning" | "on_track" | "unknown";

export interface ProjectEarlyWarningReassignHint {
  taskId: string;
  taskTitle: string;
  currentAssigneeId: string | null;
  currentAssigneeName: string | null;
  suggestedUserId: string;
  suggestedName: string;
  reasons: string[];
}

export interface ProjectEarlyWarning {
  projectId: string;
  projectName: string;
  targetDate: string | null;
  projectedLandingDate: string | null;
  /** Positive = forecast lands after the target date. */
  daysLate: number | null;
  remainingDocuments: number;
  remainingHours: number;
  velocityMinutesPerDoc: number | null;
  velocitySource: CalibratedMinutes["source"] | null;
  velocitySampleSize: number;
  severity: ProjectEarlyWarningSeverity;
  reasons: string[];
  overloadedAssignees: { userId: string; name: string; openHours: number; openTasks: number }[];
  bottleneckTaskId: string | null;
  reassignHint: ProjectEarlyWarningReassignHint | null;
  headline: string;
}

export interface ProjectEarlyWarningInput {
  projects: Project[];
  packages: WorkPackage[];
  users: User[];
  settings: ForecastSettings;
  qaReviews?: QaReview[];
  analysts?: User[];
  now?: Date;
}

function openHoursFor(pkg: WorkPackage): number {
  if (pkg.estimated_hours && pkg.estimated_hours > 0) return pkg.estimated_hours;
  return 2;
}

function taskRemainingDocs(pkg: WorkPackage): number {
  const total = pkg.estimated_document_count ?? 0;
  if (total <= 0) return 0;
  const completed = pkg.current_documents_completed ?? pkg.file_count ?? 0;
  return Math.max(0, total - completed);
}

function projectedLandingDate(project: Project): string | null {
  return (
    project.active_project_due_date ??
    project.planning_project_due_date ??
    project.suggested_project_due_date ??
    null
  );
}

function severityFrom(
  daysLate: number | null,
  dueStatus: DueDateStatus | null | undefined
): ProjectEarlyWarningSeverity {
  if (dueStatus === "behind_capacity" || (daysLate != null && daysLate >= 3)) return "critical";
  if (dueStatus === "at_risk" || (daysLate != null && daysLate >= 1)) return "warning";
  if (daysLate != null && daysLate <= 0) return "on_track";
  if (dueStatus === "on_track") return "on_track";
  return "unknown";
}

function headlineFor(daysLate: number | null, severity: ProjectEarlyWarningSeverity): string {
  if (severity === "on_track") return "On track for target date";
  if (daysLate == null || daysLate <= 0) {
    if (severity === "critical") return "Behind capacity — review assignments";
    if (severity === "warning") return "At risk of missing target date";
    return "Forecast pending";
  }
  const unit = daysLate === 1 ? "business day" : "business days";
  return `Lands ${daysLate} ${unit} late`;
}

function pickBottleneckTask(tasks: WorkPackage[]): WorkPackage | null {
  const ranked = tasks
    .filter((p) => isQueueForecastTask(p) || AT_RISK_STATUSES.has(p.due_date_status ?? "no_forecast"))
    .sort((a, b) => {
      const statusRank = (s: DueDateStatus | null | undefined) =>
        s === "behind_capacity" ? 0 : s === "at_risk" ? 1 : 9;
      const diff = statusRank(a.due_date_status) - statusRank(b.due_date_status);
      if (diff !== 0) return diff;
      const remA = taskRemainingDocs(a);
      const remB = taskRemainingDocs(b);
      return remB - remA;
    });
  return ranked[0] ?? null;
}

function medianVelocityForProject(
  tasks: WorkPackage[],
  settings: ForecastSettings
): CalibratedMinutes {
  const assignees = [...new Set(tasks.map((p) => p.assigned_to).filter(Boolean))] as string[];
  if (assignees.length === 0) return calibratedMinutesPerDoc(settings);

  const values = assignees.map((id) => calibratedMinutesPerDoc(settings, id));
  const withSamples = values.filter((v) => v.sampleSize > 0);
  if (withSamples.length === 0) return calibratedMinutesPerDoc(settings);

  const best = withSamples.sort((a, b) => b.sampleSize - a.sampleSize)[0];
  return best;
}

export function buildProjectEarlyWarning(
  project: Project,
  packages: WorkPackage[],
  users: User[],
  settings: ForecastSettings,
  qaReviews: QaReview[] = [],
  analysts: User[] = users.filter((u) => u.role === "employee" || u.role === "teamlead"),
  now: Date = new Date()
): ProjectEarlyWarning {
  const activeTasks = packages.filter(
    (p) => p.project_id === project.id && ACTIVE_STATUSES.has(p.status)
  );
  const targetDate = project.manual_project_due_date ?? project.due_date ?? null;
  const landingDate = projectedLandingDate(project);

  const variance = forecastVarianceDays(targetDate, landingDate);
  const daysLate =
    variance == null ? null : variance < 0 ? Math.abs(variance) : 0;
  const dueStatus = project.project_due_date_status ?? null;
  const severity = severityFrom(daysLate, dueStatus);

  let remainingDocuments = 0;
  let remainingHours = 0;
  let missingEstimates = 0;
  let overdueTasks = 0;
  let behindForecastTasks = 0;

  for (const pkg of activeTasks) {
    remainingDocuments += taskRemainingDocs(pkg);
    const rem = computePackageRemaining(pkg, settings);
    remainingHours += rem.remainingHours ?? 0;
    if (rem.needsEstimate) missingEstimates += 1;
    if (pkg.due_date_status && AT_RISK_STATUSES.has(pkg.due_date_status)) behindForecastTasks += 1;
    const due = pkg.active_due_date ?? pkg.planning_due_date ?? pkg.suggested_due_date;
    if (due && due < appTodayDate(now) && pkg.status !== "done") overdueTasks += 1;
  }

  remainingHours = Math.round(remainingHours * 10) / 10;

  const velocity = medianVelocityForProject(activeTasks, settings);
  const reasons: string[] = [];

  if (daysLate != null && daysLate > 0) {
    reasons.push(
      `Forecast completion (${landingDate}) is ${daysLate} business day${daysLate === 1 ? "" : "s"} after the target (${targetDate})`
    );
  } else if (dueStatus === "behind_capacity") {
    reasons.push("Project forecast exceeds available capacity before the target date");
  } else if (dueStatus === "at_risk") {
    reasons.push("Project forecast is within 2 business days of missing the target date");
  }

  if (
    velocity.source !== "settings" &&
    velocity.value > settings.minutes_per_document * 1.05
  ) {
    const label =
      velocity.source === "assignee_history"
        ? "Assignee velocity"
        : "Team velocity";
    reasons.push(
      `${label} averages ${velocity.value} min/doc (configured ${settings.minutes_per_document} min/doc, n=${velocity.sampleSize})`
    );
  }

  if (remainingDocuments > 0) {
    reasons.push(`${remainingDocuments} document${remainingDocuments === 1 ? "" : "s"} remaining across ${activeTasks.length} active task${activeTasks.length === 1 ? "" : "s"}`);
  }

  if (missingEstimates > 0) {
    reasons.push(`${missingEstimates} task${missingEstimates === 1 ? "" : "s"} missing document estimates — forecast confidence is lower`);
  }

  if (overdueTasks > 0) {
    reasons.push(`${overdueTasks} overdue task${overdueTasks === 1 ? "" : "s"} on this project`);
  }

  if (behindForecastTasks > 0) {
    reasons.push(`${behindForecastTasks} task${behindForecastTasks === 1 ? "" : "s"} already flagged at risk or behind forecast`);
  }

  const assigneeLoad = new Map<string, { openHours: number; openTasks: number }>();
  for (const pkg of packages.filter(isQueueForecastTask)) {
    if (!pkg.assigned_to) continue;
    const cur = assigneeLoad.get(pkg.assigned_to) ?? { openHours: 0, openTasks: 0 };
    cur.openHours += openHoursFor(pkg);
    cur.openTasks += 1;
    assigneeLoad.set(pkg.assigned_to, cur);
  }

  const projectAssignees = new Set(
    activeTasks.map((p) => p.assigned_to).filter(Boolean) as string[]
  );
  const overloadedAssignees = [...assigneeLoad.entries()]
    .filter(([userId, load]) => projectAssignees.has(userId) && load.openHours >= 16)
    .map(([userId, load]) => ({
      userId,
      name: resolveUserLabel(userId, users),
      openHours: Math.round(load.openHours * 10) / 10,
      openTasks: load.openTasks,
    }))
    .sort((a, b) => b.openHours - a.openHours);

  for (const assignee of overloadedAssignees.slice(0, 2)) {
    reasons.push(
      `${assignee.name} has ~${assignee.openHours}h queued (${assignee.openTasks} open tasks) — capacity bottleneck`
    );
  }

  const bottleneck = pickBottleneckTask(activeTasks);
  let reassignHint: ProjectEarlyWarningReassignHint | null = null;

  if (
    bottleneck &&
    (severity === "critical" || severity === "warning") &&
    analysts.length > 0
  ) {
    const ranked = rankAssigneesForTaskSync(
      bottleneck,
      packages,
      analysts,
      qaReviews,
      1
    );
    const top = ranked[0];
    if (top) {
      reassignHint = {
        taskId: bottleneck.id,
        taskTitle: bottleneck.title,
        currentAssigneeId: bottleneck.assigned_to ?? null,
        currentAssigneeName: bottleneck.assigned_to
          ? resolveUserLabel(bottleneck.assigned_to, users)
          : null,
        suggestedUserId: top.userId,
        suggestedName: top.name,
        reasons: top.reasons,
      };
      reasons.push(
        `Consider reassigning "${bottleneck.title}" to ${top.name} (${top.reasons[0]})`
      );
    }
  }

  if (reasons.length === 0 && severity === "on_track") {
    reasons.push("Current velocity and queue depth support the target date");
  }

  return {
    projectId: project.id,
    projectName: project.name,
    targetDate,
    projectedLandingDate: landingDate,
    daysLate,
    remainingDocuments,
    remainingHours,
    velocityMinutesPerDoc: velocity.sampleSize > 0 ? velocity.value : null,
    velocitySource: velocity.sampleSize > 0 ? velocity.source : null,
    velocitySampleSize: velocity.sampleSize,
    severity,
    reasons,
    overloadedAssignees,
    bottleneckTaskId: bottleneck?.id ?? null,
    reassignHint,
    headline: headlineFor(daysLate, severity),
  };
}

/** Build early warnings for active projects; skips archived and no-forecast projects unless at risk. */
export function buildProjectEarlyWarnings(input: ProjectEarlyWarningInput): ProjectEarlyWarning[] {
  const {
    projects,
    packages,
    users,
    settings,
    qaReviews = [],
    analysts = users.filter((u) => u.role === "employee" || u.role === "teamlead"),
    now = new Date(),
  } = input;

  return projects
    .filter((p) => p.status === "active")
    .map((project) =>
      buildProjectEarlyWarning(project, packages, users, settings, qaReviews, analysts, now)
    )
    .filter(
      (w) =>
        w.severity === "critical" ||
        w.severity === "warning" ||
        (w.daysLate != null && w.daysLate > 0)
    )
    .sort((a, b) => {
      const severityRank = { critical: 0, warning: 1, unknown: 2, on_track: 3 };
      const diff = severityRank[a.severity] - severityRank[b.severity];
      if (diff !== 0) return diff;
      return (b.daysLate ?? 0) - (a.daysLate ?? 0);
    });
}

export function buildProjectEarlyWarningMap(
  input: ProjectEarlyWarningInput
): Record<string, ProjectEarlyWarning> {
  const map: Record<string, ProjectEarlyWarning> = {};
  for (const project of input.projects.filter((p) => p.status === "active")) {
    map[project.id] = buildProjectEarlyWarning(
      project,
      input.packages,
      input.users,
      input.settings,
      input.qaReviews ?? [],
      input.analysts ?? input.users.filter((u) => u.role === "employee" || u.role === "teamlead"),
      input.now
    );
  }
  return map;
}
