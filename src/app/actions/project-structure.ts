"use server";

import { appTodayDate } from "@/lib/datetime/timezone";
import { requirePermission } from "@/lib/auth/session";
import { normalizeRole } from "@/lib/auth/permissions";
import { revalidateWorkSurfaces } from "@/lib/data/revalidate-work";
import {
  bulkCreateYears,
  createManufacturer,
  createProject,
  createWorkPackage,
  createYearWorkItem,
  getFlowStore,
} from "@/lib/data/flow-store";
import { persistNewProject } from "@/lib/data/projects-db";
import {
  persistManufacturerChange,
  persistWorkStructureForProject,
  persistYearWorkItemDb,
  persistWorkPackageDb,
} from "@/lib/data/work-items-db";
import { seedMetricsForProject } from "@/lib/metrics/template-metric-defaults";
import { writeAuditLog } from "@/lib/audit/audit-log";
import type { ProjectTemplateId } from "@/lib/templates/project-templates";
import { PROJECT_TEMPLATES } from "@/lib/templates/project-templates";
import type { WorkStructureMode } from "@/lib/work-packages/smart-labels";
import {
  phaseLabelToYear,
  type ProjectCreationDraft,
  type TaskDraft,
} from "@/lib/work-creation/project-structure-types";
import { resolveTasksForPackage } from "@/lib/work-creation/resolve-package-tasks";
import type { ForecastComplexityLevel, WorkPriority, YearWorkItem } from "@/types/flow";

function revalidateAll(projectId?: string) {
  revalidateWorkSurfaces(projectId);
}

function taskNotes(task: TaskDraft): string | null {
  const flags: string[] = [];
  if (task.qaRequired) flags.push("QA required");
  if (task.filesRequired) flags.push("Files required");
  const parts = [task.notes?.trim() || null, flags.length ? flags.join(" · ") : null].filter(
    Boolean
  );
  return parts.length ? parts.join("\n") : null;
}

