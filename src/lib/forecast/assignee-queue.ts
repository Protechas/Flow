import { compareTaskPriority } from "@/lib/employee/task-utils";
import { appTodayDate } from "@/lib/datetime/timezone";
import { addWorkDays, calculateTaskForecast } from "@/lib/forecast/engine";
import { applyTaskLiveForecast } from "@/lib/forecast/live";
import type { ForecastSettings, WorkPackage, WorkStatus } from "@/types/flow";

const QUEUE_STATUSES: WorkStatus[] = [
  "correction_needed",
  "assigned",
  "not_started",
  "working_on_it",
  "waiting",
  "stuck",
];

export function isQueueForecastTask(pkg: WorkPackage): boolean {
  return pkg.status !== "done" && !["ready_for_qa", "in_qa"].includes(pkg.status);
}

/** Open work for an assignee in execution order (active task pinned first when known). */
export function listAssigneeWorkQueue(
  tasks: WorkPackage[],
  activeTaskId?: string | null
): WorkPackage[] {
  const candidates = tasks.filter(isQueueForecastTask);
  const ordered = [...candidates].sort((a, b) => {
    const sa = QUEUE_STATUSES.indexOf(a.status);
    const sb = QUEUE_STATUSES.indexOf(b.status);
    const statusRank = (sa < 0 ? 99 : sa) - (sb < 0 ? 99 : sb);
    if (statusRank !== 0) return statusRank;
    return compareTaskPriority(a, b);
  });

  if (!activeTaskId) return ordered;
  const idx = ordered.findIndex((t) => t.id === activeTaskId);
  if (idx <= 0) return ordered;
  const [active] = ordered.splice(idx, 1);
  return [active, ...ordered];
}

function slotEndDate(fields: Partial<WorkPackage>): string | null {
  return (
    fields.active_due_date ??
    fields.planning_due_date ??
    fields.suggested_due_date ??
    null
  );
}

/** Full estimated work days for a task (planning baseline). */
export function estimatePlanningWorkDays(
  pkg: WorkPackage,
  settings: ForecastSettings,
  startDate: string
): number {
  const forecast = calculateTaskForecast(
    {
      estimated_document_count: pkg.estimated_document_count,
      complexity_level: pkg.complexity_level,
      estimated_minutes_per_document: pkg.estimated_minutes_per_document,
      start_date: startDate,
      manual_due_date: pkg.manual_due_date,
      due_date: pkg.due_date,
    },
    { settings }
  );
  return forecast.estimated_work_days ?? 0;
}

export interface AssigneeQueueForecastInput {
  assigneeId: string;
  packages: WorkPackage[];
  settings: ForecastSettings;
  activeTaskId?: string | null;
  taskMinutesById?: Record<string, number>;
  now?: Date;
}

/** Compute chained forecast fields for each queued task on an assignee. */
export function computeAssigneeQueueForecasts(
  input: AssigneeQueueForecastInput
): Map<string, Partial<WorkPackage>> {
  const { settings, assigneeId, now = new Date() } = input;
  const mine = input.packages.filter((p) => p.assigned_to === assigneeId);
  const queue = listAssigneeWorkQueue(mine, input.activeTaskId ?? null);
  const results = new Map<string, Partial<WorkPackage>>();

  let cursor = appTodayDate(now);

  for (const pkg of queue) {
    const isLiveActive = input.activeTaskId != null && pkg.id === input.activeTaskId;
    const taskMinutes = input.taskMinutesById?.[pkg.id];

    const fields = applyTaskLiveForecast(pkg, {
      settings,
      now,
      activeTaskId: input.activeTaskId ?? null,
      planningStartDate: isLiveActive ? undefined : cursor,
      taskActiveMinutes: isLiveActive ? taskMinutes : undefined,
    });

    results.set(pkg.id, fields);

    const end = slotEndDate(fields);
    if (end) {
      cursor = addWorkDays(end, 1, settings.working_days);
    } else if (fields.estimated_work_days != null && fields.estimated_work_days > 0) {
      cursor = addWorkDays(
        cursor,
        Math.ceil(fields.estimated_work_days) + 1,
        settings.working_days
      );
    }
  }

  return results;
}
