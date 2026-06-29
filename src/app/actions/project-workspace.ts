"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { requirePermission } from "@/lib/auth/session";
import { normalizeRole } from "@/lib/auth/permissions";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { revalidateWorkSurfaces } from "@/lib/data/revalidate-work";
import {
  createManufacturer,
  createProject,
  createWorkPackage,
  createYearWorkItem,
  getFlowStore,
  updateProject,
} from "@/lib/data/flow-store";
import { persistNewProject, persistProjectUpdate } from "@/lib/data/projects-db";
import {
  persistManufacturerChange,
  persistWorkPackageDb,
  persistWorkStructureForProject,
  persistYearWorkItemDb,
} from "@/lib/data/work-items-db";
import { seedMetricsForProject } from "@/lib/metrics/template-metric-defaults";
import { mergeProjectDescription } from "@/lib/projects/workspace-config";
import { getWorkspaceTemplate } from "@/lib/projects/workspace-templates";
import type { ProjectTrackingFlags, ProjectWorkspaceConfig, WorkspaceColumnDef } from "@/lib/projects/workspace-types";
import type { WorkPriority } from "@/types/flow";

function revalidateProject(projectId: string) {
  revalidateWorkSurfaces(projectId);
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
}

async function createSectionStructure(
  projectId: string,
  sectionName: string,
  priority: WorkPriority
) {
  const mfr = createManufacturer({
    project_id: projectId,
    name: sectionName.trim(),
    assigned_to: null,
    status: "not_started",
    priority,
    due_date: null,
    notes: null,
  });
  await persistManufacturerChange(mfr);

  const year = new Date().getFullYear();
  const yearItem = createYearWorkItem({
    manufacturer_id: mfr.id,
    project_id: projectId,
    year,
    assigned_to: null,
    status: "not_started",
    priority,
    due_date: null,
    estimated_hours: 8,
    notes: "Tasks",
  });
  await persistYearWorkItemDb(yearItem);
  return { sectionId: mfr.id, yearWorkItemId: yearItem.id };
}

export async function createProjectFromWizardAction(input: {
  name: string;
  departmentId: string;
  teamId: string;
  ownerId?: string | null;
  priority?: WorkPriority;
  dueDate?: string | null;
  description?: string | null;
  templateId: string;
  tracking: ProjectTrackingFlags;
}) {
  const user = await requirePermission("projects:create");
  await ensureAppDataLoaded();
  const name = input.name.trim();
  if (!name) throw new Error("Project name is required.");
  if (!input.departmentId?.trim()) throw new Error("Select a department.");
  if (!input.teamId?.trim()) throw new Error("Select a team.");

  const template = getWorkspaceTemplate(input.templateId);
  const ownerId =
    input.ownerId && input.ownerId !== "__none__"
      ? input.ownerId
      : normalizeRole(user.role) === "teamlead"
        ? user.id
        : null;

  const config: ProjectWorkspaceConfig = {
    version: 1,
    templateId: template.id,
    tracking: input.tracking,
    columns: template.columns.map((c) => ({ ...c })),
  };

  const project = createProject({
    name,
    description: mergeProjectDescription(input.description, config),
    project_type: template.projectType,
    structure_mode: "custom",
    status: "active",
    priority: input.priority ?? "medium",
    start_date: new Date().toISOString().split("T")[0],
    due_date: input.dueDate ?? null,
    manual_project_due_date: input.dueDate ?? null,
    department_id: input.departmentId,
    team_id: input.teamId,
    project_owner_id: ownerId,
    created_by: user.id,
    estimated_total_documents: null,
    planning_complexity_level: "standard",
  });

  if (template.projectType === "special_functions" || template.id === "service-information") {
    seedMetricsForProject(project.id, "si_corrections");
  } else if (input.tracking.customMetrics) {
    seedMetricsForProject(project.id, "custom");
  }

  const sections = template.sections.length > 0 ? template.sections : ["General"];
  for (const section of sections) {
    await createSectionStructure(project.id, section, input.priority ?? "medium");
  }

  await persistNewProject(project);
  await persistWorkStructureForProject(project.id);

  writeAuditLog({
    actorId: user.id,
    action: "project_changed",
    entityType: "project",
    entityId: project.id,
    summary: `Created project ${project.name}`,
    metadata: { templateId: template.id, workspace: true },
  });

  revalidateProject(project.id);
  redirect(`/projects/${project.id}`);
}

export async function addWorkspaceSectionAction(projectId: string, name: string) {
  await requirePermission("projects:edit");
  await ensureAppDataLoaded();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Section name is required.");

  const project = getFlowStore().projects.find((p) => p.id === projectId);
  if (!project) throw new Error("Project not found.");

  await createSectionStructure(projectId, trimmed, project.priority);
  revalidateProject(projectId);
  return { ok: true as const };
}

export async function createWorkspaceTaskAction(input: {
  projectId: string;
  sectionId: string;
  title: string;
  assignedTo?: string | null;
  priority?: WorkPriority;
  dueDate?: string | null;
  qaRequired?: boolean;
  filesRequired?: boolean;
}) {
  await requirePermission("projects:edit");
  await ensureAppDataLoaded();
  const title = input.title.trim();
  if (!title) throw new Error("Task title is required.");

  const store = getFlowStore();
  const yearItem =
    store.yearWorkItems.find((y) => y.manufacturer_id === input.sectionId && y.project_id === input.projectId) ??
    store.yearWorkItems.find((y) => y.manufacturer_id === input.sectionId);

  if (!yearItem) throw new Error("Section not found.");

  const project = store.projects.find((p) => p.id === input.projectId);
  const pkg = createWorkPackage({
    project_id: input.projectId,
    manufacturer_id: input.sectionId,
    year_work_item_id: yearItem.id,
    year: yearItem.year,
    department_id: project?.department_id ?? null,
    title,
    assigned_to: input.assignedTo ?? null,
    status: "not_started",
    priority: input.priority ?? project?.priority ?? "medium",
    due_date: input.dueDate ?? null,
    estimated_hours: 8,
    estimated_document_count: null,
    qa_required: input.qaRequired ?? true,
    files_required: input.filesRequired ?? false,
    notes: null,
  });

  await persistWorkPackageDb(pkg);
  revalidateProject(input.projectId);
  return { ok: true as const, taskId: pkg.id };
}

export async function updateProjectWorkspaceColumnsAction(
  projectId: string,
  columns: WorkspaceColumnDef[]
) {
  await requirePermission("projects:edit");
  await ensureAppDataLoaded();
  const store = getFlowStore();
  const project = store.projects.find((p) => p.id === projectId);
  if (!project) throw new Error("Project not found.");

  const { getProjectWorkspaceConfig, stripWorkspaceConfig } = await import(
    "@/lib/projects/workspace-config"
  );
  const config = getProjectWorkspaceConfig(project, store.manufacturers.filter((m) => m.project_id === projectId));
  const userDescription = stripWorkspaceConfig(project.description);
  const updated = updateProject(projectId, {
    description: mergeProjectDescription(userDescription, { ...config, columns }),
  });
  if (updated) await persistProjectUpdate(projectId, { description: updated.description });
  revalidateProject(projectId);
  return { ok: true as const };
}
