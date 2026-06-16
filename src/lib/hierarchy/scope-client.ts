import type { Team, User, UserRole } from "@/types/flow";
import {
  getEffectiveScopeMode,
  getManagedTeamIds,
  getTeamScopedUserIds,
} from "@/lib/hierarchy/team-scope";

const ORG_WIDE_ROLES: UserRole[] = ["super_admin", "admin", "viewer"];

function getDirectReportIds(supervisorId: string, users: User[]): string[] {
  return users
    .filter((u) => u.is_active && u.manager_id === supervisorId)
    .map((u) => u.id);
}

function getAllDescendantIds(supervisorId: string, users: User[]): string[] {
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

function getVisibleUserIds(viewer: User, users: User[], teams: Team[] = []): string[] {
  const active = users.filter((u) => u.is_active);

  if (ORG_WIDE_ROLES.includes(viewer.role)) {
    return active.map((u) => u.id);
  }

  if (viewer.role === "employee") {
    return [viewer.id];
  }

  const mode = getEffectiveScopeMode(viewer);

  if (mode === "branch") {
    return [viewer.id, ...getAllDescendantIds(viewer.id, active)];
  }

  if (mode === "team") {
    return getTeamScopedUserIds(viewer, active, teams);
  }

  return [viewer.id];
}

/** Client-safe assignment scope using manager_id reporting chain and team ownership. */
export function getAssignableUserIdsClient(
  viewer: User,
  users: User[],
  teams: Team[] = []
): string[] {
  const visible = new Set(getVisibleUserIds(viewer, users, teams));
  return users
    .filter(
      (u) =>
        visible.has(u.id) &&
        u.is_active &&
        u.id !== viewer.id &&
        (u.role === "employee" || u.role === "teamlead")
    )
    .map((u) => u.id);
}

export { getManagedTeamIds, getEffectiveScopeMode };
