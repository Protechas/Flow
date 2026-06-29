import type { OperatingModelKpiConfig } from "@/lib/operating-models/types";

export const OPERATING_MODEL_KPI_CATALOG: {
  id: string;
  name: string;
  description: string;
  type: OperatingModelKpiConfig["type"];
  source?: OperatingModelKpiConfig["source"];
  portfolioKey?: string;
  defaultWarnWhen?: "high" | "low";
}[] = [
  { id: "active_programs", name: "Active programs", description: "Programs in scope", type: "count", source: "portfolio", portfolioKey: "activeProjects" },
  { id: "avg_health_score", name: "Avg health score", description: "Program intelligence health", type: "percentage", source: "intelligence", portfolioKey: "avgHealthScore", defaultWarnWhen: "low" },
  { id: "at_risk_programs", name: "At-risk programs", description: "Programs flagged at risk", type: "count", source: "portfolio", portfolioKey: "projectsAtRisk", defaultWarnWhen: "high" },
  { id: "open_tasks", name: "Open tasks", description: "Incomplete work packages", type: "count", source: "portfolio", portfolioKey: "openTasks" },
  { id: "forecasted_late", name: "Forecasted late", description: "Programs projected past due", type: "count", source: "portfolio", portfolioKey: "forecastedLate", defaultWarnWhen: "high" },
  { id: "ready_for_qa", name: "Ready for QA", description: "Work ready for QA review", type: "count", source: "portfolio", portfolioKey: "readyForQa" },
  { id: "avg_completion_pct", name: "Completion %", description: "Mean completion across programs", type: "percentage", source: "portfolio", portfolioKey: "avgCompletionPct", defaultWarnWhen: "low" },
  { id: "avg_capacity_load", name: "Capacity load", description: "Team capacity utilization", type: "percentage", source: "intelligence", portfolioKey: "avgCapacityLoad", defaultWarnWhen: "high" },
  { id: "documents_completed", name: "Documents completed", description: "Documents finished", type: "count", source: "manual" },
  { id: "qa_pass_rate", name: "QA pass rate", description: "QA success rate", type: "percentage", source: "manual", defaultWarnWhen: "low" },
  { id: "correction_rate", name: "Corrections", description: "Correction volume", type: "count", source: "manual", defaultWarnWhen: "high" },
  { id: "records_validated", name: "Records validated", description: "Records tested", type: "count", source: "manual" },
  { id: "accuracy_pct", name: "Accuracy %", description: "Validation accuracy", type: "percentage", source: "manual", defaultWarnWhen: "low" },
  { id: "exceptions_found", name: "Exceptions found", description: "Validation exceptions", type: "count", source: "manual", defaultWarnWhen: "high" },
  { id: "validation_coverage", name: "Validation coverage", description: "Coverage of validation scope", type: "percentage", source: "manual" },
  { id: "features_delivered", name: "Features delivered", description: "Shipped features", type: "count", source: "manual" },
  { id: "bugs_closed", name: "Bugs closed", description: "Resolved defects", type: "count", source: "manual" },
  { id: "hours_saved", name: "Hours saved", description: "Automation time saved", type: "hours", source: "manual" },
  { id: "training_completion", name: "Training completion", description: "Training completion rate", type: "percentage", source: "portfolio", portfolioKey: "avgCompletionPct", defaultWarnWhen: "low" },
  { id: "employees_trained", name: "Employees trained", description: "Headcount trained", type: "count", source: "manual" },
  { id: "forecast_accuracy", name: "Forecast accuracy", description: "Forecast vs actual", type: "percentage", source: "manual" },
  { id: "task_tracking_compliance", name: "Task tracking compliance", description: "Tasks with required fields", type: "percentage", source: "manual", defaultWarnWhen: "low" },
];

export const TRACKING_FIELD_OPTIONS = [
  { value: "documents", label: "Documents" },
  { value: "records", label: "Records" },
  { value: "hours", label: "Hours" },
  { value: "files", label: "Files" },
  { value: "qa", label: "QA" },
  { value: "corrections", label: "Corrections" },
  { value: "accuracy", label: "Accuracy" },
  { value: "features", label: "Features" },
  { value: "bugs", label: "Bugs" },
  { value: "deployments", label: "Deployments" },
  { value: "custom_metric", label: "Custom metric" },
] as const;

export const TASK_TYPE_OPTIONS = [
  "general",
  "deliverable",
  "review",
  "document",
  "correction",
  "feature",
  "bug",
  "deployment",
  "automation",
  "research",
  "validation",
  "exception_review",
  "signoff",
  "lesson",
  "assessment",
  "certification",
] as const;

export function kpiConfigFromCatalog(id: string): OperatingModelKpiConfig {
  const row = OPERATING_MODEL_KPI_CATALOG.find((k) => k.id === id);
  return {
    id,
    name: row?.name ?? id,
    description: row?.description,
    type: row?.type ?? "count",
    source: row?.source,
    portfolioKey: row?.portfolioKey,
    warnWhen: row?.defaultWarnWhen,
    displayLocations: ["team_dashboard"],
  };
}
