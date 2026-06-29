import type { TeamDashboardPack } from "@/lib/team-dashboards/types";

/** Operator-maintained pack for the Advanced Projects team. */
export const ADVANCED_PROJECTS_PACK: TeamDashboardPack = {
  slug: "advanced-projects",
  label: "Advanced Projects",
  description:
    "Programs focused on ADAS, research, and custom advanced deliverables — separate from core Service Information production.",
  eyebrow: "Team operating view",
  projectScope: {
    teamName: "Advanced Projects Team",
    includeTeamProjects: true,
    projectTypes: ["adas", "research", "custom"],
  },
  kpis: [
    { id: "active_programs", label: "Active programs" },
    { id: "avg_health_score", label: "Avg health score", warnWhen: "low" },
    { id: "at_risk_programs", label: "At-risk programs", warnWhen: "high" },
    { id: "open_tasks", label: "Open tasks" },
    { id: "forecasted_late", label: "Forecasted late", warnWhen: "high" },
    { id: "ready_for_qa", label: "Ready for QA" },
    { id: "avg_completion_pct", label: "Avg completion" },
    { id: "avg_capacity_load", label: "Avg capacity load", warnWhen: "high" },
  ],
  showProjectPortfolio: true,
  nav: {
    label: "Advanced Projects",
    icon: "FolderKanban",
    group: "operations",
  },
  access: {
    roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead", "viewer"],
    teamMembers: true,
    teamLeads: true,
  },
};
