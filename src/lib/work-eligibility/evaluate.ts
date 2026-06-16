import {
  getActiveClockEntry,
  getShiftMinutesToday,
  getTodayClockEntries,
} from "@/lib/data/production-tracking";
import {
  initFlowStore,
  listDepartmentUsers,
  listTeamsStore,
} from "@/lib/data/flow-store";
import { isEmployeeRole } from "@/lib/auth/permissions";
import { getEmployeeClockStatus } from "@/lib/time-clock/labels";
import { isUserProductionReady } from "@/lib/setup/account";
import { requiresShiftClock } from "@/lib/users/pay-type";
import type { User } from "@/types/flow";
import { hasActiveWorkEligibilityOverride } from "./overrides";
import type { WorkEligibility } from "./types";

function loadSetupContext() {
  initFlowStore();
  return {
    departmentUsers: listDepartmentUsers(),
    teams: listTeamsStore(),
  };
}

export function getWorkEligibility(
  user: Pick<User, "id" | "role" | "pay_type" | "is_active">
): WorkEligibility {
  const fullUser = user as User;
  const { departmentUsers, teams } = loadSetupContext();

  const base: WorkEligibility = {
    eligible: true,
    status: "eligible",
    requiresClockIn: false,
    clockedIn: false,
    accountActive: user.is_active,
    onApprovedBreak: false,
    hasManagerOverride: false,
    reasons: [],
    sessionMinutes: 0,
  };

  if (!user.is_active) {
    return {
      ...base,
      eligible: false,
      status: "inactive",
      reasons: ["Account is not active"],
    };
  }

  if (
    isEmployeeRole(user.role) &&
    !isUserProductionReady(fullUser, departmentUsers, teams)
  ) {
    return {
      ...base,
      eligible: false,
      status: "needs_setup",
      reasons: ["Account setup is not complete"],
    };
  }

  if (!requiresShiftClock(user)) {
    return base;
  }

  const activeClock = getActiveClockEntry(user.id);
  const todayEntries = getTodayClockEntries(user.id);
  const clockState = getEmployeeClockStatus(activeClock, todayEntries);
  const sessionMinutes = getShiftMinutesToday(user.id);

  if (hasActiveWorkEligibilityOverride(user.id)) {
    return {
      ...base,
      eligible: true,
      status: "override_active",
      requiresClockIn: true,
      clockedIn: Boolean(activeClock),
      hasManagerOverride: true,
      sessionMinutes,
      reasons: ["Manager override active"],
    };
  }

  if (clockState === "on_lunch") {
    return {
      ...base,
      eligible: false,
      status: "on_break",
      requiresClockIn: true,
      clockedIn: false,
      onApprovedBreak: true,
      sessionMinutes,
      reasons: ["On approved lunch break"],
    };
  }

  if (!activeClock) {
    return {
      ...base,
      eligible: false,
      status: "off_clock",
      requiresClockIn: true,
      clockedIn: false,
      sessionMinutes: 0,
      reasons: ["Not clocked in"],
    };
  }

  return {
    ...base,
    eligible: true,
    status: "eligible",
    requiresClockIn: true,
    clockedIn: true,
    sessionMinutes,
    reasons: [],
  };
}
