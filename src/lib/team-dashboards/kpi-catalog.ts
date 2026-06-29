import type { TeamDashboardKpiConfig, TeamDashboardKpiId } from "@/lib/team-dashboards/types";

export const TEAM_DASHBOARD_KPI_CATALOG: {
  id: TeamDashboardKpiId;
  label: string;
  description: string;
  defaultWarnWhen?: "high" | "low";
}[] = [
  { id: "active_programs", label: "Active programs", description: "Programs in scope that are active" },
  {
    id: "avg_health_score",
    label: "Avg health score",
    description: "Average program intelligence health",
    defaultWarnWhen: "low",
  },
  {
    id: "at_risk_programs",
    label: "At-risk programs",
    description: "Programs flagged at risk or critical",
    defaultWarnWhen: "high",
  },
  { id: "open_tasks", label: "Open tasks", description: "Incomplete work packages in scope" },
  {
    id: "forecasted_late",
    label: "Forecasted late",
    description: "Programs projected past due",
    defaultWarnWhen: "high",
  },
  { id: "ready_for_qa", label: "Ready for QA", description: "Programs with QA-ready work" },
  { id: "avg_completion_pct", label: "Avg completion", description: "Mean completion % across programs" },
  {
    id: "avg_capacity_load",
    label: "Avg capacity load",
    description: "Mean team capacity utilization",
    defaultWarnWhen: "high",
  },
  { id: "team_members", label: "Team members", description: "Active users on the linked team" },
];

export function kpiConfigFromCatalog(id: TeamDashboardKpiId): TeamDashboardKpiConfig {
  const row = TEAM_DASHBOARD_KPI_CATALOG.find((k) => k.id === id);
  return {
    id,
    label: row?.label ?? id,
    warnWhen: row?.defaultWarnWhen,
  };
}
