"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { runAutoContentChecksForTask } from "@/lib/content-checks/reviews";
import { requireUser } from "@/lib/auth/session";
import { assertCanEditWorkPackage } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { assertWorkEligible, checkWorkEligible } from "@/lib/work-eligibility";
import { demoteOtherInProgressTasks } from "@/lib/employee/single-focus";
import { recordBlockedWorkAttempt } from "@/lib/work-eligibility/audit";
import {
  getTaskFileMaxBytes,
  formatUploadLimitLabel,
} from "@/lib/files/upload-limits";
import {
  getActiveTaskTimeEntry,
  getLatestSubmission,
  getProductionStore,
  getTaskFiles,
  getTotalTaskMinutes,
  pauseTaskTimer,
  resumeTaskTimer,
  startTaskTimer,
  stopTaskTimer,
  submitBatchForReview,
  submitTaskForReview,
  uploadTaskFile,
} from "@/lib/data/production-tracking";
import {
  persistTaskFileUploadSync,
  persistTaskSubmissionSync,
  persistTaskTimeEntrySync,
} from "@/lib/data/production-tracking-db";
import {
  refreshTaskLiveForecastExternal,
  updateWorkPackageExternal,
} from "@/lib/data/production-bridge";
import { ensureServerWriteContext } from "@/lib/server/write-context";
import {
  persistPackageState,
  persistTimerSessionLog,
} from "@/lib/production/persist-helpers";
import { newPersistedId } from "@/lib/server/persisted-id";
import {
  removeTaskFileFromStorage,
  taskFileStoragePath,
  uploadTaskFileToStorage,
} from "@/lib/files/task-files";
import { isSupabaseConfigured } from "@/lib/supabase/client";

function revalidateProduction(taskId?: string) {
  revalidatePath("/work");
  revalidatePath("/production");
  revalidatePath("/reports");
  revalidatePath("/qa-center");
  revalidatePath("/operations");
  revalidatePath("/dashboard");
  if (taskId) revalidatePath(`/work/${taskId}`);
}

export async function startTaskTimerAction(taskId: string, managerOverride?: boolean) {
  const user = await requireUser();
  await assertCanEditWorkPackage(user, taskId);
  const gate = await checkWorkEligible(user, "start_timer", {
    managerOverride,
    taskId,
  });
  if (!gate.ok) {
    return { ok: false as const, code: gate.code, message: gate.message };
  }
  try {
    await ensureServerWriteContext();
    const entry = startTaskTimer(user.id, taskId);
    await persistTaskTimeEntrySync(entry);
    await persistPackageState(taskId);
    // Single focus: starting a timer here means this is the task being
    // worked — any other working_on_it task returns to the queue.
    await demoteOtherInProgressTasks(user.id, taskId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to start task";
    if (msg.startsWith("ACTIVE_TASK:")) {
      const activeId = msg.replace("ACTIVE_TASK:", "");
      await recordBlockedWorkAttempt(
        user,
        "start_timer",
        "You already have an active task. Pause or complete the current task before starting another.",
        activeId
      );
      return { ok: false as const, activeTaskId: activeId, code: "ACTIVE_TASK_CONFLICT" };
    }
    throw e;
  }
  revalidateProduction(taskId);
  return { ok: true as const };
}

export async function pauseTaskTimerAction() {
  const user = await requireUser();
  await ensureServerWriteContext();
  const entry = pauseTaskTimer(user.id);
  await persistTaskTimeEntrySync(entry);
  revalidateProduction();
  return { ok: true as const };
}

export async function resumeTaskTimerAction(managerOverride?: boolean) {
  const user = await requireUser();
  const gate = await checkWorkEligible(user, "resume_timer", { managerOverride });
  if (!gate.ok) {
    return { ok: false as const, code: gate.code, message: gate.message };
  }
  await ensureServerWriteContext();
  const entry = resumeTaskTimer(user.id);
  await persistTaskTimeEntrySync(entry);
  revalidateProduction();
  return { ok: true as const };
}

export async function stopTaskTimerAction() {
  const user = await requireUser();
  await ensureServerWriteContext();
  const entry = stopTaskTimer(user.id);
  await persistTaskTimeEntrySync(entry);
  await persistTimerSessionLog(entry);
  await persistPackageState(entry.task_id);
  revalidateProduction(entry.task_id);
  return { ok: true as const, taskId: entry.task_id, minutes: entry.total_active_minutes };
}

export async function uploadTaskFileAction(formData: FormData) {
  const user = await requireUser();
  const taskId = String(formData.get("task_id") ?? "");
  const file = formData.get("file") as File | null;
  const managerOverride = formData.get("manager_override") === "true";
  if (!taskId || !file) {
    return { ok: false as const, message: "Task and file are required" };
  }
  try {
    await assertCanEditWorkPackage(user, taskId);
    const gate = await checkWorkEligible(user, "upload_file", {
      managerOverride,
      taskId,
    });
    if (!gate.ok) {
      return { ok: false as const, code: gate.code, message: gate.message };
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const maxBytes = getTaskFileMaxBytes();
    if (buffer.length > maxBytes) {
      return {
        ok: false as const,
        message: `File must be ${formatUploadLimitLabel(maxBytes)} or smaller`,
      };
    }
    await ensureServerWriteContext();
    const fileId = newPersistedId("tfu");
    const contentType = file.type || "application/octet-stream";
    const useStorage = isSupabaseConfigured();
    const storagePath = useStorage ? taskFileStoragePath(taskId, fileId, file.name) : null;
    if (storagePath) {
      await uploadTaskFileToStorage({ storagePath, buffer, contentType });
    }
    try {
      const upload = uploadTaskFile({
        id: fileId,
        task_id: taskId,
        user_id: user.id,
        file_name: file.name,
        file_type: contentType,
        file_size: buffer.length,
        storage_path: storagePath,
        // Renaming a file can't change its bytes — dedupe keys on this.
        content_hash: createHash("sha256").update(buffer).digest("hex"),
        // Demo mode has no storage bucket — keep bytes in memory instead
        ...(useStorage ? {} : { file_data_base64: buffer.toString("base64") }),
      });
      await persistTaskFileUploadSync(upload);
    } catch (persistError) {
      if (storagePath) await removeTaskFileFromStorage(storagePath).catch(() => {});
      throw persistError;
    }
    await persistPackageState(taskId);
    revalidateProduction(taskId);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Upload failed" };
  }
}

export async function submitTaskForReviewAction(
  taskId: string,
  notes?: string,
  managerOverride?: boolean
) {
  const user = await requireUser();
  try {
    await assertCanEditWorkPackage(user, taskId);
    const gate = await checkWorkEligible(user, "submit_task", {
      managerOverride,
      taskId,
    });
    if (!gate.ok) {
      return { ok: false as const, code: gate.code, message: gate.message };
    }
    const roleOverride = hasPermission(user.role, "work:assign");
    await ensureServerWriteContext();
    const record = submitTaskForReview({
      task_id: taskId,
      user_id: user.id,
      notes,
      manager_override: managerOverride || roleOverride,
    });
    await persistTaskSubmissionSync(record);
    const completedTimer = getProductionStore()
      .taskTimeEntries.filter(
        (e) => e.user_id === user.id && e.task_id === taskId && e.status === "completed"
      )
      .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))[0];
    if (completedTimer) {
      await persistTaskTimeEntrySync(completedTimer);
      await persistTimerSessionLog(completedTimer);
    }
    // Without this, the ready_for_qa status never reaches the DB and the
    // task neither shows as submitted nor appears in the QA queue.
    await persistPackageState(taskId);
    // Free content checks run after the response — submit stays instant.
    after(() => runAutoContentChecksForTask(taskId, record.file_ids ?? null));
    revalidateProduction(taskId);
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Submission failed";
    if (message.includes("file is required")) {
      await recordBlockedWorkAttempt(
        user,
        "submit_task",
        "Required files must be uploaded before this task can be submitted.",
        taskId
      );
    }
    return { ok: false as const, message };
  }
}

