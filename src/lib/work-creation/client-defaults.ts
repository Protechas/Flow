import type { Department, Project, Team, User, WorkPriority } from "@/types/flow";
import type { ForecastComplexityLevel } from "@/types/flow";

export function teamIdForDepartment(departmentId: string, teams: Team[]): string {
  return teams.find((t) => t.department_id === departmentId)?.id ?? teams[0]?.id ?? "team-1";
}

export function filterBoardProjects(projects: Project[]): Project[] {
  return projects.filter(
    (p) => p.status === "active" && (p.project_type === "board" || p.project_type === "research")
  );
}

export function filterProgramProjects(projects: Project[]): Project[] {
  return projects.filter((p) => p.status === "active" && p.project_type !== "board");
}

export interface CreationDefaults {
  departmentId: string;
  teamId: string;
  complexity: ForecastComplexityLevel;
  priority: WorkPriority;
  year: string;
  manufacturerFallback: string;
}

/** Client-safe defaults — uses passed departments/teams only (no flow-store). */
export function buildCreationDefaults(
  user: User,
  departments: Department[],
  teams: Team[]
): CreationDefaults {
  const teamDept = user.team_id
    ? teams.find((t) => t.id === user.team_id)?.department_id
    : undefined;
  const departmentId =
    departments.find((d) => d.id === teamDept)?.id ?? departments[0]?.id ?? teamDept ?? "";

  return {
    departmentId,
    teamId: teamIdForDepartment(departmentId, teams),
    complexity: "standard",
    priority: "medium",
    year: String(new Date().getFullYear()),
    manufacturerFallback: "General",
  };
}
