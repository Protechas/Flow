"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit/audit-log";
import {
  assertCanAssignWorkPackage,
  assertCanEditWorkPackage,
  requirePermission,
  requireUser,
} from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { normalizeRole, isEmployeeRole } from "@/lib/auth/permissions";
import { assertWorkEligible } from "@/lib/work-eligibility";
import {
  bulkCreateYears,
  createComment,
  createFile,
  createManufacturer,
  createProject,
  createTimeLog,
  createWorkPackage,
  createYearWorkItem,
  deleteComment,
  deleteFile,
  deleteManufacturer,
  deleteProject,
  deleteTimeLog,
  deleteWorkPackage,
  deleteYearWorkItem,
  getFlowStore,
  initFlowStore,
  resolveCorrection,
  updateManufacturer,
  updateProject,
  updateWorkPackage,
  updateYearWorkItem,
  archiveProject,
  archiveManufacturer,
  unarchiveProject,
  unarchiveManufacturer,
  duplicateWorkPackage,
} from "@/lib/data/flow-store";
import {
  persistNewProject,
  persistProjectRemoval,
  persistProjectUpdate,
} from "@/lib/data/projects-db";
import { uploadTaskFile } from "@/lib/data/production-tracking";
import type {
  ManufacturerInput,
  ProjectInput,
  WorkPackageInput,
  WorkPackage,
} from "@/types/flow";
import type { ProjectTemplateId } from "@/lib/templates/project-templates";
import { createQuickTask, type QuickTaskInput } from "@/lib/data/create-work-setup";
import type { ForecastComplexityLevel } from "@/types/flow";
import { syncDerivedOperationalAlerts } from "@/lib/integrations/sync-derived-alerts";

const PATHS = [
  "/operations",
  "/executive",
  "/people",
  "/project-health",
  "/projects",
  "/qa-center",
  "/reports",
  "/work",
  "/performance",
  "/planning",
  "/alert-center",
];

function revalidateAll() {
  PATHS.forEach((p) => revalidatePath(p));
}

function afterWorkMutation() {
  syncDerivedOperationalAlerts();
  revalidateAll();
}

function assertEmployeeStatusChange(
  user: Awaited<ReturnType<typeof requireUser>>,
  updates: Partial<WorkPackage>
) {
  if (!hasPermission(user.role, "work:edit_own")) return;
  if (hasPermission(user.role, "work:edit")) return;
  const allowed = ["status", "notes", "assigned_to"];
  const keys = Object.keys(updates);
  if (keys.some((k) => !allowed.includes(k))) {
    throw new Error("FORBIDDEN");
  }
  if (updates.status === "ready_for_qa" && !hasPermission(user.role, "work:submit_qa")) {
    throw new Error("FORBIDDEN");
  }
}

export async function createProjectAction(
  input: ProjectInput,
  templateId?: ProjectTemplateId
) {
  const user = await requirePermission("projects:create");
  const ownerId =
    input.project_owner_id && input.project_owner_id !== "__none__"
      ? input.project_owner_id
      : normalizeRole(user.role) === "teamlead"
        ? user.id
        : null;
  const sanitized = {
    ...input,
    project_owner_id: ownerId,
    created_by: user.id,
  };
  const project = createProject(sanitized, templateId);
  await persistNewProject(project);
  await writeAuditLog({
    action: "project_changed",
    entityType: "project",
    entityId: project.id,
    summary: `Created project ${project.name}`,
  });
  revalidateAll();
  return project;
}

export async function createBoardAction(input: {
  name: string;
  description?: string | null;
  departmentId: string;
  teamId: string;
  templateId?: string;
}) {
  const user = await requirePermission("projects:create");
  const tplPurpose = input.description?.trim();
  const project = createProject(
    {
      name: input.name.trim(),
      description: tplPurpose || null,
      project_type: "board",
      status: "active",
      priority: "medium",
      start_date: new Date().toISOString().split("T")[0],
      due_date: null,
      department_id: input.departmentId,
      team_id: input.teamId,
      project_owner_id:
        normalizeRole(user.role) === "teamlead" ? user.id : user.id,
      created_by: user.id,
      estimated_total_documents: null,
      planning_complexity_level: "standard",
    },
    "custom"
  );
  await persistNewProject(project);
  await writeAuditLog({
    action: "project_changed",
    entityType: "project",
    entityId: project.id,
    summary: `Created board ${project.name}`,
    metadata: { project_type: "board", template: input.templateId },
  });
  revalidateAll();
  return project;
}

