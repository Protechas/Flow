/**
 * Client-safe hierarchy visibility — no flow-store or server-only imports.
 */
import { getOrganizationalPosition, getOrganizationalScopeRole, hasAdminAccess } from "@/lib/auth/access-level";
import { isUserProductionReady } from "@/lib/setup/account";
import {
  getPrimaryHierarchyForUser,
  listHierarchyRecords,
} from "@/lib/hierarchy/store";
import {
  getEffectiveScopeMode,
  getTeamScopedUserIds,
} from "@/lib/hierarchy/team-scope";
import type { DepartmentUser, Team, User, UserRole } from "@/types/flow";

export type HierarchyScopeMode = "org" | "branch" | "team" | "self";

const ORG_WIDE_ROLES: UserRole[] = ["viewer"];

export function isOrgWideRole(role: UserRole): boolean {
  return ORG_WIDE_ROLES.includes(role);
}

/** Org-wide hierarchy visibility (admin access or viewer org position). */
export function isHierarchyOrgWide(viewer: User): boolean {
  if (hasAdminAccess(viewer)) return true;
  return isOrgWideRole(getOrganizationalScopeRole(viewer));
}

function scopeRoleForUser(user: User): UserRole {
  return getOrganizationalScopeRole(user);
}

export function getDirectReportIds(supervisorId: string, users: User[]): string[] {
  const hierarchyChildren = listHierarchyRecords()
    .filter(
      (r) =>
        r.is_active &&
        r.is_primary &&
        r.parent_user_id === supervisorId
    )
    .map((r) => r.user_id);

  if (hierarchyChildren.length) return hierarchyChildren;

  return users
    .filter((u) => u.is_active && u.manager_id === supervisorId)
    .map((u) => u.id);
}

export function getAllDescendantIds(supervisorId: string, users: User[]): string[] {
  const result: string[] = [];
  const queue = [...getDirectReportIds(supervisorId, users)];

  while (queue.length) {
    const id = queue.shift()!;
    if (result.includes(id)) continue;
    result.push(id);
    queue.push(...getDirectReportIds(id, users));
  }

  return result;
}

export function getVisibleUserIds(
  viewer: User,
  users: User[],
  teams: Team[] = []
): string[] {
  const active = users.filter((u) => u.is_active);

  if (isHierarchyOrgWide(viewer)) {
    return active.map((u) => u.id);
  }

  if (scopeRoleForUser(viewer) === "employee") {
    return [viewer.id];
  }

  const mode = getEffectiveScopeMode(viewer);

  if (mode === "branch") {
    const descendants = getAllDescendantIds(viewer.id, active);
    return [viewer.id, ...descendants];
  }

  if (mode === "team") {
    const scopeRole = scopeRoleForUser(viewer);
    if (scopeRole === "teamlead") {
      return [viewer.id, ...getDirectReportIds(viewer.id, active)];
    }
    return getTeamScopedUserIds(viewer, active, teams);
  }

  return [viewer.id];
}

export function canViewerSeeUser(
  viewer: User,
  targetUserId: string,
  users: User[],
  teams: Team[] = []
): boolean {
  if (viewer.id === targetUserId) return true;
  return getVisibleUserIds(viewer, users, teams).includes(targetUserId);
}

export function filterUsersToHierarchyScope(
  viewer: User,
  users: User[],
  teams: Team[] = []
): User[] {
  const ids = new Set(getVisibleUserIds(viewer, users, teams));
  return users.filter((u) => ids.has(u.id));
}

export function getAssignableUserIds(
  viewer: User,
  users: User[],
  teams: Team[] = [],
  departmentUsers: DepartmentUser[] = []
): string[] {
  const visible = new Set(getVisibleUserIds(viewer, users, teams));
  return users
    .filter(
      (u) =>
        visible.has(u.id) &&
        u.is_active &&
        u.id !== viewer.id &&
        (() => {
          const position = getOrganizationalPosition(u);
          return position === "employee" || position === "team_lead";
        })() &&
        isUserProductionReady(u, departmentUsers, teams)
    )
    .map((u) => u.id);
}

export function getPrimarySupervisorId(userId: string, users: User[]): string | null {
  const edge = getPrimaryHierarchyForUser(userId);
  if (edge?.is_active) return edge.parent_user_id;
  const user = users.find((u) => u.id === userId);
  return user?.manager_id ?? null;
}
