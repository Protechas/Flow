import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { DEFAULT_DEPARTMENT_ID } from "@/lib/data/mock-data";
import type { Department, DepartmentUser, Project, User, WorkPackage } from "@/types/flow";

export function getDepartmentById(departmentId: string): Department | null {
  initFlowStore();
  return getFlowStore().departments.find((d) => d.id === departmentId) ?? null;
}

export function getDepartmentName(departmentId: string | null | undefined): string {
  if (!departmentId) return "—";
  return getDepartmentById(departmentId)?.name ?? departmentId;
}

export function getUserDepartmentMemberships(userId: string): DepartmentUser[] {
  initFlowStore();
  return getFlowStore().departmentUsers.filter((du) => du.user_id === userId);
}

/** Primary department for wrap-ups and default scoping. */
export function getUserPrimaryDepartmentId(userId: string): string | null {
  initFlowStore();
  const store = getFlowStore();
  const primary = store.departmentUsers.find((du) => du.user_id === userId && du.is_primary);
  if (primary) return primary.department_id;

  const user = store.users.find((u) => u.id === userId);
  if (user?.team_id) {
    const team = store.teams.find((t) => t.id === user.team_id);
    if (team?.department_id) return team.department_id;
  }
  return demoDepartmentFallback();
}

function demoDepartmentFallback(): string | null {
  initFlowStore();
  const hasDemoDefault = getFlowStore().departments.some((d) => d.id === DEFAULT_DEPARTMENT_ID);
  return hasDemoDefault ? DEFAULT_DEPARTMENT_ID : null;
}

export function resolveDepartmentForProject(
  project: Pick<Project, "department_id" | "team_id">
): string | null {
  if (project.department_id) return project.department_id;
  initFlowStore();
  if (project.team_id) {
    const team = getFlowStore().teams.find((t) => t.id === project.team_id);
    if (team?.department_id) return team.department_id;
  }
  return demoDepartmentFallback();
}

export function resolveDepartmentForTask(
  pkg: Pick<WorkPackage, "department_id" | "project_id">,
  project?: Project | null
): string | null {
  if (pkg.department_id) return pkg.department_id;
  if (project) return resolveDepartmentForProject(project);
  initFlowStore();
  const p = getFlowStore().projects.find((x) => x.id === pkg.project_id);
  return p ? resolveDepartmentForProject(p) : demoDepartmentFallback();
}

export function resolveDepartmentForUser(userId: string): string | null {
  return getUserPrimaryDepartmentId(userId);
}

export function getUsersInDepartment(
  departmentId: string,
  users: User[],
  departmentUsers: DepartmentUser[]
): User[] {
  const memberIds = new Set(
    departmentUsers.filter((du) => du.department_id === departmentId).map((du) => du.user_id)
  );
  return users.filter((u) => {
    if (memberIds.has(u.id)) return true;
    if (u.team_id) {
      const store = getFlowStore();
      const team = store.teams.find((t) => t.id === u.team_id);
      return team?.department_id === departmentId;
    }
    return false;
  });
}

export function sortUsersByDepartment(
  users: User[],
  preferredDepartmentId: string
): User[] {
  return [...users].sort((a, b) => {
    const aPrimary = getUserPrimaryDepartmentId(a.id) === preferredDepartmentId ? 0 : 1;
    const bPrimary = getUserPrimaryDepartmentId(b.id) === preferredDepartmentId ? 0 : 1;
    if (aPrimary !== bPrimary) return aPrimary - bPrimary;
    return a.full_name.localeCompare(b.full_name);
  });
}