export async function createProjectWizardAction(input: {
  name: string;
  templateId: ProjectTemplateId;
  departmentId: string;
  teamId: string;
  boardProjectId?: string | null;
  boardName?: string | null;
  estimatedDocuments?: number | null;
  manualDueDate?: string | null;
  ownerId?: string | null;
  complexity?: ForecastComplexityLevel;
  priority?: import("@/types/flow").WorkPriority;
  description?: string | null;
}) {
  const user = await requirePermission("projects:create");
  const tpl = input.templateId;
  const tplMeta = (await import("@/lib/templates/project-templates")).PROJECT_TEMPLATES.find(
    (t) => t.id === tpl
  );
  const descParts = [
    input.boardName ? `Board: ${input.boardName}` : null,
    input.description?.trim() || null,
  ].filter(Boolean);

  const ownerId =
    input.ownerId && input.ownerId !== "__none__"
      ? input.ownerId
      : normalizeRole(user.role) === "teamlead"
        ? user.id
        : null;

  const project = createProject(
    {
      name: input.name.trim(),
      description: descParts.length ? descParts.join(" · ") : null,
      project_type: tplMeta?.projectType ?? "custom",
      status: "active",
      priority: input.priority ?? "medium",
      start_date: new Date().toISOString().split("T")[0],
      due_date: input.manualDueDate ?? null,
      manual_project_due_date: input.manualDueDate ?? null,
      department_id: input.departmentId,
      team_id: input.teamId,
      project_owner_id: ownerId,
      created_by: user.id,
      estimated_total_documents: input.estimatedDocuments ?? null,
      planning_complexity_level: input.complexity ?? "standard",
    },
    tpl
  );
  await persistNewProject(project);
  await writeAuditLog({
    action: "project_changed",
    entityType: "project",
    entityId: project.id,
    summary: `Created project ${project.name}`,
    metadata: { template: tpl, board_id: input.boardProjectId },
  });
  revalidateAll();
  return project;
}

export async function createQuickTaskAction(input: {
  projectId?: string | null;
  newProjectName?: string | null;
  manufacturerName?: string;
  year?: number;
  taskTitle?: string | null;
  assignedTo?: string | null;
  estimatedDocumentCount?: number | null;
  complexityLevel?: ForecastComplexityLevel;
  projectDocumentEstimate?: number | null;
  priority?: import("@/types/flow").WorkPriority;
  departmentId?: string;
  teamId?: string;
}) {
  const user = await requireUser();
  if (!hasPermission(user.role, "projects:edit")) {
    throw new Error("FORBIDDEN");
  }
  if (input.assignedTo) {
    await assertCanAssignWorkPackage(user, input.assignedTo);
  }

  const quickInput: QuickTaskInput = {
    projectId: input.projectId,
    newProjectName: input.newProjectName,
    manufacturerName: input.manufacturerName ?? "General",
    year: input.year ?? new Date().getFullYear(),
    taskTitle: input.taskTitle,
    assignedTo: input.assignedTo,
    estimatedDocumentCount: input.estimatedDocumentCount,
    complexityLevel: input.complexityLevel,
    projectDocumentEstimate: input.projectDocumentEstimate,
    priority: input.priority,
    projectOwnerId:
      normalizeRole(user.role) === "teamlead" ? user.id : null,
  };

  const hadProject = Boolean(input.projectId);
  const task = createQuickTask(quickInput);
  if (!hadProject) {
    const project = getFlowStore().projects.find((p) => p.id === task.project_id);
    if (project) await persistNewProject(project);
  }
  const assigneeName = input.assignedTo
    ? getFlowStore().users.find((u) => u.id === input.assignedTo)?.full_name ?? input.assignedTo
    : "unassigned";

  await writeAuditLog({
    action: "project_changed",
    entityType: "work_package",
    entityId: task.id,
    summary: `Created task ${task.title} → ${assigneeName}`,
    metadata: { project_id: task.project_id, assigned_to: input.assignedTo },
  });
  revalidateAll();
  return task;
}

