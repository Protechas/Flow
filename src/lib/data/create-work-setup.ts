import type { ForecastComplexityLevel, WorkPackage, WorkPriority } from "@/types/flow";
import { defaultPackageTitle } from "@/lib/data/work-assign";
import {
  createManufacturer,
  createProject,
  createWorkPackage,
  createYearWorkItem,
  getFlowStore,
  initFlowStore,
  updateYearWorkItem,
} from "@/lib/data/flow-store";

export interface QuickTaskInput {
  /** Existing project id, or omit when creating a new project */
  projectId?: string | null;
  /** Creates a new active project when projectId is not set */
  newProjectName?: string | null;
  projectType?: string;
  /** Optional project-level document estimate (new projects only) */
  projectDocumentEstimate?: number | null;
  manufacturerName: string;
  year: number;
  taskTitle?: string | null;
  assignedTo?: string | null;
  estimatedDocumentCount?: number | null;
  complexityLevel?: ForecastComplexityLevel;
  projectOwnerId?: string | null;
  priority?: WorkPriority;
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function createQuickTask(input: QuickTaskInput): WorkPackage {
  initFlowStore();
  const mfrName = normalizeName(input.manufacturerName);
  if (!mfrName) throw new Error("Manufacturer name is required");

  let projectId = input.projectId ?? null;
  if (!projectId) {
    const projectName = normalizeName(input.newProjectName ?? "");
    if (!projectName) throw new Error("Project name is required");
    const project = createProject(
      {
        name: projectName,
        description: null,
        project_type: input.projectType ?? "custom",
        status: "active",
        priority: "medium",
        start_date: new Date().toISOString().split("T")[0],
        due_date: null,
        project_owner_id: input.projectOwnerId ?? null,
        estimated_total_documents:
          input.projectDocumentEstimate ?? input.estimatedDocumentCount ?? null,
        planning_complexity_level: input.complexityLevel ?? "standard",
      },
      "custom"
    );
    projectId = project.id;
  }

  const store = getFlowStore();
  let manufacturer = store.manufacturers.find(
    (m) =>
      m.project_id === projectId &&
      !m.is_archived &&
      m.name.toLowerCase() === mfrName.toLowerCase()
  );

  if (!manufacturer) {
    manufacturer = createManufacturer({
      project_id: projectId,
      name: mfrName,
      assigned_to: null,
      status: "not_started",
      priority: "medium",
      due_date: null,
      notes: null,
    });
  }

  let yearItem = store.yearWorkItems.find(
    (y) => y.manufacturer_id === manufacturer!.id && y.year === input.year
  );

  if (!yearItem) {
    yearItem = createYearWorkItem({
      manufacturer_id: manufacturer.id,
      project_id: projectId,
      year: input.year,
      assigned_to: input.assignedTo ?? null,
      status: input.assignedTo ? "assigned" : "not_started",
      priority: "medium",
      due_date: null,
      estimated_hours: 8,
      notes: null,
    });
  } else if (input.assignedTo && yearItem.assigned_to !== input.assignedTo) {
    yearItem =
      updateYearWorkItem(yearItem.id, { assigned_to: input.assignedTo }) ?? yearItem;
  }

  const assignee = input.assignedTo ?? null;
  const title =
    normalizeName(input.taskTitle ?? "") ||
    defaultPackageTitle(yearItem, manufacturer.name);

  return createWorkPackage({
    project_id: projectId,
    manufacturer_id: manufacturer.id,
    year_work_item_id: yearItem.id,
    year: input.year,
    title,
    assigned_to: assignee,
    status: assignee ? "assigned" : "not_started",
    priority: input.priority ?? "medium",
    due_date: null,
    estimated_hours: 8,
    estimated_document_count: input.estimatedDocumentCount ?? null,
    complexity_level: input.complexityLevel ?? "standard",
    notes: null,
  });
}
