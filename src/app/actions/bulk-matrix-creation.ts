"use server";

import { appTodayDate } from "@/lib/datetime/timezone";
import { requirePermission } from "@/lib/auth/session";
import { normalizeRole } from "@/lib/auth/permissions";
import { revalidateWorkSurfaces } from "@/lib/data/revalidate-work";
import {
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
import {
  generateMatrixRows,
  type GeneratedMatrixRow,
} from "@/lib/work-creation/bulk-matrix-generator";
import type { BulkMatrixDraft } from "@/lib/work-creation/bulk-matrix-types";
import type { ProjectTemplateId } from "@/lib/templates/project-templates";
import type { ForecastComplexityLevel, WorkPriority } from "@/types/flow";
import {
  defaultStructureModeForProjectType,
  type WorkStructureMode,
} from "@/lib/work-packages/smart-labels";

function revalidateAll(projectId?: string) {
  revalidateWorkSurfaces(projectId);
}

function taskNotes(qaRequired: boolean, filesRequired: boolean): string | null {
  const flags: string[] = [];
  if (qaRequired) flags.push("QA required");
  if (filesRequired) flags.push("Files required");
  return flags.length ? flags.join(" · ") : null;
}

export async function createBulkMatrixProjectAction(input: {
  name: string;
  departmentId: string;
  teamId: string;
  ownerId?: string | null;
  projectType: string;
  templateId?: ProjectTemplateId;
  description?: string | null;
  priority?: WorkPriority;
  complexity?: ForecastComplexityLevel;
  manualDueDate?: string | null;
  matrixOrder: BulkMatrixDraft["matrixOrder"];
  selectedMakes: string[];
  selectedYears: number[];
  models: string[];
  useModelCount: boolean;
  modelCountPerGroup: number;
  docsPerTask: number;
  forecastUnit?: string | null;
  minutesPerUnit?: number | null;
  qaRequired: boolean;
  filesRequired: boolean;
  dailyTracking?: boolean;
}) {
  const user = await requirePermission("projects:create");
  const name = input.name.trim();
  if (!name) throw new Error("Project name is required.");
  if (!input.departmentId?.trim()) throw new Error("Select a department.");
  if (!input.teamId?.trim()) throw new Error("Select a team.");
  if (!input.selectedMakes.length) throw new Error("Select at least one make.");
  if (!input.selectedYears.length) throw new Error("Select at least one year.");

  const draft: BulkMatrixDraft = {
    name,
    departmentId: input.departmentId,
    teamId: input.teamId,
    ownerId: input.ownerId ?? "__none__",
    projectType: input.projectType,
    templateId: input.templateId ?? "custom",
    description: input.description ?? "",
    priority: input.priority ?? "medium",
    complexity: input.complexity ?? "standard",
    manualDueDate: input.manualDueDate ?? "",
    matrixOrder: input.matrixOrder,
    selectedMakes: input.selectedMakes,
    selectedYears: input.selectedYears,
    models: input.models,
    useModelCount: input.useModelCount,
    modelCountPerGroup: input.modelCountPerGroup,
    docsPerTask: input.docsPerTask,
    qaRequired: input.qaRequired,
    filesRequired: input.filesRequired,
    dailyTracking: input.dailyTracking ?? false,
  };

  const rows = generateMatrixRows(draft);
  if (!rows.length) throw new Error("No work items to create. Check makes, years, and models.");

  const ownerId =
    input.ownerId && input.ownerId !== "__none__"
      ? input.ownerId
      : normalizeRole(user.role) === "teamlead"
        ? user.id
        : null;

  const trackingParts = [
    input.dailyTracking ? "Daily tracking" : null,
    `Matrix: ${input.matrixOrder.replace(/_/g, " ")}`,
    `${rows.length} generated tasks`,
  ].filter(Boolean);

  const structureMode: WorkStructureMode =
    input.projectType === "special_functions" || input.projectType === "si_corrections"
      ? "by_manufacturer"
      : defaultStructureModeForProjectType(input.projectType);

  const project = createProject(
    {
      name,
      description: [input.description?.trim(), ...trackingParts].filter(Boolean).join(" · ") || null,
      project_type: input.projectType,
      structure_mode: structureMode,
      status: "active",
      priority: input.priority ?? "medium",
      start_date: appTodayDate(),
      due_date: input.manualDueDate ?? null,
      manual_project_due_date: input.manualDueDate ?? null,
      department_id: input.departmentId,
      team_id: input.teamId,
      project_owner_id: ownerId,
      created_by: user.id,
      estimated_total_documents: rows.length * Math.max(0, input.docsPerTask || 0),
      planning_complexity_level: input.complexity ?? "standard",
    },
    "custom"
  );

  const tplId = input.templateId ?? "custom";
  if (tplId !== "custom") {
    seedMetricsForProject(project.id, tplId);
  }

  // The project row must exist in the DB before any manufacturer/year/task
  // references it — otherwise the per-row persists below trip the
  // manufacturers_project_id_fkey foreign key. (No-op in demo mode.)
  await persistNewProject(project);

  const mfrCache = new Map<string, string>();
  const yearCache = new Map<string, string>();

  async function ensureManufacturer(row: GeneratedMatrixRow) {
    const key = row.manufacturerName;
    if (mfrCache.has(key)) return mfrCache.get(key)!;
    const existing = getFlowStore().manufacturers.find(
      (m) =>
        m.project_id === project.id &&
        !m.is_archived &&
        m.name.toLowerCase() === key.toLowerCase()
    );
    if (existing) {
      mfrCache.set(key, existing.id);
      return existing.id;
    }
    const mfr = createManufacturer({
      project_id: project.id,
      name: key,
      assigned_to: null,
      status: "not_started",
      priority: input.priority ?? "medium",
      due_date: null,
      notes: `Bulk matrix · ${input.matrixOrder}`,
    });
    await persistManufacturerChange(mfr);
    mfrCache.set(key, mfr.id);
    return mfr.id;
  }

  async function ensureYear(mfrId: string, row: GeneratedMatrixRow) {
    const cacheKey = `${mfrId}::${row.year}`;
    if (yearCache.has(cacheKey)) return yearCache.get(cacheKey)!;
    const existing = getFlowStore().yearWorkItems.find(
      (y) => y.manufacturer_id === mfrId && y.year === row.year
    );
    if (existing) {
      yearCache.set(cacheKey, existing.id);
      return existing.id;
    }
    const yearItem = createYearWorkItem({
      manufacturer_id: mfrId,
      project_id: project.id,
      year: row.year,
      assigned_to: null,
      status: "not_started",
      priority: input.priority ?? "medium",
      due_date: null,
      estimated_hours: 8,
      notes: null,
    });
    await persistYearWorkItemDb(yearItem);
    yearCache.set(cacheKey, yearItem.id);
    return yearItem.id;
  }

  const notes = taskNotes(input.qaRequired, input.filesRequired);
  const unitCount = input.docsPerTask > 0 ? input.docsPerTask : null;
  const minutesPerUnit =
    input.minutesPerUnit && input.minutesPerUnit > 0 ? input.minutesPerUnit : null;
  const forecastUnit = input.forecastUnit?.trim() || null;
  // Estimated hours: derive from units × minutes-per-unit when given, else the
  // old flat 8h fallback.
  const estimatedHours =
    unitCount && minutesPerUnit
      ? Math.max(0.25, Math.round((unitCount * minutesPerUnit) / 6) / 10)
      : 8;

  for (const row of rows) {
    const mfrId = await ensureManufacturer(row);
    const yearId = await ensureYear(mfrId, row);
    const wp = createWorkPackage({
      project_id: project.id,
      manufacturer_id: mfrId,
      year_work_item_id: yearId,
      year: row.year,
      title: row.taskTitle,
      assigned_to: null,
      status: "not_started",
      priority: input.priority ?? "medium",
      due_date: null,
      estimated_hours: estimatedHours,
      estimated_document_count: unitCount,
      estimated_minutes_per_document: minutesPerUnit,
      forecast_unit: forecastUnit,
      complexity_level: input.complexity ?? "standard",
      qa_required: input.qaRequired,
      files_required: input.filesRequired,
      notes,
    });
    await persistWorkPackageDb(wp);
  }

  await persistWorkStructureForProject(project.id);

  await writeAuditLog({
    action: "project_changed",
    entityType: "project",
    entityId: project.id,
    summary: `Created bulk matrix project ${project.name}`,
    metadata: {
      matrix_order: input.matrixOrder,
      tasks: rows.length,
      makes: input.selectedMakes.length,
      years: input.selectedYears.length,
    },
  });

  revalidateAll(project.id);
  return { project, taskCount: rows.length };
}
