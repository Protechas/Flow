import { buildProgramIntelligence } from "@/lib/projects/project-intelligence";
import {
  buildPortfolioKpis,
  type ProjectWithStats,
} from "@/lib/projects/portfolio-utils";
import { resolveTeamForPack, scopePackagesForProjects, scopeProjectsForPack } from "@/lib/team-dashboards/resolve";
import type {
  TeamDashboardKpiConfig,
  TeamDashboardKpiId,
  TeamDashboardKpiValue,
  TeamDashboardPack,
  TeamDashboardSnapshot,
} from "@/lib/team-dashboards/types";
import type {
  ActivityEvent,
  ForecastSettings,
  Manufacturer,
  QaReview,
  Team,
  User,
  WorkPackage,
  YearWorkItem,
} from "@/types/flow";

export interface TeamDashboardEngineInput {
  pack: TeamDashboardPack;
  projects: ProjectWithStats[];
  packages: WorkPackage[];
  manufacturers: Manufacturer[];
  yearItems: YearWorkItem[];
  qaReviews: QaReview[];
  activity: ActivityEvent[];
  forecastSettings: ForecastSettings;
  teams: Team[];
  users: User[];
}

function formatKpiValue(id: TeamDashboardKpiId, raw: number): string {
  switch (id) {
    case "avg_health_score":
    case "avg_completion_pct":
    case "avg_capacity_load":
      return `${Math.round(raw)}%`;
    default:
      return String(Math.round(raw));
  }
}

function rawKpiValue(
  id: TeamDashboardKpiId,
  portfolio: ReturnType<typeof buildPortfolioKpis>,
  avgHealth: number,
  avgCapacity: number,
  avgCompletion: number,
  teamMemberCount: number
): number {
  switch (id) {
    case "active_programs":
      return portfolio.activeProjects;
    case "avg_health_score":
      return avgHealth;
    case "at_risk_programs":
      return portfolio.projectsAtRisk;
    case "open_tasks":
      return portfolio.openTasks;
    case "forecasted_late":
      return portfolio.forecastedLate;
    case "ready_for_qa":
      return portfolio.readyForQa;
    case "avg_completion_pct":
      return avgCompletion;
    case "avg_capacity_load":
      return avgCapacity;
    case "team_members":
      return teamMemberCount;
    default:
      return 0;
  }
}

function isKpiWarning(config: TeamDashboardKpiConfig, raw: number): boolean {
  if (!config.warnWhen) return false;
  if (config.id === "avg_health_score") return raw < 60;
  if (config.id === "avg_capacity_load") return raw >= 90;
  if (config.warnWhen === "high") return raw > 0;
  if (config.warnWhen === "low") return raw < 70;
  return false;
}

function buildKpiValues(
  configs: TeamDashboardKpiConfig[],
  portfolio: ReturnType<typeof buildPortfolioKpis>,
  avgHealth: number,
  avgCapacity: number,
  avgCompletion: number,
  teamMemberCount: number
): TeamDashboardKpiValue[] {
  return configs.map((config) => {
    const raw = rawKpiValue(
      config.id,
      portfolio,
      avgHealth,
      avgCapacity,
      avgCompletion,
      teamMemberCount
    );
    return {
      id: config.id,
      label: config.label,
      value: formatKpiValue(config.id, raw),
      subtitle: config.subtitle,
      warn: isKpiWarning(config, raw),
    };
  });
}

export function buildTeamDashboardSnapshot(input: TeamDashboardEngineInput): TeamDashboardSnapshot {
  const team = resolveTeamForPack(input.pack, input.teams);
  const scopedProjects = scopeProjectsForPack(input.pack, input.projects, team);
  const scopedPackages = scopePackagesForProjects(input.packages, scopedProjects) as WorkPackage[];

  const programIntelligence = scopedProjects.map((project) =>
    buildProgramIntelligence(
      project,
      scopedPackages,
      input.manufacturers,
      input.yearItems,
      input.qaReviews,
      input.activity,
      input.forecastSettings
    )
  );

  const portfolioKpis = buildPortfolioKpis(
    scopedProjects,
    scopedPackages,
    input.yearItems,
    input.manufacturers
  );

  const avgHealthScore = programIntelligence.length
    ? Math.round(
        programIntelligence.reduce((sum, row) => sum + row.healthScore, 0) /
          programIntelligence.length
      )
    : 0;

  const avgCapacityLoadPct = programIntelligence.length
    ? Math.round(
        programIntelligence.reduce((sum, row) => sum + row.capacityLoadPct, 0) /
          programIntelligence.length
      )
    : 0;

  const avgCompletionPct = scopedProjects.length
    ? Math.round(
        scopedProjects.reduce((sum, row) => sum + row.completedPct, 0) / scopedProjects.length
      )
    : 0;

  const teamMemberCount = team
    ? input.users.filter((u) => u.team_id === team.id && u.is_active !== false).length
    : 0;

  const kpis = buildKpiValues(
    input.pack.kpis,
    portfolioKpis,
    avgHealthScore,
    avgCapacityLoadPct,
    avgCompletionPct,
    teamMemberCount
  );

  return {
    pack: input.pack,
    team,
    projects: scopedProjects,
    packages: scopedPackages,
    portfolioKpis,
    programIntelligence,
    kpis,
    avgHealthScore,
    avgCapacityLoadPct,
    avgCompletionPct,
  };
}
