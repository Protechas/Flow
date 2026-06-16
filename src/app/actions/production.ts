"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { assertCanEditWorkPackage } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getActiveTaskTimeEntry,
  getLatestSubmission,
  getTaskFiles,
  getTotalTaskMinutes,
  pauseTaskTimer,
  resumeTaskTimer,
  startTaskTimer,
  stopTaskTimer,
  submitTaskForReview,
  uploadTaskFile,
} from "@/lib/data/production-tracking";
import {
  refreshTaskLiveForecastExternal,
  updateWorkPackageExternal,
} from "@/lib/data/production-bridge";

function revalidateProduction(taskId?: string) {
  revalidatePath("/work");
  revalidatePath("/production");
  revalidatePath("/reports");
  revalidatePath("/qa-center");
  revalidatePath("/operations");
  revalidatePath("/dashboard");
  if (taskId) revalidatePath(`/work/${taskId}`);
}

export async function startTaskTimerAction(taskId: string) {
  const user = await requireUser();
  await assertCanEditWorkPackage(user, taskId);
  try {
    startTaskTimer(user.id, taskId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to start task";
    if (msg.startsWith("ACTIVE_TASK:")) {
      return { ok: false as const, activeTaskId: msg.replace("ACTIVE_TASK:", "") };
    }
    throw e;
  }
  revalidateProduction(taskId);
  return { ok: true as const };
}

export async function pauseTaskTimerAction() {
  const user = await requireUser();
  pauseTaskTimer(user.id);
  revalidateProduction();
  return { ok: true as const };
}

export async function resumeTaskTimerAction() {
  const user = await requireUser();
  resumeTaskTimer(user.id);
  revalidateProduction();
  return { ok: true as const };
}

export async function stopTaskTimerAction() {
  const user = await requireUser();
  const entry = stopTaskTimer(user.id);
  revalidateProduction(entry.task_id);
  return { ok: true as const, taskId: entry.task_id, minutes: entry.total_active_minutes };
}

export async function uploadTaskFileAction(formData: FormData) {
  const user = await requireUser();
  const taskId = String(formData.get("task_id") ?? "");
  const file = formData.get("file") as File | null;
  if (!taskId || !file) {
    return { ok: false as const, message: "Task and file are required" };
  }
  try {
    await assertCanEditWorkPackage(user, taskId);
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > 10 * 1024 * 1024) {
      return { ok: false as const, message: "File must be 10 MB or smaller" };
    }
    uploadTaskFile({
      task_id: taskId,
      user_id: user.id,
      file_name: file.name,
      file_type: file.type || "application/octet-stream",
      file_size: buffer.length,
      file_data_base64: buffer.toString("base64"),
    });
    revalidateProduction(taskId);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Upload failed" };
  }
}

export async function submitTaskForReviewAction(taskId: string, notes?: string) {
  const user = await requireUser();
  try {
    await assertCanEditWorkPackage(user, taskId);
    const managerOverride = hasPermission(user.role, "work:assign");
    submitTaskForReview({
      task_id: taskId,
      user_id: user.id,
      notes,
      manager_override: managerOverride,
    });
    revalidateProduction(taskId);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Submission failed" };
  }
}

export async function getTaskProductionStateAction(taskId: string) {
  const user = await requireUser();
  await assertCanEditWorkPackage(user, taskId);
  const active = getActiveTaskTimeEntry(user.id);
  return {
    activeTimer: active?.task_id === taskId ? active : null,
    anyActiveTimer: active,
    files: getTaskFiles(taskId),
    totalMinutes: getTotalTaskMinutes(taskId),
    latestSubmission: getLatestSubmission(taskId),
  };
}

export async function updateTaskDocumentProgressAction(taskId: string, completed: number) {
  const user = await requireUser();
  await assertCanEditWorkPackage(user, taskId);
  const count = Math.max(0, Math.round(completed));
  updateWorkPackageExternal(taskId, { current_documents_completed: count });
  refreshTaskLiveForecastExternal(taskId, getTotalTaskMinutes(taskId));
  revalidateProduction(taskId);
  return { ok: true as const };
}
