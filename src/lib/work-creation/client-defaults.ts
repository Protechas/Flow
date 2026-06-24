import { normalizeRole } from "@/lib/auth/permissions";
import {
  resolveDepartmentLabel,
  resolveEntityLabel,
  resolveManufacturerLabel,
  resolveProjectLabel,
  resolveTeamLabel,
  resolveUserLabel,
  userDisplayName,
} from "@/lib/users/display-name";
import type { Department, Project, Team, User, WorkPriority } from "@/types/flow";
import type { ForecastComplexityLevel } from "@/types/flow";

const PROJECT_OWNER_ROLES = new Set([
  "admin",
  "super_admin",
  "senior_manager",
  "manager",
  "teamlead",
]);

export { userDisplayName, resolveDepartmentLabel, resolveProjectLabel, resolveTeamLabel, resolveManufacturerLabel, resolveUserLabel, resolveEntityLabel };

export function projectOwnerCandidates(managers: User[], user: User): User[] {
  const byId = new Map<string, User>();
  for (const manager of managers) {
    if (manager.is_active !== false) byId.set(manager.id, manager);
  }
  if (user.is_active !== false && PROJECT_OWNER_ROLES.has(normalizeRole(user.role))) {
    byId.set(user.id, user);
  }
  return [...byId.values()].sort((a, b) =>
    userDisplayName(a).localeCompare(userDisplayName(b))
  );
}

export function defaultProjectOwnerId(user: User, managers: User[]): string {
  const candidates = projectOwnerCandidates(managers, user);
  if (candidates.some((c) => c.id === user.id)) return user.id;
  return candidates[0]?.id ?? "__none__";
}

export function resolveOwnerLabel(
  ownerId: string,
  managers: User[],
  user: User
): string {
  if (ownerId === "__none__") return "Unassigned";
  const match = projectOwnerCandidates(managers, user).find((m) => m.id === ownerId);
  return match ? userDisplayName(match) : "Select owner";
}

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
    departments.find((d) => d.id === teamDept)?.id ?? departments[0]?.id ?? "";

  return {
    departmentId,
    teamId: teamIdForDepartment(departmentId, teams),
    complexity: "standard",
    priority: "medium",
    year: String(new Date().getFullYear()),
    manufacturerFallback: "General",
  };
}
