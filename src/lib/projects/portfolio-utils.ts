import { manufacturerRollup, projectRollup } from "@/lib/hierarchy/rollups";
import { formatForecastHours } from "@/lib/forecast/engine";
import { DUE_DATE_STATUS_LABELS } from "@/lib/forecast/constants";
import { isOverdue } from "@/lib/scoring/flow-score";
import type {
  ActivityEvent,
  Department,
  Manufacturer,
  Project,
  QaReview,
  WorkPackage,
  YearWorkItem,
} from "@/types/flow";
import { addDays, isBefore, isWithinInterval, parseISO, startOfDay } from "date-fns";

export type ProjectWithStats = Project & {
  manufacturerCount: number;
  yearCount: number;
  completedPct: number;
  workItemCount?: number;
};

export type PortfolioFilter =
  | "all"
  | "behind_capacity"
  | "due_soon"
  | "missing_tasks"
  | "ready_for_qa"
  | "archived";

export interface PortfolioKpis {
  activeProjects: number;
  behindCapacity: number;
  dueThisWeek: number;
  readyForQa: number;
  totalEstimatedHours: number;
  openTasks: number;
}

export interface NextAction {
  label: string;
  tone: "default" | "warn" | "danger" | "success" | "muted";
}

function primaryDueDate(project: Project): string | null {
  return (
    project.active_project_due_date ??
    project.manual_project_due_date ??
    project.due_date ??
    project.suggested_project_due_date ??
    null
  );
}

function isDueWithinDays(dateStr: string | null | undefined, days: number): boolean {
  if (!dateStr) return false;
  try {
    const due = parseISO(dateStr);
    const today = startOfDay(new Date());
    const end = addDays(today, days);
    return isWithinInterval(due, { start: today, end }) || isBefore(due, today);
  } catch {
    return false;
  }
}

export function projectHasMissingTasks(
  projectId: string,
  manufacturers: Manufacturer[],
  yearItems: YearWorkItem[],
  packages: WorkPackage[]
): boolean {
  const mfrs = manufacturers.filter((m) => m.project_id === projectId && !m.is_archived);
  if (mfrs.length === 0) return false;

  for (const mfr of mfrs) {
    const years = yearItems.filter((y) => y.manufacturer_id === mfr.id);
    if (years.length === 0) return true;
    for (const y of years) {
      if (!packages.some((p) => p.year_work_item_id === y.id)) return true;
    }
  }
  return false;
}

export function projectIsDueSoon(
  project: Project,
  packages: WorkPackage[],
  yearItems: YearWorkItem[]
): boolean {
  if (isDueWithinDays(primaryDueDate(project), 7)) return true;
  if (isDueWithinDays(project.planning_project_due_date, 7)) return true;
  const projPackages = packages.filter((p) => p.project_id === project.id);
  if (projPackages.some((p) => p.status !== "done" && (isOverdue(p) || isDueWithinDays(p.due_date, 7)))) {
    return true;
  }
  const projYears = yearItems.filter((y) => y.project_id === project.id);
  return projYears.some(
    (y) => y.status !== "done" && (isDueWithinDays(y.due_date, 7) || (y.due_date && isBefore(parseISO(y.due_date), startOfDay(new Date()))))
  );
}

export function projectReadyForQa(packages: WorkPackage[], projectId: string): boolean {
  return packages
    .filter((p) => p.project_id === projectId)
    .some((p) => ["ready_for_qa", "in_qa"].includes(p.status));
}

export function buildPortfolioKpis(
  activeProjects: ProjectWithStats[],
  packages: WorkPackage[],
  yearItems: YearWorkItem[],
  manufacturers: Manufacturer[]
): PortfolioKpis {
  const behindCapacity = activeProjects.filter(
    (p) => p.project_due_date_status === "behind_capacity"
  ).length;
  const dueThisWeek = activeProjects.filter((p) =>
    projectIsDueSoon(p, packages, yearItems)
  ).length;
  const readyForQa = activeProjects.filter((p) => projectReadyForQa(packages, p.id)).length;
  const totalEstimatedHours = activeProjects.reduce(
    (sum, p) => sum + Number(p.estimated_total_hours ?? 0),
    0
  );
  const openTasks = packages.filter(
    (p) =>
      activeProjects.some((proj) => proj.id === p.project_id) && p.status !== "done"
  ).length;

  return {
    activeProjects: activeProjects.length,
    behindCapacity,
    dueThisWeek,
    readyForQa,
    totalEstimatedHours,
    openTasks,
  };
}

export function filterProjectsForPortfolio(
  projects: ProjectWithStats[],
  filter: PortfolioFilter,
  packages: WorkPackage[],
  yearItems: YearWorkItem[],
  manufacturers: Manufacturer[]
): ProjectWithStats[] {
  switch (filter) {
    case "archived":
      return projects.filter((p) => p.status === "archived");
    case "behind_capacity":
      return projects.filter(
        (p) => p.status !== "archived" && p.project_due_date_status === "behind_capacity"
      );
    case "due_soon":
      return projects.filter(
        (p) => p.status !== "archived" && projectIsDueSoon(p, packages, yearItems)
      );
    case "missing_tasks":
      return projects.filter(
        (p) =>
          p.status !== "archived" &&
          projectHasMissingTasks(p.id, manufacturers, yearItems, packages)
      );
    case "ready_for_qa":
      return projects.filter(
        (p) => p.status !== "archived" && projectReadyForQa(packages, p.id)
      );
    case "all":
    default:
      return projects.filter((p) => p.status !== "archived");
  }
}

