import { getOrganizationalPosition, getOrganizationalScopeRole, hasAdminAccess } from "@/lib/auth/access-level";
import { getUserPrimaryDepartmentId } from "@/lib/departments/resolve";
import { listDepartmentUsers } from "@/lib/data/flow-store";
import { isUserProductionReady } from "@/lib/setup/account";
import {
  getPrimaryHierarchyForUser,
  listHierarchyRecords,
  upsertPrimaryHierarchy,
} from "@/lib/hierarchy/store";
import {
  getEffectiveScopeMode,
  getTeamScopedUserIds,
} from "@/lib/hierarchy/team-scope";
import type {
  OrgChartNode,
  ReportingChainEntry,
  Team,
  User,
  UserRole,
} from "@/types/flow";
import { hierarchyLevelForRole as hierarchyLevelForRoleImpl } from "@/lib/hierarchy/role-utils";

export type HierarchyScopeMode = "org" | "branch" | "team" | "self";

const ORG_WIDE_ROLES: UserRole[] = ["viewer"];

const BRANCH_ROLES: UserRole[] = ["senior_manager"];

export function isOrgWideRole(role: UserRole): boolean {
  return ORG_WIDE_ROLES.includes(role);
}

export function getScopeMode(role: UserRole, user?: User): HierarchyScopeMode {
  if (user) return getEffectiveScopeMode(user);
  if (ORG_WIDE_ROLES.includes(role)) return "org";
  if (BRANCH_ROLES.includes(role)) return "branch";
  if (role === "manager") return "team";
  if (role === "teamlead") return "team";
  return "self";
}

function scopeRoleForUser(user: User): UserRole {
  return getOrganizationalScopeRole(user);
}

/** Direct reports via hierarchy primary edge, falling back to manager_id */
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

/** All downstream users in reporting chain (transitive) */
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

  if (isOrgWideRole(scopeRoleForUser(viewer))) {
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

/** Users a leader may assign work to within their scope */
export function getAssignableUserIds(
  viewer: User,
  users: User[],
  teams: Team[] = [],
  departmentUsers = listDepartmentUsers()
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

export function getReportingChain(
  userId: string,
  users: User[]
): ReportingChainEntry[] {
  const chain: ReportingChainEntry[] = [];
  let currentId: string | null = userId;
  const visited = new Set<string>();

  while (currentId) {
    const supervisorId = getPrimarySupervisorId(currentId, users);
    if (!supervisorId || visited.has(supervisorId)) break;
    visited.add(supervisorId);

    const supervisor = users.find((u) => u.id === supervisorId);
    if (!supervisor) break;

    const supervisorPosition = getOrganizationalPosition(supervisor);
    let relationship: ReportingChainEntry["relationship"] = "direct_supervisor";
    if (supervisorPosition === "team_lead") relationship = "direct_supervisor";
    else if (supervisorPosition === "manager") relationship = "manager";
    else if (supervisorPosition === "senior_manager") relationship = "senior_manager";

    chain.push({
      user_id: supervisor.id,
      full_name: supervisor.full_name,
      role: getOrganizationalScopeRole(supervisor),
      relationship,
    });

    currentId = supervisorId;
  }

  return chain;
}

export interface LeaderRecipientOptions {
  includeSeniorManager?: boolean;
  includeAdminFallback?: boolean;
}

/** Unified notification recipient resolution along reporting chain */
export function resolveLeadersForEmployee(
  employee: User,
  users: User[],
  options: LeaderRecipientOptions = {}
): User[] {
  const { includeSeniorManager = true, includeAdminFallback = true } = options;
  const recipients = new Map<string, User>();
  const chain = getReportingChain(employee.id, users);

  for (const entry of chain) {
    const u = users.find((x) => x.id === entry.user_id);
    if (!u?.is_active) continue;

    if (entry.role === "teamlead" || entry.role === "manager") {
      recipients.set(u.id, u);
    }
    if (
      includeSeniorManager &&
      entry.role === "senior_manager"
    ) {
      recipients.set(u.id, u);
    }
  }

  if (!recipients.size && includeAdminFallback) {
    const admin = users.find(
      (u) => u.is_active && hasAdminAccess(u)
    );
    if (admin) recipients.set(admin.id, admin);
  }

  return [...recipients.values()];
}

export function syncHierarchyOnManagerChange(
  userId: string,
  parentUserId: string | null,
  users: User[],
  teamId?: string | null
): void {
  if (!parentUserId) return;
  const user = users.find((u) => u.id === userId);
  upsertPrimaryHierarchy({
    user_id: userId,
    parent_user_id: parentUserId,
    department_id: getUserPrimaryDepartmentId(userId),
    team_id: teamId ?? user?.team_id ?? null,
  });
}

export function buildOrgChart(
  users: User[],
  departments: { id: string; name: string }[],
  teams: { id: string; name: string }[],
  rootUserId?: string | null
): OrgChartNode[] {
  const active = users.filter((u) => u.is_active);
  const childMap = new Map<string, string[]>();

  for (const u of active) {
    const parentId = getPrimarySupervisorId(u.id, active);
    if (!parentId) continue;
    const list = childMap.get(parentId) ?? [];
    list.push(u.id);
    childMap.set(parentId, list);
  }

  function buildNode(userId: string): OrgChartNode | null {
    const user = active.find((u) => u.id === userId);
    if (!user) return null;
    const dept = departments.find(
      (d) => d.id === getUserPrimaryDepartmentId(userId)
    );
    const team = teams.find((t) => t.id === user.team_id);
    const childIds = childMap.get(userId) ?? [];
    return {
      user,
      department_name: dept?.name ?? null,
      team_name: team?.name ?? null,
      children: childIds
        .map((id) => buildNode(id))
        .filter((n): n is OrgChartNode => n !== null)
        .sort((a, b) => a.user.full_name.localeCompare(b.user.full_name)),
    };
  }

  let roots: string[];
  if (rootUserId) {
    roots = [rootUserId];
  } else {
    roots = active
      .filter((u) => !getPrimarySupervisorId(u.id, active))
      .map((u) => u.id);
  }

  return roots
    .map((id) => buildNode(id))
    .filter((n): n is OrgChartNode => n !== null)
    .sort((a, b) => a.user.full_name.localeCompare(b.user.full_name));
}

export function pruneOrgChartNodes(
  nodes: OrgChartNode[],
  visibleIds: Set<string>
): OrgChartNode[] {
  function prune(node: OrgChartNode): OrgChartNode | null {
    const children = node.children
      .map(prune)
      .filter((n): n is OrgChartNode => n !== null);
    if (visibleIds.has(node.user.id) || children.length > 0) {
      return { ...node, children };
    }
    return null;
  }
  return nodes.map(prune).filter((n): n is OrgChartNode => n !== null);
}

export function hierarchyLevelForRole(role: UserRole): number {
  return hierarchyLevelForRoleImpl(role);
}
