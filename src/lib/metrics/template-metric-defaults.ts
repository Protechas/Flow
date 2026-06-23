import { seedProjectMetricDefinitions } from "@/lib/metrics/project-metrics-store";
import type { ProjectMetricDefinitionInput } from "@/types/flow";

const RESEARCH_METRICS: ProjectMetricDefinitionInput[] = [
  {
    metric_name: "Requests Completed",
    metric_type: "number",
    display_style: "metric_card",
    is_formula: true,
    formula_definition: { kind: "completion_pct" },
  },
  {
    metric_name: "Investigations Open",
    metric_type: "number",
    display_style: "kpi_tile",
    is_formula: true,
    formula_definition: { kind: "ready_for_qa" },
  },
];

const TRAINING_METRICS: ProjectMetricDefinitionInput[] = [
  {
    metric_name: "Employees Trained",
    metric_type: "number",
    target_value: 20,
    display_style: "target_vs_actual",
    current_value: "0",
  },
  {
    metric_name: "Completion %",
    metric_type: "percentage",
    target_value: 100,
    display_style: "percentage_ring",
    is_formula: true,
    formula_definition: { kind: "completion_pct" },
  },
  {
    metric_name: "Certifications",
    metric_type: "number",
    display_style: "kpi_tile",
    current_value: "0",
  },
];

/** Default custom metrics seeded when creating projects from templates */
export const TEMPLATE_METRIC_DEFAULTS: Record<string, ProjectMetricDefinitionInput[]> = {
  standard_production: [
    {
      metric_name: "Documents Processed",
      metric_type: "number",
      target_value: 500,
      display_style: "target_vs_actual",
      is_formula: true,
      formula_definition: { kind: "documents_processed" },
    },
    {
      metric_name: "Files Uploaded",
      metric_type: "number",
      display_style: "kpi_tile",
      is_formula: true,
      formula_definition: { kind: "files_uploaded" },
    },
    {
      metric_name: "QA Pass Rate",
      metric_type: "percentage",
      target_value: 95,
      display_style: "percentage_ring",
      is_formula: true,
      formula_definition: { kind: "qa_pass_rate" },
    },
    {
      metric_name: "Corrections",
      metric_type: "number",
      display_style: "metric_card",
      is_formula: true,
      formula_definition: { kind: "correction_count" },
    },
    {
      metric_name: "Forecast Confidence",
      metric_type: "percentage",
      target_value: 90,
      display_style: "progress_bar",
      is_formula: true,
      formula_definition: { kind: "forecast_confidence" },
    },
  ],
  audit_validation: [
    {
      metric_name: "Records Tested",
      metric_type: "number",
      target_value: 200,
      display_style: "target_vs_actual",
      current_value: "0",
    },
    {
      metric_name: "Accuracy %",
      metric_type: "percentage",
      target_value: 98,
      display_style: "percentage_ring",
      is_formula: true,
      formula_definition: { kind: "qa_pass_rate" },
    },
    {
      metric_name: "Validation Coverage",
      metric_type: "percentage",
      target_value: 100,
      display_style: "progress_bar",
      is_formula: true,
      formula_definition: { kind: "completion_pct" },
    },
    {
      metric_name: "Exceptions Found",
      metric_type: "number",
      display_style: "metric_card",
      is_formula: true,
      formula_definition: { kind: "correction_count" },
    },
  ],
  si_corrections: [
    {
      metric_name: "Documents Processed",
      metric_type: "number",
      target_value: 500,
      display_style: "target_vs_actual",
      is_formula: true,
      formula_definition: { kind: "documents_processed" },
    },
    {
      metric_name: "QA Pass Rate",
      metric_type: "percentage",
      target_value: 97,
      display_style: "percentage_ring",
      is_formula: true,
      formula_definition: { kind: "qa_pass_rate" },
    },
    {
      metric_name: "Corrections",
      metric_type: "number",
      display_style: "kpi_tile",
      is_formula: true,
      formula_definition: { kind: "correction_count" },
    },
  ],
  research: RESEARCH_METRICS,
  research_investigation: RESEARCH_METRICS,
  training: TRAINING_METRICS,
  training_onboarding: TRAINING_METRICS,
  corrective_action: [
    {
      metric_name: "Documents Processed",
      metric_type: "number",
      display_style: "target_vs_actual",
      is_formula: true,
      formula_definition: { kind: "documents_processed" },
    },
    {
      metric_name: "QA Pass Rate",
      metric_type: "percentage",
      display_style: "percentage_ring",
      is_formula: true,
      formula_definition: { kind: "qa_pass_rate" },
    },
  ],
  advanced_projects: [
    {
      metric_name: "Features Delivered",
      metric_type: "number",
      target_value: 12,
      display_style: "target_vs_actual",
      is_formula: true,
      formula_definition: { kind: "completion_pct" },
    },
    {
      metric_name: "Bugs Closed",
      metric_type: "number",
      display_style: "metric_card",
      is_formula: true,
      formula_definition: { kind: "correction_count" },
    },
    {
      metric_name: "Deployments",
      metric_type: "number",
      display_style: "kpi_tile",
      current_value: "0",
    },
    {
      metric_name: "Adoption %",
      metric_type: "percentage",
      target_value: 80,
      display_style: "percentage_ring",
      current_value: "0",
    },
  ],
};

export function getTemplateMetricDefaults(templateId: string): ProjectMetricDefinitionInput[] {
  return TEMPLATE_METRIC_DEFAULTS[templateId] ?? [];
}

export function getLegacyTemplateMetricDefaults(templateId: string): ProjectMetricDefinitionInput[] {
  if (templateId === "sf_phase_1") return TEMPLATE_METRIC_DEFAULTS.si_corrections;
  return TEMPLATE_METRIC_DEFAULTS.standard_production;
}

export function seedMetricsForProject(projectId: string, templateId: string): void {
  const defaults =
    getTemplateMetricDefaults(templateId).length > 0
      ? getTemplateMetricDefaults(templateId)
      : getLegacyTemplateMetricDefaults(templateId);
  if (defaults.length) seedProjectMetricDefinitions(projectId, defaults);
}