export async function updateProjectAction(id: string, updates: Partial<ProjectInput & { status?: string }>) {
  await requirePermission("projects:edit");
  const p = updateProject(id, updates);
  if (p) await persistProjectUpdate(id, p);
  await writeAuditLog({
    action: "project_changed",
    entityType: "project",
    entityId: id,
    summary: `Updated project ${p?.name ?? id}`,
    metadata: updates as Record<string, unknown>,
  });
  revalidateAll();
  return p;
}

export async function archiveProjectAction(id: string) {
  await requirePermission("projects:edit");
  archiveProject(id);
  await persistProjectUpdate(id, { status: "archived" });
  revalidateAll();
}

export async function unarchiveProjectAction(id: string) {
  await requirePermission("projects:edit");
  unarchiveProject(id);
  await persistProjectUpdate(id, { status: "active" });
  revalidateAll();
}

export async function deleteProjectAction(id: string) {
  await requirePermission("projects:delete");
  deleteProject(id);
  await persistProjectRemoval(id);
  revalidateAll();
}

export async function archiveManufacturerAction(id: string) {
  await requirePermission("projects:edit");
  archiveManufacturer(id);
  revalidateAll();
}

export async function unarchiveManufacturerAction(id: string) {
  await requirePermission("projects:edit");
  unarchiveManufacturer(id);
  revalidateAll();
}

export async function createManufacturerAction(input: ManufacturerInput, years?: number[]) {
  await requirePermission("projects:edit");
  const mfr = createManufacturer(input);
  if (years?.length) bulkCreateYears(mfr.id, input.project_id, years);
  revalidateAll();
  return mfr;
}

export async function updateManufacturerAction(id: string, updates: Partial<ManufacturerInput>) {
  await requirePermission("projects:edit");
  const m = updateManufacturer(id, updates);
  revalidateAll();
  return m;
}

export async function deleteManufacturerAction(id: string) {
  await requirePermission("projects:delete");
  deleteManufacturer(id);
  revalidateAll();
}

export async function createYearAction(input: import("@/types/flow").YearWorkItemInput) {
  await requirePermission("projects:edit");
  const y = createYearWorkItem(input);
  revalidateAll();
  return y;
}

export async function bulkCreateYearsAction(
  manufacturerId: string,
  projectId: string,
  years: number[]
) {
  await requirePermission("projects:edit");
  const items = bulkCreateYears(manufacturerId, projectId, years);
  revalidateAll();
  return items;
}

export async function updateYearAction(id: string, updates: Partial<import("@/types/flow").YearWorkItem>) {
  const user = await requireUser();
  if (hasPermission(user.role, "projects:edit")) {
    updateYearWorkItem(id, updates);
    revalidateAll();
    return;
  }
  throw new Error("FORBIDDEN");
}

export async function deleteYearAction(id: string) {
  await requirePermission("projects:delete");
  deleteYearWorkItem(id);
  revalidateAll();
}

export async function createWorkPackageAction(input: WorkPackageInput) {
  const user = await requireUser();
  if (hasPermission(user.role, "projects:edit")) {
    if (input.assigned_to) await assertCanAssignWorkPackage(user, input.assigned_to);
    const p = createWorkPackage(input);
    afterWorkMutation();
    return p;
  }
  throw new Error("FORBIDDEN");
}

export async function updateWorkPackageAction(id: string, updates: Partial<WorkPackage>) {
  const user = await requireUser();
  await assertCanEditWorkPackage(user, id);
  assertEmployeeStatusChange(user, updates);
  if (updates.assigned_to !== undefined) {
    await assertCanAssignWorkPackage(user, updates.assigned_to);
  }
  const p = updateWorkPackage(id, updates);
  if (updates.status) {
    await writeAuditLog({
      action: "status_changed",
      entityType: "work_package",
      entityId: id,
      summary: `Status changed to ${updates.status}`,
      metadata: { status: updates.status },
    });
  }
  afterWorkMutation();
  return p;
}

