"use server";

import { appTodayDate } from "@/lib/datetime/timezone";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { hasPermission, isEmployeeRole } from "@/lib/auth/permissions";
import { canViewerSeeUser } from "@/lib/auth/team-scope";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { getFlowStore, listDepartmentUsers, listTeamsStore } from "@/lib/data/flow-store";
import { isUserProductionReady } from "@/lib/setup/account";
import { requiresShiftClock } from "@/lib/users/pay-type";
import { canClockOutForDay } from "@/lib/wrap-up/compliance";
import { recordWrapUpBlockAttempt } from "@/lib/data/flow-store";
import { writeAuditLog } from "@/lib/audit/audit-log";
import {
  clockIn,
  clockOut,
  createClockEntry,
  deleteClockEntry,
  editClockEntry,
  getActiveClockEntry,
  getActiveTaskTimeEntry,
  getAllClockEntries,
  getClockEntriesForUser,
  forceStopTaskTimer,
} from "@/lib/data/production-tracking";
import {
  deleteTimeClockEntrySync,
  persistTaskTimeEntrySync,
  persistTimeClockEntrySync,
} from "@/lib/data/production-tracking-db";
import { ensureServerWriteContext } from "@/lib/server/write-context";
import {
  persistPackageState,
  persistTimerSessionLog,
} from "@/lib/production/persist-helpers";
import { logActionError, logActionInfo } from "@/lib/logging/action-log";
import { getWorkEligibility } from "@/lib/work-eligibility";

function revalidateClockPaths() {
  revalidatePath("/work");
  revalidatePath("/work", "layout");
  revalidatePath("/time-clock");
  revalidatePath("/people");
}

async function assertCanManageClockForUser(targetUserId: string, actor: Awaited<ReturnType<typeof requireUser>>) {
  if (!hasPermission(actor.role, "work:assign")) {
    throw new Error("FORBIDDEN");
  }
  if (targetUserId === actor.id) return;
  await ensureAppDataLoaded();
  const store = getFlowStore();
  if (!canViewerSeeUser(actor, targetUserId, store.users, store.teams)) {
    throw new Error("FORBIDDEN");
  }
}

export async function clockInAction() {
  const user = await requireUser();
  await ensureServerWriteContext();

  if (isEmployeeRole(user.role)) {
    if (!isUserProductionReady(user, listDepartmentUsers(), listTeamsStore())) {
      throw new Error(
        "Your account setup is not complete. Ask your manager to assign your department, team, and supervisor in Settings → Users."
      );
    }
  }
  if (isEmployeeRole(user.role) && !requiresShiftClock(user)) {
    throw new Error("Salary employees are not required to use the shift clock");
  }
  if (!isEmployeeRole(user.role) && !hasPermission(user.role, "time:log")) {
    throw new Error("FORBIDDEN");
  }

  const entry = clockIn(user.id);
  try {
    await persistTimeClockEntrySync(entry);
  } catch (e) {
    logActionError("Clock-in persist failed", { action: "clock_in", userId: user.id }, e);
    throw new Error("Clock-in could not be saved. Please refresh and try again.");
  }
  logActionInfo("Clock-in saved", { action: "clock_in", userId: user.id, metadata: { entryId: entry.id } });
  revalidateClockPaths();
}

export async function clockOutAction(outType: "lunch" | "out") {
  const user = await requireUser();
  await ensureServerWriteContext();

  if (isEmployeeRole(user.role) && !requiresShiftClock(user)) {
    throw new Error("Salary employees are not required to use the shift clock");
  }
  if (!isEmployeeRole(user.role) && !hasPermission(user.role, "time:log")) {
    throw new Error("FORBIDDEN");
  }

  if (outType === "out" && isEmployeeRole(user.role) && requiresShiftClock(user)) {
    const today = appTodayDate();
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
    const stopped = forceStopTaskTimer(user.id);
    if (stopped) {
      await persistTaskTimeEntrySync(stopped);
      await persistTimerSessionLog(stopped);
      await persistPackageState(stopped.task_id);
    }
  }

  const entry = clockOut(user.id, outType);
  try {
    await persistTimeClockEntrySync(entry);
  } catch (e) {
    logActionError("Clock-out persist failed", { action: "clock_out", userId: user.id }, e);
    throw new Error("Clock-out could not be saved. Please refresh and try again.");
  }
  logActionInfo("Clock-out saved", {
    action: "clock_out",
    userId: user.id,
    metadata: { entryId: entry.id, outType },
  });
  revalidateClockPaths();
}

