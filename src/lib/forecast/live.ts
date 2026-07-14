import { productiveDayCapacityHours } from "@/lib/forecast/capacity";
import {
  addWorkDays,
  calculateTaskForecast,
  compareDueDateStatus,
  forecastVarianceDays,
  getComplexityMultiplier,
} from "@/lib/forecast/engine";
import type {
  DueDateStatus,
  ForecastMode,
  ForecastSettings,
  LiveForecastStatus,
  WorkPackage,
  WorkStatus,
} from "@/types/flow";
import { format, parseISO, startOfDay } from "date-fns";
import { appTodayDate } from "@/lib/datetime/timezone";

const PRE_START: WorkStatus[] = ["not_started", "assigned", "waiting"];

function anchorDate(iso: string | null | undefined, fallback: string): string {
  if (!iso) return fallback;
  try {
    return format(startOfDay(parseISO(iso)), "yyyy-MM-dd");
  } catch {
    return fallback;
  }
}

function deriveLiveStatus(
  pkg: WorkPackage,
  mode: ForecastMode,
  activeDue: string | null,
  planningDue: string | null
): LiveForecastStatus {
  if (pkg.status === "done") return "completed";
  const docs = pkg.estimated_document_count ?? 0;
  if (docs <= 0) {
    return pkg.assigned_to ? "assigned" : "forecast_pending";
  }
  if (mode === "planning") return "planning_forecast";
  if (!activeDue) return "active_forecast";

  const target = pkg.manual_due_date ?? planningDue;
  const status = compareDueDateStatus(target, activeDue);
  if (status === "behind_capacity") return "behind_forecast";
  if (status === "at_risk") return "at_risk";
  if (status === "on_track") return "on_track";
  return "active_forecast";
}

export interface LiveForecastOptions {
  settings: ForecastSettings;
  taskActiveMinutes?: number;
  now?: Date;
  /** Override planning anchor — used for queue-chained waiting tasks. */
  planningStartDate?: string;
  /** When set, only this task id runs live/active forecast; others stay planning. */
  activeTaskId?: string | null;
}

