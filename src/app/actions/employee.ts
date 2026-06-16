"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assertCanEditWorkPackage,
  requireUser,
} from "@/lib/auth/session";
import { isEmployeeRole } from "@/lib/auth/permissions";
import { assertWorkEligible } from "@/lib/work-eligibility";
import { pickNextTask, getEmployeeTasks } from "@/lib/employee/tasks";
import { startTaskTimer } from "@/lib/data/production-tracking";
import { createDailyWrapUp, updateWorkPackage, initFlowStore } from "@/lib/data/flow-store";
import { hydrateHelpFlagSettings } from "@/lib/help-flags/hydrate";
import { raiseHelpFlag } from "@/lib/help-flags/engine";
import { format } from "date-fns";

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

export async function startNextTaskAction() {
  const user = await requireEmployee();
  await assertWorkEligible(user, "start_task");

  const board = getEmployeeTasks(user.id);
  const next = pickNextTask(board.all);
  if (!next) {
    redirect("/work");
  }

  if (next.status !== "working_on_it") {
    updateWorkPackage(next.id, { status: "working_on_it" });
  }
  try {
    startTaskTimer(user.id, next.id);
  } catch {
    // Active timer on another task — still navigate
  }
  revalidateWork();

  redirect(`/work/${next.id}?autostart=1`);
}

export async function employeeUpdateNotesAction(taskId: string, notes: string) {
  const user = await requireOwnTask(taskId);
  updateWorkPackage(taskId, { notes: notes || null });
  revalidateWork();
  return user.id;
}

export async function employeeReopenTaskAction(taskId: string) {
  const user = await requireOwnTask(taskId);
  await assertWorkEligible(user, "resume_task", { taskId });
  updateWorkPackage(taskId, { status: "working_on_it" });
  revalidateWork();
}

export async function submitDailyWrapUpAction(input: {
  completed_summary: string;
  blockers: string;
  needs_support: boolean;
  needs_support_note?: string;
}) {
  const user = await requireEmployee();
  const wrapUp = createDailyWrapUp({
    user_id: user.id,
    wrap_date: format(new Date(), "yyyy-MM-dd"),
    completed_summary: input.completed_summary || null,
    blockers: input.blockers || null,
    needs_support: input.needs_support,
    needs_support_note: input.needs_support_note ?? null,
  });

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
}