export async function deleteWorkPackageAction(id: string) {
  await requirePermission("work:delete");
  deleteWorkPackage(id);
  revalidateAll();
}

export async function submitWorkPackageToQaAction(id: string) {
  const user = await requireUser();
  await assertCanEditWorkPackage(user, id);
  if (!hasPermission(user.role, "work:submit_qa") && !hasPermission(user.role, "work:edit")) {
    throw new Error("FORBIDDEN");
  }
  if (isEmployeeRole(user.role)) {
    await assertWorkEligible(user, "submit_qa", { taskId: id });
  }
  updateWorkPackage(id, { status: "ready_for_qa", qa_status: "pending" });
  await writeAuditLog({
    action: "status_changed",
    entityType: "work_package",
    entityId: id,
    summary: "Submitted work package to QA",
  });
  revalidateAll();
}

export async function completeWorkPackageAction(id: string) {
  const user = await requireUser();
  await assertCanEditWorkPackage(user, id);
  if (!hasPermission(user.role, "work:edit") && !hasPermission(user.role, "work:edit_own")) {
    throw new Error("FORBIDDEN");
  }
  if (isEmployeeRole(user.role)) {
    await assertWorkEligible(user, "complete_task", { taskId: id });
  }
  const today = new Date().toISOString().split("T")[0];
  updateWorkPackage(id, {
    status: "done",
    completed_date: today,
    qa_status: "passed",
  });
  revalidateAll();
}

export async function assignWorkPackageAction(
  id: string,
  assignedTo: string | null
) {
  const user = await requireUser();
  await assertCanEditWorkPackage(user, id);
  await assertCanAssignWorkPackage(user, assignedTo);
  const updates: Partial<WorkPackage> = {
    assigned_to: assignedTo,
  };
  if (assignedTo) {
    initFlowStore();
    const pkg = getFlowStore().workPackages.find((p) => p.id === id);
    if (pkg?.status === "not_started") updates.status = "assigned";
  }
  updateWorkPackage(id, updates);
  const assignee = assignedTo
    ? getFlowStore().users.find((u) => u.id === assignedTo)?.full_name ?? assignedTo
    : "unassigned";
  await writeAuditLog({
    action: "assignment_changed",
    entityType: "work_package",
    entityId: id,
    summary: `Assigned work package to ${assignee}`,
    metadata: { assigned_to: assignedTo },
  });
  revalidateAll();
}

export async function createTimeLogAction(input: {
  work_package_id: string;
  user_id: string;
  hours: number;
  log_date: string;
  notes?: string;
}) {
  const user = await requireUser();
  if (hasPermission(user.role, "time:log_own")) {
    await assertCanEditWorkPackage(user, input.work_package_id);
    if (input.user_id !== user.id) throw new Error("FORBIDDEN");
  } else {
    await requirePermission("time:log");
  }
  const log = createTimeLog(input);
  revalidateAll();
  return log;
}

export async function deleteTimeLogAction(id: string) {
  const user = await requireUser();
  initFlowStore();
  const log = getFlowStore().timeLogs.find((t) => t.id === id);
  if (hasPermission(user.role, "time:log_own")) {
    if (!log || log.user_id !== user.id) throw new Error("FORBIDDEN");
  } else {
    await requirePermission("work:delete");
  }
  deleteTimeLog(id);
  revalidateAll();
}

export async function createCommentAction(
  workPackageId: string,
  userId: string,
  body: string
) {
  const user = await requireUser();
  await requirePermission("comments:create");
  if (normalizeRole(user.role) === "employee" && userId !== user.id) {
    throw new Error("FORBIDDEN");
  }
  await assertCanEditWorkPackage(user, workPackageId);
  const c = createComment(workPackageId, userId, body);
  revalidateAll();
  return c;
}

export async function deleteCommentAction(id: string) {
  await requirePermission("work:delete");
  deleteComment(id);
  revalidateAll();
}

