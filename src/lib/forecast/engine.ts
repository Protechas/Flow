import {
  DEFAULT_PRODUCTIVE_DAY_PERCENT,
  percentToProductiveHours,
  productiveDayCapacityHours,
} from "@/lib/forecast/capacity";
import {
  FORECAST_COMPLEXITY_MULTIPLIERS,
  type DueDateStatus,
  type ForecastComplexityLevel,
  type ForecastRateScope,
  type ForecastSettings,
  type ProjectForecastRollup,
  type TaskForecastInput,
  type TaskForecastResult,
  type WorkPackage,
} from "@/types/flow";
import {
  addBusinessDays,
  differenceInBusinessDays,
  format,
  isValid,
  parseISO,
  startOfDay,
} from "date-fns";

export const DEFAULT_FORECAST_SETTINGS: Omit<ForecastSettings, "id" | "updated_at"> = {
  minutes_per_document: 7,
  productive_day_percent: DEFAULT_PRODUCTIVE_DAY_PERCENT,
  productive_hours_per_day: percentToProductiveHours(DEFAULT_PRODUCTIVE_DAY_PERCENT),
  working_days: [1, 2, 3, 4, 5],
  updated_by: null,
};

export function getComplexityMultiplier(level?: ForecastComplexityLevel | null): number {
  return FORECAST_COMPLEXITY_MULTIPLIERS[level ?? "standard"];
}

function isWorkingDay(date: Date, workingDays: number[]): boolean {
  return workingDays.includes(date.getDay());
}

/** Add fractional work days using org working-day calendar */
export function addWorkDays(startDate: string, workDays: number, workingDays: number[]): string {
  const start = startOfDay(parseISO(startDate));
  if (!isValid(start) || workDays <= 0) return startDate;

  let remaining = workDays;
  let current = start;

  while (remaining > 0) {
    current = addBusinessDays(current, 1);
    if (isWorkingDay(current, workingDays)) {
      remaining -= 1;
    }
  }

  const fraction = workDays - Math.floor(workDays);
  if (fraction > 0 && fraction < 1) {
    // Partial day: round up to next working day for conservative planning
    if (!isWorkingDay(current, workingDays)) {
      do {
        current = addBusinessDays(current, 1);
      } while (!isWorkingDay(current, workingDays));
    }
  }

  return format(current, "yyyy-MM-dd");
}

export function compareDueDateStatus(
  manualDate: string | null | undefined,
  suggestedDate: string | null | undefined
): DueDateStatus {
  if (!suggestedDate) return "no_forecast";
  if (!manualDate) return "needs_review";

  const manual = parseISO(manualDate);
  const suggested = parseISO(suggestedDate);
  if (!isValid(manual) || !isValid(suggested)) return "needs_review";

  // Positive = manual is later than suggested (more buffer)
  const diff = differenceInBusinessDays(manual, suggested);
  if (diff >= 0) return "on_track";
  if (diff >= -2) return "at_risk";
  return "behind_capacity";
}

export interface CalculateTaskForecastOptions {
  settings: ForecastSettings;
  /** Future: department/employee production rates */
  rateScope?: ForecastRateScope;
  now?: Date;
}

export function calculateTaskForecast(
  input: TaskForecastInput,
  options: CalculateTaskForecastOptions
): TaskForecastResult {
  const { settings } = options;
  const now = options.now ?? new Date();
  const complexity = input.complexity_level ?? "standard";
  const multiplier = getComplexityMultiplier(complexity);
  const minutesPerDoc =
    input.estimated_minutes_per_document ?? settings.minutes_per_document;
  const docCount = input.estimated_document_count;

  if (docCount == null || docCount <= 0) {
    return {
      complexity_level: complexity,
      complexity_multiplier: multiplier,
      estimated_minutes_per_document: minutesPerDoc,
      estimated_work_minutes: null,
      estimated_work_hours: null,
      estimated_work_days: null,
      suggested_due_date: null,
      due_date_status: "no_forecast",
      forecast_last_calculated: now.toISOString(),
    };
  }

  const workMinutes = Math.round(docCount * minutesPerDoc * multiplier);
  const workHours = Math.round((workMinutes / 60) * 100) / 100;
  const capacityHours = productiveDayCapacityHours(settings);
  const workDays =
    capacityHours > 0 ? Math.round((workHours / capacityHours) * 100) / 100 : 0;

  const startDate =
    input.start_date ?? format(startOfDay(now), "yyyy-MM-dd");
  const suggestedDueDate =
    workDays > 0
      ? addWorkDays(startDate, Math.ceil(workDays), settings.working_days)
      : startDate;

  const manualTarget = input.manual_due_date ?? input.due_date ?? null;
  const dueDateStatus = compareDueDateStatus(manualTarget, suggestedDueDate);

  return {
    complexity_level: complexity,
    complexity_multiplier: multiplier,
    estimated_minutes_per_document: minutesPerDoc,
    estimated_work_minutes: workMinutes,
    estimated_work_hours: workHours,
    estimated_work_days: workDays,
    suggested_due_date: suggestedDueDate,
    due_date_status: dueDateStatus,
    forecast_last_calculated: now.toISOString(),
  };
}

