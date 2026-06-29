import type { Project, Team } from "@/types/flow";
import type { ProjectWithStats } from "@/lib/projects/portfolio-utils";
import type { TeamDashboardPack } from "@/lib/team-dashboards/types";

export function resolveTeamForPack(pack: TeamDashboardPack, teams: Team[]): Team | null {
  const teamId = pack.projectScope.teamId?.trim();
  if (teamId) {
    return teams.find((t) => t.id === teamId) ?? null;
  }

  const name = pack.projectScope.teamName?.trim();
  if (!name) return null;
  const exact = teams.find((t) => t.name === name);
  if (exact) return exact;
  return teams.find((t) => t.name.toLowerCase() === name.toLowerCase()) ?? null;
}

export function scopeProjectsForPack(
  pack: TeamDashboardPack,
  projects: ProjectWithStats[],
  team: Team | null
): ProjectWithStats[] {
  const scope = pack.projectScope;
  const explicitIds = new Set(scope.projectIds ?? []);
  const types = new Set(scope.projectTypes ?? []);
  const teamId = team?.id;
  const teamDeptId = team?.department_id ?? undefined;

  return projects.filter((project) => {
    if (project.status === "archived") return false;
    if (explicitIds.has(project.id)) return true;
    if (scope.includeTeamProjects && teamId && project.team_id === teamId) return true;
    if (types.size > 0 && project.project_type && types.has(project.project_type)) {
      if (teamDeptId && project.department_id && project.department_id !== teamDeptId) {
        return false;
      }
      return true;
    }
    return false;
  });
}

export function scopePackagesForProjects(
  packages: { project_id: string; status: string }[],
  projects: Pick<Project, "id">[]
): typeof packages {
  const ids = new Set(projects.map((p) => p.id));
  return packages.filter((pkg) => ids.has(pkg.project_id));
}