export async function submitBatchForReviewAction(taskId: string, notes?: string) {
  const user = await requireUser();
  try {
    await assertCanEditWorkPackage(user, taskId);
    const gate = await checkWorkEligible(user, "submit_task", { taskId });
    if (!gate.ok) {
      return { ok: false as const, code: gate.code, message: gate.message };
    }
    await ensureServerWriteContext();
    const record = submitBatchForReview({
      task_id: taskId,
      user_id: user.id,
      notes,
    });
    await persistTaskSubmissionSync(record);
    // Free content checks run after the response — submit stays instant.
    after(() => runAutoContentChecksForTask(taskId, record.file_ids ?? null));
    revalidateProduction(taskId);
    return { ok: true as const, fileCount: record.uploaded_file_count };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Batch submission failed" };
  }
}

export async function getTaskProductionStateAction(taskId: string) {
  const user = await requireUser();
  await assertCanEditWorkPackage(user, taskId);
  await ensureServerWriteContext();
  const active = getActiveTaskTimeEntry(user.id);
  return {
    activeTimer: active?.task_id === taskId ? active : null,
    anyActiveTimer: active,
    files: getTaskFiles(taskId),
    totalMinutes: getTotalTaskMinutes(taskId),
    latestSubmission: getLatestSubmission(taskId),
  };
}

export async function updateTaskDocumentProgressAction(
  taskId: string,
  completed: number,
  managerOverride?: boolean
) {
  const user = await requireUser();
  await assertCanEditWorkPackage(user, taskId);
  const gate = await checkWorkEligible(user, "mark_documents", {
    managerOverride,
    taskId,
  });
  if (!gate.ok) {
    return { ok: false as const, code: gate.code, message: gate.message };
  }
  await ensureServerWriteContext();
  const count = Math.max(0, Math.round(completed));
  updateWorkPackageExternal(taskId, { current_documents_completed: count });
  refreshTaskLiveForecastExternal(taskId, getTotalTaskMinutes(taskId));
  await persistPackageState(taskId);
  revalidateProduction(taskId);
  return { ok: true as const };
}
