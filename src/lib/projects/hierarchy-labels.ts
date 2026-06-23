/** User-facing hierarchy labels — backend types unchanged. */
export const HIERARCHY_LABELS = {
  workstream: "Manufacturer / Workstream",
  workstreamShort: "Workstream",
  workstreamPlural: "Workstreams",
  /** Legacy data model name kept in code as manufacturer */
  manufacturer: "Manufacturer / Workstream",
  manufacturerPlural: "Manufacturers / Workstreams",
  phase: "Year / Phase",
  phaseShort: "Phase",
  phasePlural: "Years / Phases",
  year: "Year / Phase",
  yearPlural: "Years / Phases",
  task: "Task",
  taskPlural: "Tasks",
} as const;

export const RISK_LABELS: Record<string, string> = {
  on_track: "On Track",
  at_risk: "At Risk",
  behind_capacity: "Critical",
  needs_review: "Monitor",
  no_forecast: "No Forecast",
};

export function businessRiskLabel(status: string | null | undefined): string {
  if (!status) return "No Forecast";
  return RISK_LABELS[status] ?? status.replace(/_/g, " ");
}
