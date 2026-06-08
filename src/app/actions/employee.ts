"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assertCanEditWorkPackage,
  requireUser,
} from "@/lib/auth/session";
import { isEmployeeRole } from "@/lib/auth/permissions";
import { pickNextTask, getEmployeeTasks } from "@/lib/employee/tasks";
import {
  createDailyWrapUp,
  createTimeLog,
  updateWorkPackage,
} from "@/lib/data/flow-store";
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
  const board = await getEmployeeTasks(user.id);
  const next = pickNextTask(board.all);
  if (!next) {
    redirect("/work");
  }

  if (next.status !== "working_on_it") {
    updateWorkPackage(next.id, { status: "working_on_it" });
    revalidateWork();
  }

  redirect(`/work/${next.id}?autostart=1`);
}

export async function employeeStartTaskAction(taskId: string) {
  const user = await requireOwnTask(taskId);
  updateWorkPackage(taskId, {
    status: "working_on_it",
  });
  revalidateWork();
  return { ok: true as const, userId: user.id };
}

export async function employeeSubmitToQaAction(taskId: string) {
  await requireOwnTask(taskId);
  updateWorkPackage(taskId, {
    status: "ready_for_qa",
    qa_status: "pending",
  });
  revalidateWork();
}

export async function employeeMarkCompleteAction(taskId: string) {
  await requireOwnTask(taskId);
  const today = format(new Date(), "yyyy-MM-dd");
  updateWorkPackage(taskId, {
    status: "done",
    completed_date: today,
    qa_status: "passed",
  });
  revalidateWork();
}

export async function employeeUpdateNotesAction(taskId: string, notes: string) {
  const user = await requireOwnTask(taskId);
  updateWorkPackage(taskId, { notes: notes || null });
  revalidateWork();
  return user.id;
}

export async function employeeLogTimerAction(taskId: string, hours: number) {
  const user = await requireOwnTask(taskId);
  if (hours <= 0) return;
  createTimeLog({
    work_package_id: taskId,
    user_id: user.id,
    hours,
    log_date: format(new Date(), "yyyy-MM-dd"),
    notes: "Timer session",
  });
  revalidateWork();
}

export async function employeeReopenTaskAction(taskId: string) {
  await requireOwnTask(taskId);
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
  createDailyWrapUp({
    user_id: user.id,
    wrap_date: format(new Date(), "yyyy-MM-dd"),
    completed_summary: input.completed_summary || null,
    blockers: input.blockers || null,
    needs_support: input.needs_support,
    needs_support_note: input.needs_support_note ?? null,
  });
  revalidateWork();
  revalidatePath("/scorecard");
}
