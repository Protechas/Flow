import { isActiveProject } from "@/lib/data/entity-filters";
import type { CreationScopeOverride } from "@/lib/work-creation/client-defaults";
import type { TeamDashboardSnapshot } from "@/lib/team-dashboards/types";
import type { Project, Team } from "@/types/flow";

export function teamDashboardCreationScope(
  snapshot: TeamDashboardSnapshot,
  teams: Team[]
): CreationScopeOverride | undefined {
  const { team, pack } = snapshot;
  if (team) {
    return {
      departmentId: team.department_id ?? undefined,
      teamId: team.id,
    };
  }
  const teamId = pack.projectScope.teamId;
  if (!teamId) return undefined;
  const match = teams.find((t) => t.id === teamId);
  if (!match) return { teamId };
  return {
    departmentId: match.department_id ?? undefined,
    teamId: match.id,
  };
}

/** Programs/boards available for task and board creation from this dashboard. */
export function teamDashboardWorkProjects(
  snapshot: TeamDashboardSnapshot,
  allProjects: Project[],
  teams: Team[]
): Project[] {
  const active = allProjects.filter(isActiveProject);
  const scopedIds = new Set(snapshot.projects.map((p) => p.id));
  const scope = teamDashboardCreationScope(snapshot, teams);

  const matchesTeamContext = (p: Project) => {
    if (scopedIds.has(p.id)) return true;
    if (scope?.teamId && p.team_id === scope.teamId) return true;
    if (scope?.departmentId && p.department_id === scope.departmentId) return true;
    return false;
  };

  const filtered = active.filter(matchesTeamContext);
  return filtered.length > 0 ? filtered : active;
}