export function calculateProjectPlanningForecast(
  input: {
    estimated_total_documents?: number | null;
    complexity_level?: ForecastComplexityLevel | null;
    start_date?: string | null;
    manual_project_due_date?: string | null;
    due_date?: string | null;
  },
  options: CalculateTaskForecastOptions
): ProjectForecastRollup & { manual_project_due_date: string | null; due_date: string | null } {
  const forecast = calculateTaskForecast(
    {
      estimated_document_count: input.estimated_total_documents,
      complexity_level: input.complexity_level ?? "standard",
      start_date: input.start_date,
      manual_due_date: input.manual_project_due_date ?? input.due_date,
      due_date: input.due_date,
    },
    options
  );

  const docs = input.estimated_total_documents;
  if (docs == null || docs <= 0) {
    return {
      estimated_total_documents: null,
      estimated_total_hours: null,
      estimated_total_work_days: null,
      suggested_project_due_date: null,
      planning_project_due_date: null,
      active_project_due_date: null,
      project_due_date_status: "no_forecast",
      forecast_confidence: 0,
      manual_project_due_date: input.manual_project_due_date ?? input.due_date ?? null,
      due_date: input.due_date ?? null,
    };
  }

  const manualDue = input.manual_project_due_date ?? input.due_date ?? null;
  return {
    estimated_total_documents: docs,
    estimated_total_hours: forecast.estimated_work_hours,
    estimated_total_work_days: forecast.estimated_work_days,
    suggested_project_due_date: forecast.suggested_due_date,
    planning_project_due_date: forecast.suggested_due_date,
    active_project_due_date: null,
    project_due_date_status: forecast.due_date_status,
    forecast_confidence: 100,
    manual_project_due_date: manualDue,
    due_date: manualDue ?? forecast.suggested_due_date ?? null,
  };
}

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

export function aggregateProjectForecast(
  packages: WorkPackage[],
  projectManualDueDate?: string | null,
  projectDueDate?: string | null
): ProjectForecastRollup {
  const active = packages.filter((p) => ACTIVE_STATUSES.has(p.status));
  const withDocs = active.filter(
    (p) => p.estimated_document_count != null && p.estimated_document_count > 0
  );

  if (withDocs.length === 0) {
    return {
      estimated_total_documents: null,
      estimated_total_hours: null,
      estimated_total_work_days: null,
      suggested_project_due_date: null,
      planning_project_due_date: null,
      active_project_due_date: null,
      project_due_date_status: "no_forecast",
      forecast_confidence: active.length === 0 ? 100 : 0,
    };
  }

  const totalDocs = withDocs.reduce((s, p) => s + (p.estimated_document_count ?? 0), 0);
  const totalHours = withDocs.reduce((s, p) => s + (p.estimated_work_hours ?? 0), 0);
  const totalDays = withDocs.reduce((s, p) => s + (p.estimated_work_days ?? 0), 0);

  const planningDates = withDocs
    .map((p) => p.planning_due_date ?? p.suggested_due_date)
    .filter((d): d is string => !!d);
  const planningProjectDue =
    planningDates.length > 0
      ? planningDates.sort((a, b) => b.localeCompare(a))[0]
      : null;

  const activeDates = withDocs
    .filter((p) => p.forecast_mode === "active")
    .map((p) => p.active_due_date)
    .filter((d): d is string => !!d);
  const activeProjectDue =
    activeDates.length > 0
      ? activeDates.sort((a, b) => b.localeCompare(a))[0]
      : null;

  const suggestedProjectDue = activeProjectDue ?? planningProjectDue;

  const manualTarget = projectManualDueDate ?? projectDueDate ?? null;
  const confidence = active.length > 0 ? Math.round((withDocs.length / active.length) * 100) : 0;

  const worstStatus = pickWorstStatus(
    withDocs.map((p) => p.due_date_status ?? "no_forecast")
  );
  const projectStatus =
    manualTarget && suggestedProjectDue
      ? compareDueDateStatus(manualTarget, suggestedProjectDue)
      : worstStatus;

  return {
    estimated_total_documents: totalDocs,
    estimated_total_hours: Math.round(totalHours * 100) / 100,
    estimated_total_work_days: Math.round(totalDays * 100) / 100,
    suggested_project_due_date: suggestedProjectDue,
    planning_project_due_date: planningProjectDue,
    active_project_due_date: activeProjectDue,
    project_due_date_status: projectStatus,
    forecast_confidence: confidence,
  };
}

const STATUS_SEVERITY: Record<DueDateStatus, number> = {
  behind_capacity: 4,
  at_risk: 3,
  needs_review: 2,
  no_forecast: 1,
  on_track: 0,
};

function pickWorstStatus(statuses: DueDateStatus[]): DueDateStatus {
  if (statuses.length === 0) return "no_forecast";
  return statuses.reduce((worst, s) =>
    STATUS_SEVERITY[s] > STATUS_SEVERITY[worst] ? s : worst
  );
}

export function forecastVarianceDays(
  manualDate: string | null | undefined,
  suggestedDate: string | null | undefined
): number | null {
  if (!manualDate || !suggestedDate) return null;
  const manual = parseISO(manualDate);
  const suggested = parseISO(suggestedDate);
  if (!isValid(manual) || !isValid(suggested)) return null;
  return differenceInBusinessDays(manual, suggested);
}

export function formatForecastHours(hours: number | null | undefined): string {
  if (hours == null) return "—";
  return `${hours.toFixed(1)}h`;
}

export function formatForecastDays(days: number | null | undefined): string {
  if (days == null) return "—";
  return `${days.toFixed(1)} days`;
}