export async function createProjectWithStructureAction(draft: {
  name: string;
  departmentId: string;
  teamId: string;
  ownerId?: string | null;
  projectType: string;
  templateId?: ProjectTemplateId;
  enterpriseTemplateId?: string | null;
  structureMode: WorkStructureMode;
  description?: string | null;
  priority?: WorkPriority;
  complexity?: ForecastComplexityLevel;
  manualDueDate?: string | null;
  estimatedDocuments?: number | null;
  estimatedHours?: number | null;
  trackingNotes?: string | null;
  qaRequired?: boolean;
  filesRequired?: boolean;
  packages: Array<{
    name: string;
    phases: Array<{ label: string }>;
    tasks: TaskDraft[];
    taskSetupMode: "manual" | "template" | "copy";
    copyFromPackageId?: string | null;
  }>;
}) {
  const user = await requirePermission("projects:create");
  const name = draft.name.trim();
  if (!name) throw new Error("Project name is required.");
  if (!draft.departmentId?.trim()) throw new Error("Select a department.");
  if (!draft.teamId?.trim()) throw new Error("Select a team.");

  const ownerId =
    draft.ownerId && draft.ownerId !== "__none__"
      ? draft.ownerId
      : normalizeRole(user.role) === "teamlead"
        ? user.id
        : null;

  const tplId = draft.templateId ?? "custom";
  const tplMeta = PROJECT_TEMPLATES.find((t) => t.id === tplId);
  const trackingParts = [
    draft.trackingNotes?.trim() || null,
    draft.structureMode ? `Structure: ${draft.structureMode.replace(/_/g, " ")}` : null,
  ].filter(Boolean);

  const project = createProject(
    {
      name,
      description: [draft.description?.trim(), ...trackingParts].filter(Boolean).join(" · ") || null,
      project_type: draft.projectType || tplMeta?.projectType || "custom",
      structure_mode: draft.structureMode,
      status: "active",
      priority: draft.priority ?? "medium",
      start_date: appTodayDate(),
      due_date: draft.manualDueDate ?? null,
      manual_project_due_date: draft.manualDueDate ?? null,
      department_id: draft.departmentId,
      team_id: draft.teamId,
      project_owner_id: ownerId,
      created_by: user.id,
      estimated_total_documents: draft.estimatedDocuments ?? null,
      planning_complexity_level: draft.complexity ?? "standard",
    },
    "custom"
  );

  if (tplId !== "custom") {
    seedMetricsForProject(project.id, tplId);
  }

  let packagesToCreate = draft.packages.filter((p) => p.name.trim());

  if (packagesToCreate.length === 0 && draft.structureMode === "simple_task_list") {
    packagesToCreate = [{ name: "General", phases: [{ label: String(new Date().getFullYear()) }], tasks: [], taskSetupMode: "manual" as const }];
  }

  if (packagesToCreate.length === 0 && tplMeta?.manufacturers?.length) {
    packagesToCreate = tplMeta.manufacturers.map((mfrName) => ({
      name: mfrName,
      phases: (tplMeta.years ?? [new Date().getFullYear()]).map((y) => ({ label: String(y) })),
      tasks: [],
      taskSetupMode: "manual" as const,
    }));
  }

  const fullDraft: ProjectCreationDraft = {
    name,
    departmentId: draft.departmentId,
    teamId: draft.teamId,
    ownerId: ownerId ?? "__none__",
    projectType: project.project_type,
    templateId: tplId,
    enterpriseTemplateId: draft.enterpriseTemplateId ?? "",
    structureMode: draft.structureMode,
    description: draft.description ?? "",
    priority: draft.priority ?? "medium",
    complexity: draft.complexity ?? "standard",
    manualDueDate: draft.manualDueDate ?? "",
    packages: packagesToCreate.map((p, i) => ({
      id: `pkg-${i}`,
      name: p.name,
      phases: p.phases,
      tasks: p.tasks,
      taskSetupMode: p.taskSetupMode,
      copyFromPackageId: p.copyFromPackageId,
    })),
    tracking: {
      estimatedDocuments: String(draft.estimatedDocuments ?? ""),
      estimatedHours: String(draft.estimatedHours ?? ""),
      qaRequired: draft.qaRequired ?? true,
      filesRequired: draft.filesRequired ?? false,
      dailyTracking: false,
      customMetrics: [],
    },
  };

  for (const pkg of packagesToCreate) {
    const mfr = createManufacturer({
      project_id: project.id,
      name: pkg.name.trim(),
      assigned_to: null,
      status: "not_started",
      priority: draft.priority ?? "medium",
      due_date: null,
      notes: null,
    });
    await persistManufacturerChange(mfr);

    const phases = pkg.phases.length > 0 ? pkg.phases : [{ label: String(new Date().getFullYear()) }];
    const tasks = resolveTasksForPackage(
      {
        id: "",
        name: pkg.name,
        phases: pkg.phases,
        tasks: pkg.tasks,
        taskSetupMode: pkg.taskSetupMode,
        copyFromPackageId: pkg.copyFromPackageId,
      },
      fullDraft
    );

    const yearItems: YearWorkItem[] = [];
    for (let i = 0; i < phases.length; i++) {
      const year = phaseLabelToYear(phases[i].label, i);
      const existing = getFlowStore().yearWorkItems.find(
        (y) => y.manufacturer_id === mfr.id && y.year === year
      );
      if (existing) {
        yearItems.push(existing);
        continue;
      }
      const yearItem = createYearWorkItem({
        manufacturer_id: mfr.id,
        project_id: project.id,
        year,
        assigned_to: null,
        status: "not_started",
        priority: draft.priority ?? "medium",
        due_date: null,
        estimated_hours: draft.estimatedHours ?? 8,
        notes: phases[i].label.trim() !== String(year) ? phases[i].label : null,
      });
      await persistYearWorkItemDb(yearItem);
      yearItems.push(yearItem);
    }

    const targetYear = yearItems[0];
    if (targetYear && tasks.length > 0) {
      for (const task of tasks) {
        const title = task.title.trim();
        if (!title) continue;
        const wp = createWorkPackage({
          project_id: project.id,
          manufacturer_id: mfr.id,
          year_work_item_id: targetYear.id,
          year: targetYear.year,
          title,
          assigned_to: task.assigneeId ?? null,
          status: task.assigneeId ? "assigned" : "not_started",
          priority: task.priority ?? draft.priority ?? "medium",
          due_date: task.dueDate ?? null,
          manual_due_date: task.dueDate ?? null,
          estimated_hours: 8,
          estimated_document_count: task.estimatedDocuments ?? null,
          complexity_level: draft.complexity ?? "standard",
          qa_required: task.qaRequired ?? draft.qaRequired ?? true,
          files_required: task.filesRequired ?? draft.filesRequired ?? false,
          notes: taskNotes(task),
        });
        await persistWorkPackageDb(wp);
      }
    } else if (tplMeta?.years?.length && tasks.length === 0 && pkg.taskSetupMode === "manual") {
      const extraYears = tplMeta.years.filter(
        (y) => !yearItems.some((yi) => yi.year === y)
      );
      if (extraYears.length) {
        bulkCreateYears(mfr.id, project.id, extraYears);
        const store = getFlowStore();
        for (const year of store.yearWorkItems.filter((y) => y.manufacturer_id === mfr.id)) {
          await persistYearWorkItemDb(year);
        }
      }
    }
  }

  await persistNewProject(project);
  await persistWorkStructureForProject(project.id);

  await writeAuditLog({
    action: "project_changed",
    entityType: "project",
    entityId: project.id,
    summary: `Created project ${project.name} with work structure`,
    metadata: {
      structure_mode: draft.structureMode,
      packages: packagesToCreate.length,
      template: tplId,
    },
  });

  revalidateAll(project.id);
  return project;
}

export async function bulkCreateWorkPackagesAction(input: {
  projectId: string;
  names: string[];
  years?: number[];
}) {
  await requirePermission("projects:edit");
  const names = input.names.map((n) => n.trim()).filter(Boolean);
  if (!names.length) throw new Error("Add at least one work package name.");
  if (!input.projectId) throw new Error("Project is required.");

  const years = input.years?.length
    ? input.years
    : [new Date().getFullYear(), new Date().getFullYear() + 1];

  const created = [];
  for (const name of names) {
    const mfr = createManufacturer({
      project_id: input.projectId,
      name,
      assigned_to: null,
      status: "not_started",
      priority: "medium",
      due_date: null,
      notes: null,
    });
    await persistManufacturerChange(mfr);
    bulkCreateYears(mfr.id, input.projectId, years);
    const store = getFlowStore();
    for (const year of store.yearWorkItems.filter((y) => y.manufacturer_id === mfr.id)) {
      await persistYearWorkItemDb(year);
    }
    created.push(mfr);
  }

  await writeAuditLog({
    action: "project_changed",
    entityType: "project",
    entityId: input.projectId,
    summary: `Bulk added ${created.length} work package(s)`,
  });

  revalidateAll(input.projectId);
  return created;
}
