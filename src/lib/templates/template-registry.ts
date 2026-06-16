import { BUILTIN_ENTERPRISE_TEMPLATES } from "./builtin-templates";
import type {
  EnterpriseProjectTemplate,
  SaveCustomTemplateInput,
} from "./enterprise-types";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

let customProjectTemplates: EnterpriseProjectTemplate[] = [];
let templateUsageRecords: { templateId: string; projectId: string; createdAt: string }[] = [];

export function listEnterpriseTemplates(includeArchived = false): EnterpriseProjectTemplate[] {
  const all = [...BUILTIN_ENTERPRISE_TEMPLATES, ...customProjectTemplates];
  return includeArchived ? all : all.filter((t) => !t.archived);
}

export function getEnterpriseTemplate(id: string): EnterpriseProjectTemplate | null {
  return listEnterpriseTemplates(true).find((t) => t.id === id) ?? null;
}

export function listTemplatesForDepartment(departmentId: string): EnterpriseProjectTemplate[] {
  return listEnterpriseTemplates().filter(
    (t) => t.departmentIds.length === 0 || t.departmentIds.includes(departmentId)
  );
}

export function saveCustomEnterpriseTemplate(
  input: SaveCustomTemplateInput,
  createdBy: string
): EnterpriseProjectTemplate {
  const now = new Date().toISOString();
  const template: EnterpriseProjectTemplate = {
    id: uid("tpl"),
    label: input.label.trim(),
    description: input.description.trim(),
    useCases: input.useCases.filter(Boolean),
    category: input.category.trim() || "Custom",
    projectType: input.projectType.trim() || "custom",
    builtin: false,
    archived: false,
    createdBy,
    createdAt: now,
    updatedAt: now,
    departmentIds: input.departmentIds,
    defaultPriority: input.defaultPriority,
    defaultComplexity: input.defaultComplexity,
    defaultEstimatedDocuments: input.defaultEstimatedDocuments,
    forecastingEnabled: input.forecastingEnabled,
    qaEnabled: input.qaEnabled,
    fileUploadsRequired: input.fileUploadsRequired,
    wrapUpsEnabled: input.wrapUpsEnabled,
    workflowManufacturerName: "Workflow",
    tasks: input.tasks.map((t, i) => ({ ...t, sort_order: t.sort_order ?? i + 1 })),
    metrics: { projectsCreated: 0, lastUsedAt: null },
  };
  customProjectTemplates = [...customProjectTemplates, template];
  return template;
}

export function updateCustomEnterpriseTemplate(
  id: string,
  input: Partial<SaveCustomTemplateInput>
): EnterpriseProjectTemplate | null {
  const idx = customProjectTemplates.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  const prev = customProjectTemplates[idx];
  const updated: EnterpriseProjectTemplate = {
    ...prev,
    ...input,
    label: input.label?.trim() ?? prev.label,
    description: input.description?.trim() ?? prev.description,
    useCases: input.useCases ?? prev.useCases,
    tasks: input.tasks ?? prev.tasks,
    updatedAt: new Date().toISOString(),
  };
  const next = [...customProjectTemplates];
  next[idx] = updated;
  customProjectTemplates = next;
  return updated;
}

export function duplicateEnterpriseTemplate(id: string, createdBy: string): EnterpriseProjectTemplate | null {
  const source = getEnterpriseTemplate(id);
  if (!source) return null;
  return saveCustomEnterpriseTemplate(
    {
      label: `${source.label} (Copy)`,
      description: source.description,
      useCases: [...source.useCases],
      category: source.category,
      projectType: source.projectType,
      departmentIds: [...source.departmentIds],
      defaultPriority: source.defaultPriority,
      defaultComplexity: source.defaultComplexity,
      defaultEstimatedDocuments: source.defaultEstimatedDocuments,
      forecastingEnabled: source.forecastingEnabled,
      qaEnabled: source.qaEnabled,
      fileUploadsRequired: source.fileUploadsRequired,
      wrapUpsEnabled: source.wrapUpsEnabled,
      tasks: source.tasks.map((t) => ({ ...t })),
    },
    createdBy
  );
}

export function archiveEnterpriseTemplate(id: string): boolean {
  if (BUILTIN_ENTERPRISE_TEMPLATES.some((t) => t.id === id)) return false;
  const idx = customProjectTemplates.findIndex((t) => t.id === id);
  if (idx < 0) return false;
  const next = [...customProjectTemplates];
  next[idx] = { ...next[idx], archived: true, updatedAt: new Date().toISOString() };
  customProjectTemplates = next;
  return true;
}

export function recordTemplateUsage(templateId: string, projectId: string) {
  const now = new Date().toISOString();
  templateUsageRecords = [{ templateId, projectId, createdAt: now }, ...templateUsageRecords];

  const idx = customProjectTemplates.findIndex((t) => t.id === templateId);
  if (idx >= 0) {
    const next = [...customProjectTemplates];
    next[idx] = {
      ...next[idx],
      metrics: {
        projectsCreated: next[idx].metrics.projectsCreated + 1,
        lastUsedAt: now,
      },
      updatedAt: now,
    };
    customProjectTemplates = next;
  }
}

export function getTemplateUsageStats(templateId: string) {
  const records = templateUsageRecords.filter((r) => r.templateId === templateId);
  const template = getEnterpriseTemplate(templateId);
  const projectsCreated = template?.builtin
    ? records.length
    : template?.metrics.projectsCreated ?? records.length;
  return {
    projectsCreated,
    lastUsedAt: records[0]?.createdAt ?? template?.metrics.lastUsedAt ?? null,
  };
}

export function getAllTemplateUsageRecords() {
  return templateUsageRecords;
}
