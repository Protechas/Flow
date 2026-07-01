import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import {
  getActiveClockEntry,
  getTodayClockEntries,
} from "@/lib/data/production-tracking";
import { requiresShiftClock } from "@/lib/users/pay-type";
import { getUserPrimaryDepartmentId, getDepartmentName } from "@/lib/departments/resolve";
import {
  hadShiftActivityOnDate,
  isWrapUpRequiredForDate,
} from "@/lib/wrap-up/eligibility";
import type {
  DailyWrapUpComplianceRow,
  User,
  WrapUpComplianceStatus,
} from "@/types/flow";
import { appTodayDate } from "@/lib/datetime/timezone";

export function getWrapUpComplianceStatus(
  userId: string,
  wrapDate: string
): WrapUpComplianceStatus {
  initFlowStore();
  const store = getFlowStore();
  if (store.dailyWrapUpOverrides.some((o) => o.user_id === userId && o.wrap_date === wrapDate)) {
    return "overridden";
  }
  if (store.dailyWrapUps.some((w) => w.user_id === userId && w.wrap_date === wrapDate)) {
    return "submitted";
  }
  return "missing";
}

export function canClockOutForDay(userId: string, wrapDate: string): boolean {
  const status = getWrapUpComplianceStatus(userId, wrapDate);
  return status === "submitted" || status === "overridden";
}

export function requiresWrapUpForClockOut(user: Pick<User, "role" | "pay_type">): boolean {
  return requiresShiftClock(user);
}

/** Wrap-up completion % for a set of users on a given date (hourly employees only). */
export function getWrapUpCompletionPctForUsers(
  userIds: string[],
  wrapDate: string = appTodayDate()
): number {
  initFlowStore();
  const store = getFlowStore();
  const requiredIds = userIds.filter((id) => {
    const user = store.users.find((u) => u.id === id);
    return user && isWrapUpRequiredForDate(user, wrapDate);
  });
  if (requiredIds.length === 0) return 100;

  const submitted = requiredIds.filter((id) => {
    const status = getWrapUpComplianceStatus(id, wrapDate);
    return status === "submitted" || status === "overridden";
  }).length;

  return Math.round((submitted / requiredIds.length) * 100);
}

export function buildDailyWrapUpComplianceReport(
  users: User[],
  wrapDate: string = appTodayDate()
): DailyWrapUpComplianceRow[] {
  initFlowStore();
  const store = getFlowStore();

  return users
    .filter((u) => u.is_active && requiresShiftClock(u))
    .filter((u) => {
      const status = getWrapUpComplianceStatus(u.id, wrapDate);
      if (status === "submitted" || status === "overridden") return true;
      return hadShiftActivityOnDate(u.id, wrapDate);
    })
    .map((user) => {
      const wrapUpStatus = getWrapUpComplianceStatus(user.id, wrapDate);
      const override = store.dailyWrapUpOverrides.find(
        (o) => o.user_id === user.id && o.wrap_date === wrapDate
      );
      const overriddenBy = override
        ? store.users.find((u) => u.id === override.overridden_by)
        : null;
      const blockAttempt = store.wrapUpBlockAttempts.find(
        (b) => b.user_id === user.id && b.wrap_date === wrapDate
      );
      const todayEntries = getTodayClockEntries(user.id);
      const endOfDayOut = todayEntries
        .filter((e) => e.clock_out_type === "out" && e.clock_out_at)
        .sort((a, b) => b.clock_out_at!.localeCompare(a.clock_out_at!))[0];

      return {
        userId: user.id,
        userName: user.full_name,
        departmentId: getUserPrimaryDepartmentId(user.id),
        departmentName: getDepartmentName(getUserPrimaryDepartmentId(user.id)),
        wrapDate,
        wrapUpStatus,
        clockedIn: getActiveClockEntry(user.id) != null,
        clockedOutToday: !!endOfDayOut,
        clockOutAt: endOfDayOut?.clock_out_at ?? null,
        overrideReason: override?.reason ?? null,
        overriddenByName: overriddenBy?.full_name ?? null,
        blockedAttemptAt: blockAttempt?.blocked_at ?? null,
      };
    })
    .sort((a, b) => a.userName.localeCompare(b.userName));
}
