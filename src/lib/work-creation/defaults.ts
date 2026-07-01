import { getUserPrimaryDepartmentId } from "@/lib/departments/resolve";
import { resolveTeamIdForDepartment } from "@/lib/departments/structure-defaults";
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

export function resolveDefaultDepartmentId(userId: string): string | null {
  return getUserPrimaryDepartmentId(userId);
}

/** Server-side defaults with primary department membership resolution. */
export function buildCreationDefaults(
  user: User,
  departments: Department[],
  teams: Team[]
): CreationDefaults {
  const primaryDept = resolveDefaultDepartmentId(user.id);
  const departmentId =
    departments.find((d) => d.id === primaryDept)?.id ??
    departments[0]?.id ??
    primaryDept ??
    "";

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
  departments: Department[],
  teams: Team[] = []
): { departmentId: string; teamId: string; descriptionPrefix: string } {
  if (!board) {
    return {
      departmentId: departments[0]?.id ?? "",
      teamId: resolveTeamIdForDepartment(departments[0]?.id ?? "", teams),
      descriptionPrefix: "",
    };
  }
  const departmentId = board.department_id ?? departments[0]?.id ?? "";
  return {
    departmentId,
    teamId: board.team_id ?? resolveTeamIdForDepartment(departmentId, teams),
    descriptionPrefix: `Board: ${board.name}`,
  };
}
