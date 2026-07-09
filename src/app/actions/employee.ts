"use server";

import { appTodayDate } from "@/lib/datetime/timezone";
import { revalidatePath } from "next/cache";
import {
  assertCanEditWorkPackage,
  requireUser,
} from "@/lib/auth/session";
import { isEmployeeRole } from "@/lib/auth/permissions";
import { assertWorkEligible } from "@/lib/work-eligibility";
import { recordBlockedWorkAttempt } from "@/lib/work-eligibility/audit";
import { pickNextTask, getEmployeeTasks } from "@/lib/employee/tasks";
import {
  getActiveTaskTimeEntry,
  startTaskTimer,
  stopTaskTimer,
} from "@/lib/data/production-tracking";
import { createDailyWrapUp, updateWorkPackage, initFlowStore } from "@/lib/data/flow-store";
import { persistDailyWrapUpSync } from "@/lib/data/wrap-ups-db";
import { demoteOtherInProgressTasks } from "@/lib/employee/single-focus";
import { persistTaskTimeEntrySync } from "@/lib/data/production-tracking-db";
import { persistWorkPackageDb } from "@/lib/data/work-items-db";
import { ensureServerWriteContext } from "@/lib/server/write-context";
import { hydrateHelpFlagSettings } from "@/lib/help-flags/hydrate";
import { raiseHelpFlag } from "@/lib/help-flags/engine";
import type { User, WorkPackage } from "@/types/flow";

function revalidateWork() {
  revalidatePath("/work");
  revalidatePath("/work", "layout");
  revalidatePath("/operations");
  revalidatePath("/qa-center");
}

async function requireEmployee() {
  const user = await requireUser();
  if (!isEmployeeRole(user.role)) throw new Error("FORBIDDEN");
  return user;
}

async function requireOwnTask(taskId: string) {
  const user = await requireEmployee();
  await assertCanEditWorkPackage(user, taskId);
  return user;
}

async function startTimerForTask(user: User, taskId: string): Promise<void> {
  await ensureServerWriteContext();
  try {
    const entry = startTaskTimer(user.id, taskId);
    await persistTaskTimeEntrySync(entry);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("ACTIVE_TASK:")) {
      const activeId = msg.split(":")[1];
      if (activeId !== taskId) {
        await recordBlockedWorkAttempt(
          user,
          "start_task",
          "You already have an active task. Pause or complete the current task before starting another.",
          activeId
        );
        throw new Error(`ACTIVE_TASK_CONFLICT:${activeId}`);
      }
      return;
    }
    throw e;
  }
}

async function persistEmployeeTaskUpdate(
  taskId: string,
  updates: Partial<WorkPackage>
): Promise<void> {
  await ensureServerWriteContext();
  const pkg = updateWorkPackage(taskId, updates);
  if (!pkg) throw new Error("Task not found");
  await persistWorkPackageDb(pkg);
}

export async function startQueueTaskAction(taskId: string) {
  const user = await requireEmployee();
  await assertWorkEligible(user, "start_task", { taskId });
  await assertCanEditWorkPackage(user, taskId);

  const board = getEmployeeTasks(user.id);
  const task = board.all.find((t) => t.id === taskId);
  if (!task) throw new Error("Task not found");

  try {
    await startTimerForTask(user, taskId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("ACTIVE_TASK_CONFLICT:")) {
      const activeTaskId = msg.replace("ACTIVE_TASK_CONFLICT:", "");
      return {
        ok: false as const,
        code: "ACTIVE_TASK_CONFLICT",
        message: "You already have an active task. Pause or complete the current task before starting another.",
        activeTaskId,
      };
    }
    throw e;
  }

  if (task.status !== "working_on_it") {
    await persistEmployeeTaskUpdate(taskId, { status: "working_on_it" });
  }
  await demoteOtherInProgressTasks(user.id, taskId);
  revalidateWork();
  return { ok: true as const, taskId };
}

export async function startNextTaskAction() {
  const user = await requireEmployee();
  await assertWorkEligible(user, "start_task");

  const board = getEmployeeTasks(user.id);
  const next = pickNextTask(board.all);
  if (!next) {
    return { ok: false as const, code: "NO_TASK", message: "No assigned tasks available." };
  }

  try {
    await startTimerForTask(user, next.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("ACTIVE_TASK_CONFLICT:")) {
      const activeTaskId = msg.replace("ACTIVE_TASK_CONFLICT:", "");
      return {
        ok: false as const,
        code: "ACTIVE_TASK_CONFLICT",
        message: "You already have an active task. Pause or complete the current task before starting another.",
        activeTaskId,
      };
    }
    throw e;
  }

  if (next.status !== "working_on_it") {
    await persistEmployeeTaskUpdate(next.id, { status: "working_on_it" });
  }
  await demoteOtherInProgressTasks(user.id, next.id);
  revalidateWork();

  return { ok: true as const, taskId: next.id };
}

