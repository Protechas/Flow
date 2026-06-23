"use client";

import { getTemplateMetricDefaults } from "@/lib/metrics/template-metric-defaults";
import type { EnterpriseProjectTemplate } from "@/lib/templates/enterprise-types";

export const PROJECT_GUIDED_STEPS = [
  "Project basics",
  "Department & team",
  "Template",
  "Forecasting",
  "Metrics",
  "QA & files",
  "Review",
] as const;

export function projectMetricsPreview(templateId: string, isEnterprise: boolean): string[] {
  if (!isEnterprise) return getTemplateMetricDefaults(templateId).map((m) => m.metric_name);
  return getTemplateMetricDefaults(templateId).map((m) => m.metric_name);
}

export function projectQaPreview(template: EnterpriseProjectTemplate | null): {
  qaEnabled: boolean;
  fileUploadsRequired: boolean;
  taskCount: number;
  qaTasks: string[];
} {
  if (!template) {
    return { qaEnabled: true, fileUploadsRequired: false, taskCount: 0, qaTasks: [] };
  }
  const qaTasks = template.tasks
    .filter((t) => t.requires_qa || t.title.toLowerCase().includes("qa"))
    .map((t) => t.title);
  return {
    qaEnabled: template.qaEnabled,
    fileUploadsRequired: template.fileUploadsRequired,
    taskCount: template.tasks.length,
    qaTasks,
  };
}
