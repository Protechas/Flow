import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import {
  getActiveClockEntry,
  getClockEntriesForUser,
  getProductionStore,
  initProductionTracking,
} from "@/lib/data/production-tracking";
import { requiresShiftClock } from "@/lib/users/pay-type";
import { isAppCalendarDay } from "@/lib/datetime/timezone";
import type { User, WrapUpComplianceStatus } from "@/types/flow";

function wrapUpStatusFor(userId: string, wrapDate: string): WrapUpComplianceStatus {
  const store = getFlowStore();
  if (store.dailyWrapUpOverrides.some((o) => o.user_id === userId && o.wrap_date === wrapDate)) {
    return "overridden";
  }
  if (store.dailyWrapUps.some((w) => w.user_id === userId && w.wrap_date === wrapDate)) {
    return "submitted";
  }
  return "missing";
}

/**
 * User had real shift or work activity on a date — basis for daily report obligations.
 */
export function hadShiftActivityOnDate(userId: string, wrapDate: string): boolean {
  initProductionTracking();
  initFlowStore();
  const store = getFlowStore();

  if (store.dailyWrapUps.some((w) => w.user_id === userId && w.wrap_date === wrapDate)) {
    return true;
  }
  if (store.dailyWrapUpOverrides.some((o) => o.user_id === userId && o.wrap_date === wrapDate)) {
    return true;
  }

  const clockEntries = getClockEntriesForUser(userId, 30).filter((e) =>
    isAppCalendarDay(e.clock_in_at, wrapDate)
  );
  if (clockEntries.length > 0) return true;

  const active = getActiveClockEntry(userId);
  if (active && isAppCalendarDay(active.clock_in_at, wrapDate)) return true;

  const { taskTimeEntries } = getProductionStore();
  if (taskTimeEntries.some((e) => e.user_id === userId && isAppCalendarDay(e.started_at, wrapDate))) {
    return true;
  }

  if (
    store.workPackages.some(
      (p) =>
        p.assigned_to === userId &&
        (p.completed_date === wrapDate ||
          (p.status !== "done" && p.updated_at?.startsWith(wrapDate)))
    )
  ) {
    return true;
  }

  return false;
}

/** Hourly employee who clocked in / worked and owes a daily report for this date. */
export function isWrapUpRequiredForDate(
  user: Pick<User, "id" | "is_active" | "pay_type" | "role">,
  wrapDate: string
): boolean {
  if (!user.is_active || !requiresShiftClock(user)) return false;
  return hadShiftActivityOnDate(user.id, wrapDate);
}

/** Missing daily report for manager reporting — excludes inactive / never-worked employees. */
export function isWrapUpMissingForReporting(user: User, wrapDate: string): boolean {
  if (!isWrapUpRequiredForDate(user, wrapDate)) return false;
  return wrapUpStatusFor(user.id, wrapDate) === "missing";
}

export function countMissingWrapUpsForUsers(users: User[], wrapDate: string): number {
  return users.filter((u) => isWrapUpMissingForReporting(u, wrapDate)).length;
}
