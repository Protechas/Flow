"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import {
  createValidationRun,
  getSiLibrarySettings,
  getValidationRun,
  linkValidationRevalidation,
  listValidationRuns,
  saveSiLibrarySettings,
} from "@/lib/validation-center/runs";
import {
  listValidationFindings,
  updateValidationFinding,
} from "@/lib/validation-center/findings";
import type {
  SiLibraryAuditSettings,
  ValidationEngineId,
  ValidationFindingStatus,
  ValidationRootCause,
} from "@/lib/validation-center/types";

const VALIDATION_PATHS = [
  "/validation",
  "/validation/runs",
  "/validation/new",
  "/validation/findings",
  "/validation/corrections",
  "/validation/history",
  "/validation/reports",
  "/validation/analytics",
];

function revalidateValidation() {
  for (const path of VALIDATION_PATHS) {
    revalidatePath(path);
  }
}

export async function listValidationRunsAction() {
  const user = await requireUser();
  if (!hasPermission(user.role, "validation:view")) {
    return [];
  }
  return listValidationRuns();
}

export async function getValidationRunAction(runId: string) {
  const user = await requireUser();
  if (!hasPermission(user.role, "validation:view")) {
    return null;
  }
  return getValidationRun(runId);
}

export async function createValidationRunAction(formData: FormData) {
  const user = await requireUser();
  if (!hasPermission(user.role, "validation:create")) {
    return { ok: false as const, message: "You do not have permission to start validations" };
  }
  if (!hasPermission(user.role, "validation:run")) {
    return { ok: false as const, message: "You do not have permission to run validations" };
  }

  const engineId = String(formData.get("engine_id") ?? "si_library_audit") as ValidationEngineId;
  const mcFile = formData.get("manufacturer_chart") as File | null;
  const exportFile = formData.get("onedrive_export") as File | null;

  if (!mcFile?.size) {
    return { ok: false as const, message: "Manufacturer chart file is required" };
  }
  if (!exportFile?.size) {
    return { ok: false as const, message: "OneDrive export file is required" };
  }

  try {
    const mcBuffer = Buffer.from(await mcFile.arrayBuffer());
    const exportBuffer = Buffer.from(await exportFile.arrayBuffer());
    const run = await createValidationRun({
      engine_id: engineId,
      created_by: user.id,
      mc_file: {
        name: mcFile.name,
        buffer: mcBuffer,
        mime_type: mcFile.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      export_file: {
        name: exportFile.name,
        buffer: exportBuffer,
        mime_type: exportFile.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
    revalidateValidation();
    revalidatePath(`/validation/runs/${run.id}`);
    return { ok: true as const, runId: run.id };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Failed to start validation run",
    };
  }
}

export async function refreshValidationRunAction(runId: string) {
  const user = await requireUser();
  if (!hasPermission(user.role, "validation:view")) {
    return null;
  }
  return getValidationRun(runId);
}

export async function listFindingsForRunAction(runId: string) {
  const user = await requireUser();
  if (!hasPermission(user.role, "validation:view")) {
    return [];
  }
  const { listFindingsForRun } = await import("@/lib/validation-center/findings");
  return listFindingsForRun(runId);
}

export async function getSiLibrarySettingsAction() {
  const user = await requireUser();
  if (!hasPermission(user.role, "validation:manage_settings")) {
    return null;
  }
  return getSiLibrarySettings();
}

export async function saveSiLibrarySettingsAction(settings: SiLibraryAuditSettings) {
  const user = await requireUser();
  if (!hasPermission(user.role, "validation:manage_settings")) {
    return { ok: false as const, message: "You do not have permission to change validation settings" };
  }

  try {
    await saveSiLibrarySettings(settings, user.id);
    revalidatePath("/validation/settings");
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Failed to save settings",
    };
  }
}

export async function listValidationFindingsAction() {
  const user = await requireUser();
  if (!hasPermission(user.role, "validation:view")) {
    return [];
  }
  return listValidationFindings();
}

export async function updateValidationFindingAction(
  findingId: string,
  patch: { status?: ValidationFindingStatus; root_cause?: ValidationRootCause }
) {
  const user = await requireUser();
  if (!hasPermission(user.role, "validation:review")) {
    return { ok: false as const, message: "You do not have permission to update findings" };
  }

  try {
    const finding = await updateValidationFinding(findingId, patch);
    if (!finding) {
      return { ok: false as const, message: "Finding not found" };
    }
    revalidateValidation();
    return { ok: true as const, finding };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Failed to update finding",
    };
  }
}

export async function createTasksFromValidationFindingsAction(input: {
  findingIds: string[];
  projectId: string;
  assignedTo?: string | null;
}) {
  const user = await requireUser();
  if (!hasPermission(user.role, "validation:create_tasks")) {
    return {
      ok: false as const,
      message: "You do not have permission to create tasks from findings",
    };
  }

  if (!input.findingIds.length) {
    return { ok: false as const, message: "Select at least one finding" };
  }

  try {
    await listValidationFindings();

    const { createTasksFromFindings } = await import("@/lib/validation-center/task-bridge");
    const { batchId, tasks, findings } = await createTasksFromFindings({
      findingIds: input.findingIds,
      projectId: input.projectId,
      assignedTo: input.assignedTo ?? null,
      createdBy: user.id,
    });

    revalidateValidation();
    revalidatePath("/operations");
    return {
      ok: true as const,
      batchId,
      tasksCreated: tasks.length,
      findings,
    };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Failed to create tasks from findings",
    };
  }
}

export async function linkValidationRevalidationAction(
  followUpRunId: string,
  priorRunId: string
) {
  const user = await requireUser();
  if (!hasPermission(user.role, "validation:review")) {
    return { ok: false as const, message: "You do not have permission to link revalidations" };
  }

  try {
    const run = await linkValidationRevalidation(followUpRunId, priorRunId);
    if (!run) {
      return { ok: false as const, message: "Run not found" };
    }
    revalidateValidation();
    return { ok: true as const, run };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Failed to link revalidation",
    };
  }
}