export async function getClockStatusAction() {
  const user = await requireUser();
  await ensureServerWriteContext();
  return {
    entry: getActiveClockEntry(user.id),
    eligibility: getWorkEligibility(user),
  };
}

export async function editClockEntryAction(
  entryId: string,
  input: {
    clock_in_at?: string;
    clock_out_at?: string | null;
    clock_out_type?: "lunch" | "out" | null;
    edit_reason: string;
  }
) {
  const user = await requireUser();
  await ensureServerWriteContext();
  const { getProductionStore } = await import("@/lib/data/production-tracking");
  const entry = getProductionStore().timeClockEntries.find((e) => e.id === entryId);
  if (!entry) throw new Error("Clock entry not found");

  await assertCanManageClockForUser(entry.user_id, user);

  if (!input.edit_reason.trim()) {
    throw new Error("A reason is required when correcting clock punches");
  }

  editClockEntry(entryId, user.id, {
    ...input,
    edit_reason: input.edit_reason.trim(),
  });
  const updated = getProductionStore().timeClockEntries.find((e) => e.id === entryId);
  if (updated) await persistTimeClockEntrySync(updated);
  await writeAuditLog({
    action: "status_changed",
    entityType: "time_clock",
    entityId: entryId,
    summary: `Corrected time clock punch for employee ${entry.user_id}`,
    metadata: {
      reason: input.edit_reason.trim(),
      clock_in_at: input.clock_in_at,
      clock_out_at: input.clock_out_at,
      clock_out_type: input.clock_out_type,
    },
    actorId: user.id,
    actorEmail: user.email,
  });
  revalidateClockPaths();
}

export async function createClockEntryAction(input: {
  userId: string;
  clock_in_at: string;
  clock_out_at?: string | null;
  clock_out_type?: "lunch" | "out" | null;
  edit_reason: string;
}) {
  const user = await requireUser();
  await ensureServerWriteContext();
  await assertCanManageClockForUser(input.userId, user);

  if (!input.edit_reason.trim()) {
    throw new Error("A reason is required when adding clock punches");
  }

  const entry = createClockEntry({
    userId: input.userId,
    clock_in_at: input.clock_in_at,
    clock_out_at: input.clock_out_at,
    clock_out_type: input.clock_out_type,
    editorId: user.id,
    edit_reason: input.edit_reason.trim(),
  });
  await persistTimeClockEntrySync(entry);
  await writeAuditLog({
    action: "status_changed",
    entityType: "time_clock",
    entityId: entry.id,
    summary: `Added manual clock punch for employee ${input.userId}`,
    metadata: {
      reason: input.edit_reason.trim(),
      clock_in_at: input.clock_in_at,
      clock_out_at: input.clock_out_at ?? null,
    },
    actorId: user.id,
    actorEmail: user.email,
  });
  revalidateClockPaths();
  return { ok: true as const, entryId: entry.id };
}

export async function deleteClockEntryAction(entryId: string, reason: string) {
  const user = await requireUser();
  await ensureServerWriteContext();
  const { getProductionStore } = await import("@/lib/data/production-tracking");
  const entry = getProductionStore().timeClockEntries.find((e) => e.id === entryId);
  if (!entry) throw new Error("Clock entry not found");

  await assertCanManageClockForUser(entry.user_id, user);
  if (!reason.trim()) throw new Error("A reason is required when removing clock punches");

  deleteClockEntry(entryId);
  await deleteTimeClockEntrySync(entryId);
  await writeAuditLog({
    action: "status_changed",
    entityType: "time_clock",
    entityId: entryId,
    summary: `Removed clock punch for employee ${entry.user_id}`,
    metadata: { reason: reason.trim(), clock_in_at: entry.clock_in_at },
    actorId: user.id,
    actorEmail: user.email,
  });
  revalidateClockPaths();
  return { ok: true as const };
}

export async function getMyClockEntriesAction(days = 14) {
  const user = await requireUser();
  await ensureServerWriteContext();
  return getClockEntriesForUser(user.id, days);
}

export async function getTeamClockEntriesAction(filters?: { userId?: string; days?: number }) {
  const user = await requireUser();
  if (!hasPermission(user.role, "work:view_all")) throw new Error("FORBIDDEN");
  await ensureServerWriteContext();
  return getAllClockEntries(filters);
}
