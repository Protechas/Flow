import type { NavGroupId } from "@/lib/auth/permissions";
import type { TeamDashboardKpiId, TeamDashboardPack } from "@/lib/team-dashboards/types";
import type { UserRole } from "@/types/flow";

export type TeamDashboardPackInput = {
  slug: string;
  label: string;
  description: string;
  eyebrow?: string;
  teamId?: string;
  teamName?: string;
  includeTeamProjects: boolean;
  projectTypes: string[];
  projectIds: string[];
  kpiIds: TeamDashboardKpiId[];
  showProjectPortfolio: boolean;
  navLabel: string;
  navGroup: NavGroupId;
  accessRoles: UserRole[];
  teamMembers: boolean;
  teamLeads: boolean;
  is_active?: boolean;
};

export const EMPTY_TEAM_DASHBOARD_INPUT: TeamDashboardPackInput = {
  slug: "",
  label: "",
  description: "",
  eyebrow: "Team operating view",
  includeTeamProjects: true,
  projectTypes: [],
  projectIds: [],
  kpiIds: ["active_programs", "avg_health_score", "at_risk_programs", "open_tasks"],
  showProjectPortfolio: true,
  navLabel: "",
  navGroup: "operations",
  accessRoles: ["admin", "super_admin", "senior_manager", "manager", "teamlead", "viewer"],
  teamMembers: true,
  teamLeads: true,
  is_active: true,
};

export function packToFormInput(pack: TeamDashboardPack): TeamDashboardPackInput {
  return {
    slug: pack.slug,
    label: pack.label,
    description: pack.description,
    eyebrow: pack.eyebrow,
    teamId: pack.projectScope.teamId,
    teamName: pack.projectScope.teamName,
    includeTeamProjects: pack.projectScope.includeTeamProjects ?? true,
    projectTypes: pack.projectScope.projectTypes ?? [],
    projectIds: pack.projectScope.projectIds ?? [],
    kpiIds: pack.kpis.map((k) => k.id),
    showProjectPortfolio: pack.showProjectPortfolio ?? true,
    navLabel: pack.nav?.label ?? pack.label,
    navGroup: pack.nav?.group ?? "operations",
    accessRoles: pack.access.roles,
    teamMembers: pack.access.teamMembers ?? true,
    teamLeads: pack.access.teamLeads ?? true,
    is_active: true,
  };
}
