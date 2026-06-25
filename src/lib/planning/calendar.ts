import { primaryDueDate } from "@/lib/forecast/live";
import { dueStatusToRisk } from "@/lib/planning/utils";
import type { PlanningRiskLevel } from "@/lib/planning/types";
import type { Department, Project, WorkPackage } from "@/types/flow";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";

const ACTIVE_TASK = new Set([
  "not_started",
  "assigned",
  "working_on_it",
  "waiting",
  "ready_for_qa",
  "in_qa",
  "correction_needed",
  "stuck",
]);

export type PlanningCalendarEventKind =
  | "task_forecast"
  | "task_due"
  | "project_forecast"
  | "department_forecast";

export interface PlanningCalendarEvent {
  id: string;
  date: string;
  kind: PlanningCalendarEventKind;
  title: string;
  subtitle?: string;
  href?: string;
  riskLevel: PlanningRiskLevel;
  departmentId?: string | null;
  departmentName?: string | null;
  hoursRemaining?: number | null;
  statusLabel?: string;
}

export interface PlanningCalendarDaySummary {
  date: string;
  events: PlanningCalendarEvent[];
  taskCount: number;
  projectCount: number;
  atRiskCount: number;
}

export interface PlanningCalendarBuildInput {
  workPackages: WorkPackage[];
  projects: Project[];
  departments: Department[];
  departmentForecasts?: {
    departmentId: string;
    departmentName: string;
    forecastCompletionDate: string | null;
    status: string;
  }[];
}

function projectForecastDate(project: Project): string | null {
  return (
    project.active_project_due_date ??
    project.planning_project_due_date ??
    project.suggested_project_due_date ??
    project.due_date ??
    null
  );
}

function taskCommittedDue(pkg: WorkPackage): string | null {
  return pkg.manual_due_date ?? pkg.due_date ?? null;
}

function deptName(deptId: string | null | undefined, departments: Department[]): string | null {
  if (!deptId) return null;
  return departments.find((d) => d.id === deptId)?.name ?? null;
}

function isAtRisk(risk: PlanningRiskLevel): boolean {
  return risk === "at_risk" || risk === "critical";
}

export function buildPlanningCalendarEvents(input: PlanningCalendarBuildInput): PlanningCalendarEvent[] {
  const { workPackages, projects, departments, departmentForecasts = [] } = input;
  const events: PlanningCalendarEvent[] = [];

  for (const pkg of workPackages) {
    if (!ACTIVE_TASK.has(pkg.status)) continue;

    const forecast = primaryDueDate(pkg);
    const committed = taskCommittedDue(pkg);
    const risk = dueStatusToRisk(pkg.due_date_status);
    const project = projects.find((p) => p.id === pkg.project_id);
    const subtitle = [project?.name, pkg.status.replace(/_/g, " ")].filter(Boolean).join(" · ");

    if (forecast) {
      events.push({
        id: `task-forecast-${pkg.id}`,
        date: forecast,
        kind: "task_forecast",
        title: pkg.title,
        subtitle,
        href: `/operations?package=${pkg.id}`,
        riskLevel: risk,
        departmentId: pkg.department_id,
        departmentName: deptName(pkg.department_id, departments),
        statusLabel: "Forecast completion",
      });
    }

    if (committed && committed !== forecast) {
      events.push({
        id: `task-due-${pkg.id}`,
        date: committed,
        kind: "task_due",
        title: pkg.title,
        subtitle,
        href: `/operations?package=${pkg.id}`,
        riskLevel: risk,
        departmentId: pkg.department_id,
        departmentName: deptName(pkg.department_id, departments),
        statusLabel: "Committed due date",
      });
    }
  }

  for (const project of projects) {
    if (project.status !== "active") continue;
    const date = projectForecastDate(project);
    if (!date) continue;
    const risk = dueStatusToRisk(project.project_due_date_status);
    events.push({
      id: `project-forecast-${project.id}`,
      date,
      kind: "project_forecast",
      title: project.name,
      subtitle: "Project forecast completion",
      href: `/projects/${project.id}`,
      riskLevel: risk,
      statusLabel: "Project forecast",
    });
  }

  for (const dept of departmentForecasts) {
    if (!dept.forecastCompletionDate) continue;
    events.push({
      id: `dept-forecast-${dept.departmentId}`,
      date: dept.forecastCompletionDate,
      kind: "department_forecast",
      title: `${dept.departmentName} workload peak`,
      subtitle: "Latest task forecast in department",
      href: `/operations?department=${dept.departmentId}`,
      riskLevel:
        dept.status === "critical" || dept.status === "over_capacity" ? "at_risk" : "on_track",
      departmentId: dept.departmentId,
      departmentName: dept.departmentName,
      statusLabel: "Department forecast",
    });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

export function groupEventsByDate(events: PlanningCalendarEvent[]): Map<string, PlanningCalendarEvent[]> {
  const map = new Map<string, PlanningCalendarEvent[]>();
  for (const event of events) {
    const list = map.get(event.date) ?? [];
    list.push(event);
    map.set(event.date, list);
  }
  return map;
}

export function summarizeCalendarDay(
  date: string,
  events: PlanningCalendarEvent[]
): PlanningCalendarDaySummary {
  return {
    date,
    events,
    taskCount: events.filter((e) => e.kind === "task_forecast" || e.kind === "task_due").length,
    projectCount: events.filter((e) => e.kind === "project_forecast").length,
    atRiskCount: events.filter((e) => isAtRisk(e.riskLevel)).length,
  };
}

export function getCalendarMonthGrid(month: Date): { date: Date; inMonth: boolean }[] {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  return eachDayOfInterval({ start: gridStart, end: gridEnd }).map((date) => ({
    date,
    inMonth: isSameMonth(date, month),
  }));
}

export function getCalendarWeekDays(anchor: Date): Date[] {
  const weekStart = startOfWeek(anchor, { weekStartsOn: 0 });
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function formatCalendarDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function parseCalendarDateKey(key: string): Date {
  return parseISO(key);
}

export function filterCalendarEvents(
  events: PlanningCalendarEvent[],
  filters: {
    kinds: PlanningCalendarEventKind[];
    departmentId?: string | null;
    atRiskOnly?: boolean;
  }
): PlanningCalendarEvent[] {
  return events.filter((event) => {
    if (!filters.kinds.includes(event.kind)) return false;
    if (filters.departmentId && event.departmentId !== filters.departmentId) return false;
    if (filters.atRiskOnly && !isAtRisk(event.riskLevel)) return false;
    return true;
  });
}

export const CALENDAR_KIND_LABELS: Record<PlanningCalendarEventKind, string> = {
  task_forecast: "Task forecast",
  task_due: "Committed due",
  project_forecast: "Project forecast",
  department_forecast: "Department peak",
};
