import type { Team, User } from "@/types/flow";
import type { HierarchyScopeMode } from "@/lib/hierarchy/resolver";

export function hasBranchViewAccess(user: User): boolean {
  return user.branch_view_access === true;
}

/** Effective visibility mode — managers default to team unless admin grants branch access. */
export function getEffectiveScopeMode(user: User): HierarchyScopeMode {
  if (["super_admin", "admin", "viewer"].includes(user.role)) return "org";
  if (user.role === "senior_manager") return "branch";
  if (user.role === "manager") {
    return hasBranchViewAccess(user) ? "branch" : "team";
  }
  if (user.role === "teamlead") return "team";
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

  if (viewer.role === "teamlead") {
    return [viewer.id, ...getAllDescendantIds(viewer.id, active)];
  }

  if (viewer.role === "manager") {
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