export function getProjectNextAction(
  project: ProjectWithStats,
  manufacturers: Manufacturer[],
  yearItems: YearWorkItem[],
  packages: WorkPackage[]
): NextAction {
  if (project.status === "archived") {
    return { label: "Restore or review archive", tone: "muted" };
  }

  const mfrs = manufacturers.filter((m) => m.project_id === project.id && !m.is_archived);
  if (mfrs.length === 0) {
    return { label: "Add manufacturer", tone: "warn" };
  }

  const years = yearItems.filter((y) => y.project_id === project.id);
  const mfrWithoutYears = mfrs.some(
    (m) => !years.some((y) => y.manufacturer_id === m.id)
  );
  if (mfrWithoutYears) {
    return { label: "Add years", tone: "warn" };
  }

  const yearsWithoutTasks = years.filter(
    (y) => !packages.some((p) => p.year_work_item_id === y.id)
  );
  if (yearsWithoutTasks.length > 0) {
    return { label: "Add tasks", tone: "warn" };
  }

  const unassigned = packages.filter(
    (p) => p.project_id === project.id && !p.assigned_to && p.status !== "done"
  );
  if (unassigned.length > 0) {
    return { label: "Assign tasks", tone: "warn" };
  }

  if (project.project_due_date_status === "behind_capacity") {
    return { label: "Fix due date", tone: "danger" };
  }

  if (projectReadyForQa(packages, project.id)) {
    return { label: "Review QA", tone: "warn" };
  }

  if (project.project_due_date_status === "at_risk") {
    return { label: "Review forecast risk", tone: "warn" };
  }

  return { label: "Project on track", tone: "success" };
}

export function getManufacturerNextAction(
  mfr: Manufacturer,
  years: YearWorkItem[],
  packages: WorkPackage[]
): NextAction {
  if (years.length === 0) {
    return { label: "Add years", tone: "warn" };
  }
  const emptyYears = years.filter((y) => !packages.some((p) => p.year_work_item_id === y.id));
  if (emptyYears.length > 0) {
    return { label: "Add tasks", tone: "warn" };
  }
  const qaReady = packages.filter((p) => ["ready_for_qa", "in_qa"].includes(p.status));
  if (qaReady.length > 0) {
    return { label: "Review QA", tone: "warn" };
  }
  if (packages.some((p) => p.correction_count > 0 && p.status === "correction_needed")) {
    return { label: "Resolve corrections", tone: "danger" };
  }
  return { label: "On track", tone: "success" };
}

export function formatProjectType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function departmentLabel(project: Project, departments: Department[]): string {
  if (!project.department_id) return "No department";
  return departments.find((d) => d.id === project.department_id)?.name ?? "Department";
}

export function healthStatusLabel(status: Project["project_due_date_status"]): string {
  const key = status ?? "no_forecast";
  return DUE_DATE_STATUS_LABELS[key as keyof typeof DUE_DATE_STATUS_LABELS] ?? "No Forecast";
}

export function formatLastActivity(iso: string | null | undefined): string {
  if (!iso) return "No recent activity";
  try {
    const d = parseISO(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

export function buildProjectRollupContext(
  project: Project,
  packages: WorkPackage[],
  manufacturers: Manufacturer[],
  yearItems: YearWorkItem[],
  qaReviews: QaReview[],
  activity: ActivityEvent[]
) {
  const projPackages = packages.filter((p) => p.project_id === project.id);
  const projYears = yearItems.filter((y) => y.project_id === project.id);
  return projectRollup(project, projPackages, manufacturers, qaReviews, projYears, activity);
}

export function buildManufacturerRollupContext(
  mfr: Manufacturer,
  packages: WorkPackage[],
  yearItems: YearWorkItem[],
  qaReviews: QaReview[],
  activity: ActivityEvent[]
) {
  const mfrPackages = packages.filter((p) => p.manufacturer_id === mfr.id);
  const mfrYears = yearItems.filter((y) => y.manufacturer_id === mfr.id);
  return manufacturerRollup(mfr, mfrPackages, qaReviews, mfrYears, activity);
}

export function formatHoursSummary(hours: number | null | undefined): string {
  if (hours == null) return "—";
  return formatForecastHours(hours);
}

export function kpiFilterForCard(
  id: "active" | "behind" | "due" | "qa" | "hours" | "open"
): PortfolioFilter | "hours_sort" {
  switch (id) {
    case "active":
      return "all";
    case "behind":
      return "behind_capacity";
    case "due":
      return "due_soon";
    case "qa":
      return "ready_for_qa";
    case "open":
      return "all";
    default:
      return "hours_sort";
  }
}