export async function createFileAction(input: {
  work_package_id: string;
  uploaded_by: string;
  file_name: string;
}) {
  const user = await requireUser();
  await requirePermission("files:create");
  if (normalizeRole(user.role) === "employee" && input.uploaded_by !== user.id) {
    throw new Error("FORBIDDEN");
  }
  await assertCanEditWorkPackage(user, input.work_package_id);
  if (isEmployeeRole(user.role)) {
    await assertWorkEligible(user, "upload_file", { taskId: input.work_package_id });
  }
  const f = createFile(input);
  uploadTaskFile({
    task_id: input.work_package_id,
    user_id: input.uploaded_by,
    file_name: input.file_name,
    file_type: f.mime_type ?? "application/octet-stream",
    file_size: f.file_size ?? 0,
  });
  revalidateAll();
  return f;
}

export async function deleteFileAction(id: string) {
  await requirePermission("work:delete");
  deleteFile(id);
  revalidateAll();
}

export async function resolveCorrectionAction(id: string) {
  const user = await requireUser();
  await requirePermission("corrections:create");
  if (isEmployeeRole(user.role)) {
    initFlowStore();
    const correction = getFlowStore().corrections.find((c) => c.id === id);
    if (correction?.work_package_id) {
      await assertWorkEligible(user, "submit_correction", {
        taskId: correction.work_package_id,
      });
    }
  }
  resolveCorrection(id);
  revalidateAll();
}

export async function duplicateWorkPackageAction(id: string) {
  const user = await requireUser();
  await assertCanEditWorkPackage(user, id);
  if (!hasPermission(user.role, "projects:edit") && !hasPermission(user.role, "work:edit")) {
    throw new Error("FORBIDDEN");
  }
  const copy = duplicateWorkPackage(id);
  if (copy) {
    await writeAuditLog({
      action: "project_changed",
      entityType: "work_package",
      entityId: copy.id,
      summary: `Duplicated work package from ${id}`,
    });
  }
  revalidateAll();
  return copy;
}

export async function bulkUpdateWorkPackagesAction(
  ids: string[],
  updates: Partial<WorkPackage>
) {
  const user = await requireUser();
  if (!ids.length) return;
  for (const id of ids) {
    await assertCanEditWorkPackage(user, id);
    assertEmployeeStatusChange(user, updates);
    if (updates.assigned_to !== undefined) {
      await assertCanAssignWorkPackage(user, updates.assigned_to);
    }
  }
  for (const id of ids) {
    updateWorkPackage(id, updates);
  }
  await writeAuditLog({
    action: "project_changed",
    entityType: "work_package",
    entityId: ids[0] ?? null,
    summary: `Bulk updated ${ids.length} work packages`,
    metadata: { ids, updates: updates as Record<string, unknown> },
  });
  revalidateAll();
}

export async function bulkAssignWorkPackagesAction(ids: string[], assignedTo: string | null) {
  return bulkUpdateWorkPackagesAction(ids, { assigned_to: assignedTo });
}

export async function bulkSubmitQaAction(ids: string[]) {
  const user = await requireUser();
  if (!hasPermission(user.role, "work:submit_qa") && !hasPermission(user.role, "work:edit")) {
    throw new Error("FORBIDDEN");
  }
  for (const id of ids) {
    await assertCanEditWorkPackage(user, id);
    updateWorkPackage(id, { status: "ready_for_qa", qa_status: "pending" });
  }
  await writeAuditLog({
    action: "project_changed",
    entityType: "work_package",
    entityId: ids[0] ?? null,
    summary: `Bulk submitted ${ids.length} packages to QA`,
    metadata: { ids },
  });
  revalidateAll();
}

export async function bulkDeleteWorkPackagesAction(ids: string[]) {
  await requirePermission("work:delete");
  for (const id of ids) deleteWorkPackage(id);
  await writeAuditLog({
    action: "project_changed",
    entityType: "work_package",
    entityId: ids[0] ?? null,
    summary: `Bulk deleted ${ids.length} work packages`,
    metadata: { ids },
  });
  revalidateAll();
}

export async function bulkArchiveManufacturersAction(ids: string[]) {
  await requirePermission("projects:edit");
  for (const id of ids) archiveManufacturer(id);
  revalidateAll();
}
