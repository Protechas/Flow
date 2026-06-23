import {
  bulkCreateYears,
  createManufacturer,
  createProject,
  createWorkPackage,
  createYearWorkItem,
  initFlowStore,
} from "@/lib/data/flow-store";
import type { Project } from "@/types/flow";
import type { CreateProjectFromTemplateInput, EnterpriseProjectTemplate } from "./enterprise-types";
import { getEnterpriseTemplate, recordTemplateUsage } from "./template-registry";
import { seedMetricsForProject } from "@/lib/metrics/template-metric-defaults";

function taskNotes(task: EnterpriseProjectTemplate["tasks"][0]): string | null {
  const flags: string[] = [];
  if (task.requires_qa) flags.push("QA required");
  if (task.requires_files) flags.push("File uploads required");
  const parts = [task.description, flags.length ? flags.join(" · ") : null].filter(Boolean);
  return parts.length ? parts.join("\n") : null;
}

export function generateProjectFromTemplate(
  input: CreateProjectFromTemplateInput,
  template: EnterpriseProjectTemplate,
  ownerId: string | null
): Project {
  initFlowStore();
  const descParts = [
    input.boardName ? `Board: ${input.boardName}` : null,
    input.description?.trim() || null,
    `Template: ${template.label}`,
    template.qaEnabled ? "QA pipeline enabled" : null,
    template.forecastingEnabled ? "Forecasting enabled" : null,
  ].filter(Boolean);

  const project = createProject(
    {
      name: input.name.trim(),
      description: descParts.length ? descParts.join(" · ") : template.description,
      project_type: template.projectType,
      status: "active",
      priority: template.defaultPriority,
      start_date: new Date().toISOString().split("T")[0],
      due_date: null,
      department_id: input.departmentId,
      team_id: input.teamId,
      project_owner_id: ownerId,
      estimated_total_documents: template.defaultEstimatedDocuments ?? null,
      planning_complexity_level: template.defaultComplexity,
    },
    "custom"
  );

  const mfr = createManufacturer({
    project_id: project.id,
    name: template.workflowManufacturerName,
    assigned_to: null,
    status: "not_started",
    priority: template.defaultPriority,
    due_date: null,
    notes: `Generated from template: ${template.label}`,
  });

  const year = new Date().getFullYear();
  const yearItem = createYearWorkItem({
    manufacturer_id: mfr.id,
    project_id: project.id,
    year,
    assigned_to: null,
    status: "not_started",
    priority: template.defaultPriority,
    due_date: null,
    estimated_hours: template.tasks.reduce((s, t) => s + (t.estimated_hours ?? 0), 0),
    notes: null,
  });

  const sortedTasks = [...template.tasks].sort((a, b) => a.sort_order - b.sort_order);
  for (const taskTpl of sortedTasks) {
    createWorkPackage({
      project_id: project.id,
      manufacturer_id: mfr.id,
      year_work_item_id: yearItem.id,
      year,
      department_id: input.departmentId,
      title: taskTpl.title,
      notes: taskNotes(taskTpl),
      description: taskTpl.description ?? null,
      assigned_to: null,
      status: taskTpl.status,
      priority: taskTpl.priority,
      due_date: null,
      start_date: new Date().toISOString().split("T")[0],
      estimated_hours: taskTpl.estimated_hours ?? 4,
      estimated_document_count: template.forecastingEnabled
        ? taskTpl.estimated_document_count ?? 10
        : null,
      complexity_level: template.forecastingEnabled
        ? taskTpl.complexity_level ?? template.defaultComplexity
        : "standard",
    });
  }

  recordTemplateUsage(template.id, project.id);
  seedMetricsForProject(project.id, template.id);
  return project;
}

export function createProjectFromEnterpriseTemplate(
  input: CreateProjectFromTemplateInput,
  ownerId: string | null
): Project {
  const template = getEnterpriseTemplate(input.templateId);
  if (!template || template.archived) {
    throw new Error("TEMPLATE_NOT_FOUND");
  }
  if (
    template.departmentIds.length > 0 &&
    !template.departmentIds.includes(input.departmentId)
  ) {
    throw new Error("TEMPLATE_DEPARTMENT_MISMATCH");
  }
  return generateProjectFromTemplate(input, template, ownerId);
}
