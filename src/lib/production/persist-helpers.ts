import { getFlowStore } from "@/lib/data/flow-store";
import { persistWorkPackageDb } from "@/lib/data/work-items-db";
import { persistTimeLogSync } from "@/lib/data/time-logs-db";
import { formatAppCalendarDate } from "@/lib/datetime/timezone";
import type { TaskTimeEntry } from "@/types/flow";

/**
 * Persist the task's current in-memory state to the DB. The production
 * mutators (timers, uploads, submit, QA decisions) update the work package in
 * memory only; on serverless every instance rehydrates from the DB, so
 * skipping this write silently reverts status changes on the next request.
 */
export async function persistPackageState(taskId: string): Promise<void> {
  const pkg = getFlowStore().workPackages.find((p) => p.id === taskId);
  if (pkg) await persistWorkPackageDb(pkg);
}

/**
 * Await the time-log row for a completed timer session. The in-memory bridge
 * persists it fire-and-forget, which a serverless runtime may never flush —
 * this awaited upsert (same row id) makes the write durable.
 */
export async function persistTimerSessionLog(
  entry: TaskTimeEntry | null | undefined
): Promise<void> {
  if (!entry || entry.status !== "completed" || entry.total_active_minutes <= 0) return;
  await persistTimeLogSync({
    id: entry.id,
    work_package_id: entry.task_id,
    user_id: entry.user_id,
    hours: Math.round((entry.total_active_minutes / 60) * 100) / 100,
    log_date: formatAppCalendarDate(entry.completed_at ?? entry.updated_at),
    notes: "Task timer",
    created_at: entry.created_at,
  });
}
