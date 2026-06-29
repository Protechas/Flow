import type { NavGroupId } from "@/lib/auth/permissions";
import type { Project, Team, User, WorkPackage } from "@/types/flow";
import type { ProjectWithStats } from "@/lib/projects/portfolio-utils";
import type { ProgramIntelligence } from "@/lib/projects/project-intelligence";
import type { PortfolioKpis } from "@/lib/projects/portfolio-utils";

export type TeamDashboardKpiId =
  | "active_programs"
  | "avg_health_score"
  | "at_risk_programs"
  | "open_tasks"
  | "forecasted_late"
  | "ready_for_qa"
  | "avg_completion_pct"
  | "avg_capacity_load"
  | "team_members";

export interface TeamDashboardKpiConfig {
  id: TeamDashboardKpiId;
  label: string;
  subtitle?: string;
  warnWhen?: "high" | "low";
}

export interface TeamDashboardProjectScope {
  /** Resolved team id from builder. */
  teamId?: string;
  /** Match a team record by exact name (e.g. "Advanced Projects Team"). */
  teamName?: string;
  /** Include projects assigned to the resolved team. */
  includeTeamProjects?: boolean;
  /** Include projects with these project_type values. */
  projectTypes?: string[];
  /** Explicit project IDs — always included when set. */
  projectIds?: string[];
}

export interface TeamDashboardAccessConfig {
  roles: User["role"][];
  /** Team members on the resolved team can view. */
  teamMembers?: boolean;
  /** Users who manage the team (manager_id / team_lead) can view. */
  teamLeads?: boolean;
  /** Admins always bypass. */
}

export interface TeamDashboardPack {
  slug: string;
  label: string;
  description: string;
  eyebrow?: string;
  projectScope: TeamDashboardProjectScope;
  kpis: TeamDashboardKpiConfig[];
  showProjectPortfolio?: boolean;
  nav?: {
    label: string;
    icon: string;
    group: NavGroupId;
  };
  access: TeamDashboardAccessConfig;
}

export interface TeamDashboardKpiValue {
  id: TeamDashboardKpiId;
  label: string;
  value: string;
  subtitle?: string;
  warn?: boolean;
}

export interface TeamDashboardSnapshot {
  pack: TeamDashboardPack;
  team: Team | null;
  projects: ProjectWithStats[];
  packages: WorkPackage[];
  portfolioKpis: PortfolioKpis;
  programIntelligence: ProgramIntelligence[];
  kpis: TeamDashboardKpiValue[];
  avgHealthScore: number;
  avgCapacityLoadPct: number;
  avgCompletionPct: number;
}
