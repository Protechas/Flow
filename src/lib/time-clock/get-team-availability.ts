import type { EmployeeClockStatus } from "@/lib/constants";
import {
  getActiveClockEntry,
  getActiveTaskTimeEntry,
  getShiftMinutesToday,
  getTaskMinutesToday,
  getTodayClockEntries,
} from "@/lib/data/production-tracking";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import {
  clockStatusLabel,
  getEmployeeClockStatus,
} from "@/lib/time-clock/labels";
import type { TeamMemberAvailability } from "@/lib/time-clock/availability-types";
import { isTimeClockMember } from "@/lib/time-clock/members";
import { requiresShiftClock } from "@/lib/users/pay-type";
import { getWrapUpComplianceStatus } from "@/lib/wrap-up/compliance";
import type { User } from "@/types/flow";
import { format } from "date-fns";

const STATUS_ORDER: Record<string, number> = {
  on_shift: 0,
  on_lunch: 1,
  off_shift: 2,
  exempt: 3,
};

export function getTeamAvailability(users: User[]): TeamMemberAvailability[] {
  initFlowStore();
  const store = getFlowStore();
  const today = format(new Date(), "yyyy-MM-dd");

  return users
    .filter(isTimeClockMember)
    .map((user) => {
      const shiftRequired = requiresShiftClock(user);
      const activeEntry = getActiveClockEntry(user.id);
      const todayEntries = getTodayClockEntries(user.id);
      const activeTask = getActiveTaskTimeEntry(user.id);
      const activeTaskPkg = activeTask
        ? store.workPackages.find((p) => p.id === activeTask.task_id)
        : null;

      if (!shiftRequired) {
        const onTask = activeTask?.status === "active";
        return {
          userId: user.id,
          name: user.full_name,
          payType: user.pay_type ?? "salary",
          requiresShiftClock: false,
          status: onTask ? ("on_shift" as const) : ("exempt" as const),
          statusLabel: onTask ? "On task" : "Available",
          since: onTask
            ? new Date(activeTask!.started_at).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })
            : null,
          shiftMinutesToday: 0,
          taskMinutesToday: getTaskMinutesToday(user.id),
          lastPunchAt: null,
          activeTaskTitle: activeTaskPkg?.title ?? null,
        };
      }

      const status = getEmployeeClockStatus(activeEntry, todayEntries);
      const lastEntry = [...todayEntries]
        .filter((e) => e.clock_out_at)
        .sort((a, b) => b.clock_out_at!.localeCompare(a.clock_out_at!))[0];

      return {
        userId: user.id,
        name: user.full_name,
        payType: user.pay_type ?? "hourly",
        requiresShiftClock: true,
        wrapUpStatus: getWrapUpComplianceStatus(user.id, today),
        status,
        statusLabel: clockStatusLabel(activeEntry, todayEntries),
        since: activeEntry
          ? new Date(activeEntry.clock_in_at).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })
          : null,
        shiftMinutesToday: getShiftMinutesToday(user.id),
        taskMinutesToday: getTaskMinutesToday(user.id),
        lastPunchAt: lastEntry?.clock_out_at ?? activeEntry?.clock_in_at ?? null,
        activeTaskTitle: activeTaskPkg?.title ?? null,
      };
    })
    .sort((a, b) => {
      const order = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      if (order !== 0) return order;
      return a.name.localeCompare(b.name);
    });
}

export type { TeamMemberAvailability } from "@/lib/time-clock/availability-types";