/** Switch tasks without clocking out: the current timer session stops (its
 * minutes are already saved), the new task starts, and the old task returns
 * to the top of Up Next. */
export async function switchToTaskAction(taskId: string) {
  const user = await requireEmployee();
  await assertWorkEligible(user, "start_task", { taskId });
  await assertCanEditWorkPackage(user, taskId);
  await ensureServerWriteContext();

  const active = getActiveTaskTimeEntry(user.id);
  if (active && active.task_id !== taskId) {
    const stopped = stopTaskTimer(user.id);
    await persistTaskTimeEntrySync(stopped);
  }

  try {
    await startTimerForTask(user, taskId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not switch tasks";
    return { ok: false as const, message: msg };
  }

  await persistEmployeeTaskUpdate(taskId, { status: "working_on_it" });
  await demoteOtherInProgressTasks(user.id, taskId);
  revalidateWork();
  return { ok: true as const, taskId };
}

export async function employeeUpdateNotesAction(taskId: string, notes: string) {
  const user = await requireOwnTask(taskId);
  await persistEmployeeTaskUpdate(taskId, { notes: notes || null });
  revalidateWork();
  return user.id;
}

export async function employeeReopenTaskAction(taskId: string) {
  const user = await requireOwnTask(taskId);
  await assertWorkEligible(user, "resume_task", { taskId });
  await persistEmployeeTaskUpdate(taskId, { status: "working_on_it" });
  await demoteOtherInProgressTasks(user.id, taskId);
  revalidateWork();
}

/** Pre-fill the wrap-up from today's tracked activity (timers, uploads, QA submits). */
export async function getWrapUpDraftAction() {
  const user = await requireEmployee();
  await ensureServerWriteContext();
  const { buildWrapUpDraft } = await import("@/lib/wrap-up/draft");
  return buildWrapUpDraft(user.id);
}

export async function submitDailyWrapUpAction(input: {
  completed_summary: string;
  blockers: string;
  needs_support: boolean;
  needs_support_note?: string;
  activity_documentation_category?: string;
  activity_documentation_note?: string;
}) {
  const user = await requireEmployee();
  try {
  await ensureServerWriteContext();
  const { getTodayVisibilityForUser } = await import("@/lib/work-visibility/calculator");
  const visibility = getTodayVisibilityForUser(user.id);
  const wrapUp = createDailyWrapUp({
    user_id: user.id,
    wrap_date: appTodayDate(),
    completed_summary: input.completed_summary || null,
    blockers: input.blockers || null,
    needs_support: input.needs_support,
    needs_support_note: input.needs_support_note ?? null,
    clocked_minutes: visibility.clockedMinutes,
    recorded_task_minutes: visibility.recordedTaskMinutes,
    unassigned_minutes: visibility.unassignedMinutes,
    task_tracking_compliance_pct: visibility.taskTrackingCompliancePct,
    activity_documentation_category:
      visibility.unassignedMinutes > 0 && input.activity_documentation_category
        ? (input.activity_documentation_category as import("@/types/flow").ActivityDocumentationCategory)
        : null,
    activity_documentation_note:
      visibility.unassignedMinutes > 0 && input.activity_documentation_note
        ? input.activity_documentation_note
        : null,
  });
  await persistDailyWrapUpSync(wrapUp);

  const hasBlockers = !!input.blockers?.trim();
  if (input.needs_support || hasBlockers) {
    await hydrateHelpFlagSettings();
    initFlowStore();
    const notes = [input.needs_support_note, input.blockers]
      .filter((s) => s?.trim())
      .join(" · ");
    raiseHelpFlag({
      employee: user,
      reason: input.needs_support ? "workload_concern" : "stuck_on_task",
      notes: notes || null,
      source: "wrap_up",
      wrapUpId: wrapUp.id,
    });
  }

  revalidateWork();
  revalidatePath("/time-clock");
  revalidatePath("/executive");
  revalidatePath("/operations");
  return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Could not save daily report",
    };
  }
}