export function applyTaskLiveForecast(
  pkg: WorkPackage,
  options: LiveForecastOptions
): Partial<WorkPackage> {
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const settings = options.settings;
  const isLiveActive =
    options.activeTaskId != null
      ? options.activeTaskId === pkg.id
      : pkg.forecast_mode === "active" && !!pkg.started_at;
  const mode: ForecastMode = isLiveActive ? "active" : "planning";

  if (pkg.status === "done") {
    return {
      live_forecast_status: "completed",
      forecast_last_updated: nowIso,
      completed_at: pkg.completed_at ?? nowIso,
    };
  }

  const docTotal = pkg.estimated_document_count ?? 0;
  if (docTotal <= 0) {
    return {
      forecast_mode: "planning",
      planning_due_date: null,
      active_due_date: null,
      suggested_due_date: null,
      estimated_remaining_documents: null,
      current_documents_completed: pkg.current_documents_completed ?? 0,
      current_production_rate: null,
      forecast_variance_days: null,
      live_forecast_status: deriveLiveStatus(pkg, "planning", null, null),
      due_date_status: "no_forecast" as DueDateStatus,
      forecast_last_updated: nowIso,
      forecast_last_calculated: nowIso,
      due_date: pkg.manual_due_date ?? pkg.due_date ?? null,
    };
  }

  // A task that hasn't started can't start earlier than today — planning from
  // a stale assignment/creation date freezes forecasts in the past. Queue
  // chaining passes its own cursor; everything else anchors to at least today.
  const today = appTodayDate(now);
  const historicalAnchor = anchorDate(pkg.assigned_at ?? pkg.created_at, today);
  const assignmentAnchor =
    options.planningStartDate ?? (historicalAnchor > today ? historicalAnchor : today);

  const planning = calculateTaskForecast(
    {
      estimated_document_count: docTotal,
      complexity_level: pkg.complexity_level,
      estimated_minutes_per_document: pkg.estimated_minutes_per_document,
      start_date: assignmentAnchor,
      manual_due_date: pkg.manual_due_date,
      due_date: pkg.due_date,
    },
    { settings, now }
  );

  const planningDue = planning.suggested_due_date;

  if (mode === "planning" || !pkg.started_at || !isLiveActive) {
    const liveStatus = deriveLiveStatus(pkg, "planning", null, planningDue);
    const dueDate = pkg.manual_due_date ?? planningDue ?? pkg.due_date;
    return {
      forecast_mode: "planning",
      planning_due_date: planningDue,
      active_due_date: pkg.active_due_date ?? null,
      suggested_due_date: planningDue,
      estimated_remaining_documents: docTotal,
      // 1 uploaded file = 1 completed document; manual progress can only add
      // to what uploads already prove (a stale manual 0 must not zero it out).
      current_documents_completed: Math.max(
        pkg.current_documents_completed ?? 0,
        pkg.file_count ?? 0
      ),
      complexity_level: planning.complexity_level,
      complexity_multiplier: planning.complexity_multiplier,
      estimated_minutes_per_document: planning.estimated_minutes_per_document,
      estimated_work_minutes: planning.estimated_work_minutes,
      estimated_work_hours: planning.estimated_work_hours,
      estimated_work_days: planning.estimated_work_days,
      estimated_hours: planning.estimated_work_hours ?? pkg.estimated_hours,
      due_date_status: planning.due_date_status,
      live_forecast_status: liveStatus,
      forecast_variance_days: null,
      forecast_last_calculated: planning.forecast_last_calculated,
      forecast_last_updated: nowIso,
      due_date: dueDate,
    };
  }

  const completed = Math.max(
    pkg.current_documents_completed ?? 0,
    pkg.file_count ?? 0
  );
  const remaining = Math.max(0, docTotal - completed);
  const defaultRate =
    settings.minutes_per_document * getComplexityMultiplier(pkg.complexity_level);
  const taskMinutes = options.taskActiveMinutes ?? 0;

  let productionRate = pkg.current_production_rate ?? defaultRate;
  if (completed > 0 && taskMinutes > 0) {
    productionRate = Math.round((taskMinutes / completed) * 100) / 100;
  }

  const remainingMinutes = Math.round(remaining * productionRate);
  const remainingHours =
    Math.round((remainingMinutes / 60) * 100) / 100;
  const capacityHours = productiveDayCapacityHours(settings);
  const remainingDays =
    capacityHours > 0
      ? Math.round((remainingHours / capacityHours) * 100) / 100
      : 0;

  const startAnchor = anchorDate(
    pkg.forecast_start_date ?? pkg.started_at,
    format(startOfDay(now), "yyyy-MM-dd")
  );
  const activeDue =
    remainingDays > 0
      ? addWorkDays(startAnchor, Math.ceil(remainingDays), settings.working_days)
      : startAnchor;

  const variance = forecastVarianceDays(planningDue, activeDue);
  const dueDateStatus = compareDueDateStatus(
    pkg.manual_due_date ?? planningDue,
    activeDue
  );
  const liveStatus = deriveLiveStatus(pkg, "active", activeDue, planningDue);

  return {
    forecast_mode: "active",
    planning_due_date: planningDue,
    active_due_date: activeDue,
    suggested_due_date: activeDue,
    estimated_remaining_documents: remaining,
    current_documents_completed: completed,
    current_production_rate: productionRate,
    estimated_work_minutes: remainingMinutes,
    estimated_work_hours: remainingHours,
    estimated_work_days: remainingDays,
    complexity_level: planning.complexity_level,
    complexity_multiplier: planning.complexity_multiplier,
    estimated_minutes_per_document: planning.estimated_minutes_per_document,
    due_date_status: dueDateStatus,
    live_forecast_status: liveStatus,
    forecast_variance_days: variance,
    forecast_last_calculated: nowIso,
    forecast_last_updated: nowIso,
    due_date: activeDue,
  };
}

export function isPreStartStatus(status: WorkStatus): boolean {
  return PRE_START.includes(status);
}

export function primaryDueDate(pkg: WorkPackage): string | null {
  if (pkg.status === "done") return pkg.completed_date ?? pkg.due_date ?? null;
  if (pkg.forecast_mode === "active" && pkg.active_due_date) {
    return pkg.active_due_date;
  }
  return pkg.planning_due_date ?? pkg.suggested_due_date ?? pkg.due_date ?? null;
}
