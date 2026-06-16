import type { EnterpriseProjectTemplate } from "./enterprise-types";

export interface EnterpriseTemplatePreview {
  templateName: string;
  departmentLabel: string;
  taskTitles: string[];
  qaIncluded: boolean;
  forecastingIncluded: boolean;
  fileUploadsRequired: boolean;
  workflowSummary: string;
  enabled: string[];
}

export function buildEnterpriseTemplatePreview(
  template: EnterpriseProjectTemplate,
  departmentName: string
): EnterpriseTemplatePreview {
  const sortedTasks = [...template.tasks].sort((a, b) => a.sort_order - b.sort_order);
  const enabled: string[] = [
    "Project record",
    `${sortedTasks.length} workflow tasks`,
    "Status tracking",
    "Reporting structure",
  ];
  if (template.forecastingEnabled) {
    enabled.push("Forecasting settings", "Planning due dates");
  }
  if (template.qaEnabled) enabled.push("QA requirements");
  if (template.fileUploadsRequired) enabled.push("File upload requirements");
  if (template.wrapUpsEnabled) enabled.push("Daily wrap-up tracking");
  enabled.push("Workflow notifications");

  return {
    templateName: template.label,
    departmentLabel: departmentName,
    taskTitles: sortedTasks.map((t) => t.title),
    qaIncluded: template.qaEnabled,
    forecastingIncluded: template.forecastingEnabled,
    fileUploadsRequired: template.fileUploadsRequired,
    workflowSummary: sortedTasks.map((t) => t.title).join(" → "),
    enabled,
  };
}
