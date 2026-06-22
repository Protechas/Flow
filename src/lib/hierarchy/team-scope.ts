import { getOrganizationalScopeRole } from "@/lib/auth/access-level";
import type { Team, User } from "@/types/flow";
import type { HierarchyScopeMode } from "@/lib/hierarchy/visibility-core";

export function hasBranchViewAccess(user: User): boolean {
  return user.branch_view_access === true;
}

/** Effective visibility mode — based on org position, not system admin access */
export function getEffectiveScopeMode(user: User): HierarchyScopeMode {
  const scopeRole = getOrganizationalScopeRole(user);
  if (scopeRole === "viewer") return "org";
  if (scopeRole === "senior_manager") return "branch";
  if (scopeRole === "manager") {
    return "branch";
  }
  if (scopeRole === "teamlead") return "team";
  return "self";
}

/** Teams a manager is responsible for (explicit ownership + direct reports' teams). */
export function getManagedTeamIds(
  managerId: string,
  users: User[],
  teams: Team[]
): string[] {
  const ids = new Set<string>();

  for (const t of teams) {
    if (t.manager_id === managerId) ids.add(t.id);
  }

  for (const u of users) {
    if (!u.is_active) continue;
    if (u.manager_id === managerId && u.team_id) {
      ids.add(u.team_id);
    }
  }

  const manager = users.find((u) => u.id === managerId);
  if (manager?.team_id) ids.add(manager.team_id);

  return [...ids];
}

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

/** Users visible under team scope (managers see only their teams; team leads see their subtree). */
export function getTeamScopedUserIds(
  viewer: User,
  users: User[],
  teams: Team[]
): string[] {
  const active = users.filter((u) => u.is_active);

  const scopeRole = getOrganizationalScopeRole(viewer);

  if (scopeRole === "teamlead") {
    return [viewer.id, ...getAllDescendantIds(viewer.id, active)];
  }

  if (scopeRole === "manager") {
    const managedTeamIds = new Set(getManagedTeamIds(viewer.id, active, teams));
    const visible = new Set<string>([viewer.id]);

    for (const u of active) {
      if (u.manager_id === viewer.id) {
        visible.add(u.id);
      }
      if (u.team_id && managedTeamIds.has(u.team_id)) {
        visible.add(u.id);
      }
    }

    return [...visible];
  }

  return [viewer.id];
}
