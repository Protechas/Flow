import { hasPermission } from "@/lib/auth/permissions";
import { getTeamMemberIds } from "@/lib/auth/team-scope";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { getUserPrimaryDepartmentId } from "@/lib/departments/resolve";
import type { Department, User } from "@/types/flow";

export function canViewAllDepartments(user: User): boolean {
  return (
    hasPermission(user.role, "work:view_all") ||
    hasPermission(user.role, "departments:manage") ||
    user.role === "admin" ||
    user.role === "super_admin"
  );
}

export function getViewerDepartmentIds(viewer: User): string[] | null {
  initFlowStore();
  const store = getFlowStore();
  if (canViewAllDepartments(viewer)) return null;

  const ids = new Set<string>();

  for (const dept of store.departments.filter((d) => d.status === "active")) {
    if (dept.lead_user_id === viewer.id) ids.add(dept.id);
  }

  for (const du of store.departmentUsers.filter((x) => x.user_id === viewer.id)) {
    if (du.role_in_department === "lead" || du.role_in_department === "manager") {
      ids.add(du.department_id);
    }
  }

  if (viewer.team_id) {
    const team = store.teams.find((t) => t.id === viewer.team_id);
    if (team?.department_id) ids.add(team.department_id);
  }

  const primary = getUserPrimaryDepartmentId(viewer.id);
  if (primary) ids.add(primary);

  if (viewer.role === "teamlead") {
    const members = getTeamMemberIds(viewer, store.users, store.teams);
    for (const memberId of members) {
      ids.add(getUserPrimaryDepartmentId(memberId));
    }
  }

  return [...ids];
}

export function canManageDepartment(viewer: User, departmentId: string): boolean {
  if (hasPermission(viewer.role, "departments:manage")) return true;
  initFlowStore();
  const store = getFlowStore();
  const dept = store.departments.find((d) => d.id === departmentId);
  if (!dept) return false;
  if (dept.lead_user_id === viewer.id) return true;
  return store.departmentUsers.some(
    (du) =>
      du.user_id === viewer.id &&
      du.department_id === departmentId &&
      (du.role_in_department === "lead" || du.role_in_department === "manager")
  );
}

export function filterDepartmentsForViewer(
  departments: Department[],
  viewer: User
): Department[] {
  const allowed = getViewerDepartmentIds(viewer);
  if (allowed === null) return departments.filter((d) => d.status === "active");
  const set = new Set(allowed);
  return departments.filter((d) => d.status === "active" && set.has(d.id));
}

export function filterByDepartmentId<T>(
  items: T[],
  getDepartmentId: (item: T) => string | null | undefined,
  departmentId: string | null | undefined
): T[] {
  if (!departmentId || departmentId === "all") return items;
  return items.filter((item) => getDepartmentId(item) === departmentId);
}

export function filterByViewerDepartments<T>(
  items: T[],
  getDepartmentId: (item: T) => string | null | undefined,
  viewer: User
): T[] {
  const allowed = getViewerDepartmentIds(viewer);
  if (allowed === null) return items;
  const set = new Set(allowed);
  return items.filter((item) => {
    const deptId = getDepartmentId(item);
    return deptId ? set.has(deptId) : false;
  });
}

export function userBelongsToDepartment(userId: string, departmentId: string): boolean {
  initFlowStore();
  const store = getFlowStore();
  if (store.departmentUsers.some((du) => du.user_id === userId && du.department_id === departmentId)) {
    return true;
  }
  const user = store.users.find((u) => u.id === userId);
  if (!user?.team_id) return false;
  const team = store.teams.find((t) => t.id === user.team_id);
  return team?.department_id === departmentId;
}

export function canAssignTaskToUser(
  assigner: User,
  assigneeId: string,
  taskDepartmentId: string
): boolean {
  if (canViewAllDepartments(assigner)) return true;
  if (!userBelongsToDepartment(assigneeId, taskDepartmentId)) return false;
  const allowed = getViewerDepartmentIds(assigner);
  if (allowed === null) return true;
  return allowed.includes(taskDepartmentId);
}
