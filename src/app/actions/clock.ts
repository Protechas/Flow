"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { requireUser } from "@/lib/auth/session";
import { hasPermission, isEmployeeRole } from "@/lib/auth/permissions";
import { initFlowStore, listDepartmentUsers, listTeamsStore } from "@/lib/data/flow-store";
import { isUserProductionReady } from "@/lib/setup/account";
import { requiresShiftClock } from "@/lib/users/pay-type";
import { canClockOutForDay } from "@/lib/wrap-up/compliance";
import { recordWrapUpBlockAttempt } from "@/lib/data/flow-store";
import { writeAuditLog } from "@/lib/audit/audit-log";
import {
  clockIn,
  clockOut,
  editClockEntry,
  getActiveClockEntry,
  getActiveTaskTimeEntry,
  getAllClockEntries,
  getClockEntriesForUser,
  forceStopTaskTimer,
} from "@/lib/data/production-tracking";
import { getWorkEligibility } from "@/lib/work-eligibility";

function revalidateClockPaths() {
  revalidatePath("/work");
  revalidatePath("/time-clock");
}

export async function clockInAction() {
  const user = await requireUser();
  if (isEmployeeRole(user.role)) {
    initFlowStore();
    if (
      !isUserProductionReady(user, listDepartmentUsers(), listTeamsStore())
    ) {
      throw new Error(
        "Your account setup is not complete. Please contact your manager or administrator."
      );
    }
  }
  if (isEmployeeRole(user.role) && !requiresShiftClock(user)) {
    throw new Error("Salary employees are not required to use the shift clock");
  }
  if (!isEmployeeRole(user.role) && !hasPermission(user.role, "time:log")) {
    throw new Error("FORBIDDEN");
  }
  clockIn(user.id);
  revalidateClockPaths();
}

export async function clockOutAction(outType: "lunch" | "out") {
  const user = await requireUser();
  if (isEmployeeRole(user.role) && !requiresShiftClock(user)) {
    throw new Error("Salary employees are not required to use the shift clock");
  }
  if (!isEmployeeRole(user.role) && !hasPermission(user.role, "time:log")) {
    throw new Error("FORBIDDEN");
  }

  if (outType === "out" && isEmployeeRole(user.role) && requiresShiftClock(user)) {
    const today = format(new Date(), "yyyy-MM-dd");
    if (!canClockOutForDay(user.id, today)) {
      recordWrapUpBlockAttempt(user.id, today);
      await writeAuditLog({
        action: "status_changed",
        entityType: "daily_wrap_up",
        entityId: user.id,
        summary: `${user.full_name} blocked from clock-out — wrap-up missing`,
        metadata: { wrap_date: today, event: "clock_out_blocked" },
        actorId: user.id,
        actorEmail: user.email,
      });
      throw new Error("WRAP_UP_REQUIRED");
    }
  }

  const activeTimer = getActiveTaskTimeEntry(user.id);
  if (activeTimer && outType === "out") {
    forceStopTaskTimer(user.id);
  }

  clockOut(user.id, outType);
  revalidateClockPaths();
}

export async function getClockStatusAction() {
  const user = await requireUser();
  return {
    entry: getActiveClockEntry(user.id),
    eligibility: getWorkEligibility(user),
  };
}

export async function editClockEntryAction(
  entryId: string,
  input: { clock_in_at?: string; clock_out_at?: string | null; edit_reason: string }
) {
  const user = await requireUser();
  if (!hasPermission(user.role, "work:assign")) {
    throw new Error("FORBIDDEN");
  }
  editClockEntry(entryId, user.id, input);
  await writeAuditLog({
    action: "status_changed",
    entityType: "time_clock",
    entityId: entryId,
    summary: `Edited time clock entry`,
    metadata: { reason: input.edit_reason },
  });
  revalidatePath("/time-clock");
  revalidatePath("/work");
}

export async function getMyClockEntriesAction(days = 14) {
  const user = await requireUser();
  return getClockEntriesForUser(user.id, days);
}

export async function getTeamClockEntriesAction(filters?: { userId?: string; days?: number }) {
  const user = await requireUser();
  if (!hasPermission(user.role, "work:view_all")) throw new Error("FORBIDDEN");
  return getAllClockEntries(filters);
}
