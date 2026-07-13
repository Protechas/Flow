import type { EmployeeClockStatus } from "@/lib/constants";
import {
  getActiveClockEntry,
  getActiveSideSession,
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
import { appTodayDate, formatAppTime } from "@/lib/datetime/timezone";

const STATUS_ORDER: Record<string, number> = {
  on_shift: 0,
  on_lunch: 1,
  off_shift: 2,
  exempt: 3,
};

/** A running meeting/training overrides the label so leads see where people are. */
function applySideSession(
  result: TeamMemberAvailability,
  userId: string
): TeamMemberAvailability {
  if (result.status !== "on_shift" && result.status !== "exempt") return result;
  const session = getActiveSideSession(userId);
  if (!session) return result;
  return {
    ...result,
    statusLabel: session.category === "meeting" ? "In a meeting" : "In training",
    since: formatAppTime(session.started_at),
  };
}

export function getTeamAvailability(
  users: User[],
  opts?: {
    /**
     * Default (true) keeps the production roster only. Pass false for groups
     * like team leads whose members aren't production employees.
     */
    rosterOnly?: boolean;
  }
): TeamMemberAvailability[] {
  initFlowStore();
  const store = getFlowStore();
  const today = appTodayDate();
  const included =
    opts?.rosterOnly === false ? users.filter((u) => u.is_active) : users.filter(isTimeClockMember);

  return included
    .map((user) => {
      const shiftRequired = requiresShiftClock(user);
      const activeEntry = getActiveClockEntry(user.id);
      const todayEntries = getTodayClockEntries(user.id);
      const activeTask = getActiveTaskTimeEntry(user.id);
      const activeTaskPkg = activeTask
        ? store.workPackages.find((p) => p.id === activeTask.task_id)
        : null;

      if (!shiftRequired) {
        // Voluntary clock use (leads signalling in/out) beats the exempt fallback.
        const hasClockSignal = activeEntry != null || todayEntries.length > 0;
        if (hasClockSignal) {
          const status = getEmployeeClockStatus(activeEntry, todayEntries);
          const lastEntry = [...todayEntries]
            .filter((e) => e.clock_out_at)
            .sort((a, b) => b.clock_out_at!.localeCompare(a.clock_out_at!))[0];
          return applySideSession(
            {
              userId: user.id,
              name: user.full_name,
              payType: user.pay_type ?? "salary",
              requiresShiftClock: false,
              status,
              statusLabel: status === "off_shift" ? "Out" : clockStatusLabel(activeEntry, todayEntries),
              since: activeEntry
                ? formatAppTime(activeEntry.clock_in_at)
                : lastEntry?.clock_out_at
                  ? formatAppTime(lastEntry.clock_out_at)
                  : null,
              shiftMinutesToday: getShiftMinutesToday(user.id),
              taskMinutesToday: getTaskMinutesToday(user.id),
              lastPunchAt: lastEntry?.clock_out_at ?? activeEntry?.clock_in_at ?? null,
              activeTaskTitle: activeTaskPkg?.title ?? null,
            },
            user.id
          );
        }

        const onTask = activeTask?.status === "active";
        return applySideSession(
          {
            userId: user.id,
            name: user.full_name,
            payType: user.pay_type ?? "salary",
            requiresShiftClock: false,
            status: onTask ? ("on_shift" as const) : ("exempt" as const),
            statusLabel: onTask ? "On task" : "Available",
            since: onTask ? formatAppTime(activeTask!.started_at) : null,
            shiftMinutesToday: 0,
            taskMinutesToday: getTaskMinutesToday(user.id),
            lastPunchAt: null,
            activeTaskTitle: activeTaskPkg?.title ?? null,
          },
          user.id
        );
      }

      const status = getEmployeeClockStatus(activeEntry, todayEntries);
      const lastEntry = [...todayEntries]
        .filter((e) => e.clock_out_at)
        .sort((a, b) => b.clock_out_at!.localeCompare(a.clock_out_at!))[0];

      return applySideSession(
        {
          userId: user.id,
          name: user.full_name,
          payType: user.pay_type ?? "hourly",
          requiresShiftClock: true,
          wrapUpStatus: getWrapUpComplianceStatus(user.id, today),
          status,
          statusLabel: clockStatusLabel(activeEntry, todayEntries),
          since: activeEntry ? formatAppTime(activeEntry.clock_in_at) : null,
          shiftMinutesToday: getShiftMinutesToday(user.id),
          taskMinutesToday: getTaskMinutesToday(user.id),
          lastPunchAt: lastEntry?.clock_out_at ?? activeEntry?.clock_in_at ?? null,
          activeTaskTitle: activeTaskPkg?.title ?? null,
        },
        user.id
      );
    })
    .sort((a, b) => {
      const order = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      if (order !== 0) return order;
      return a.name.localeCompare(b.name);
    });
}

export type { TeamMemberAvailability } from "@/lib/time-clock/availability-types";
