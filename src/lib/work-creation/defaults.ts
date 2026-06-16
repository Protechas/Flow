import { getUserPrimaryDepartmentId } from "@/lib/departments/resolve";
import {
  teamIdForDepartment,
  filterBoardProjects,
  filterProgramProjects,
  type CreationDefaults,
} from "@/lib/work-creation/client-defaults";
import type { Department, Project, User } from "@/types/flow";
import type { Team } from "@/types/flow";

export { getAllowedCreationModes } from "@/lib/work-creation/permissions";
export { filterBoardProjects, filterProgramProjects, teamIdForDepartment, type CreationDefaults };

export function resolveDefaultDepartmentId(userId: string): string {
  return getUserPrimaryDepartmentId(userId);
}

/** Server-side defaults with primary department membership resolution. */
export function buildCreationDefaults(
  user: User,
  departments: Department[],
  teams: Team[]
): CreationDefaults {
  const departmentId =
    departments.find((d) => d.id === resolveDefaultDepartmentId(user.id))?.id ??
    departments[0]?.id ??
    resolveDefaultDepartmentId(user.id);

  return {
    departmentId,
    teamId: teamIdForDepartment(departmentId, teams),
    complexity: "standard",
    priority: "medium",
    year: String(new Date().getFullYear()),
    manufacturerFallback: "General",
  };
}

export function boardContextFromProject(
  board: Project | undefined,
  departments: Department[]
): { departmentId: string; teamId: string; descriptionPrefix: string } {
  if (!board) {
    return { departmentId: departments[0]?.id ?? "", teamId: "team-1", descriptionPrefix: "" };
  }
  return {
    departmentId: board.department_id ?? departments[0]?.id ?? "",
    teamId: board.team_id ?? "team-1",
    descriptionPrefix: `Board: ${board.name}`,
  };
}
