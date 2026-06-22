/**
 * Extended hierarchy resolver — server-safe; visibility re-exported from visibility-core.
 */
import { getOrganizationalPosition, getOrganizationalScopeRole, hasAdminAccess } from "@/lib/auth/access-level";
import { getUserPrimaryDepartmentId } from "@/lib/departments/resolve";
import {
  getAllDescendantIds,
  getDirectReportIds,
  getPrimarySupervisorId,
  isHierarchyOrgWide,
  isOrgWideRole,
  type HierarchyScopeMode,
} from "@/lib/hierarchy/visibility-core";
import {
  getEffectiveScopeMode,
} from "@/lib/hierarchy/team-scope";
import {
  upsertPrimaryHierarchy,
} from "@/lib/hierarchy/store";
import type {
  OrgChartNode,
  ReportingChainEntry,
  Team,
  User,
  UserRole,
} from "@/types/flow";
import { hierarchyLevelForRole as hierarchyLevelForRoleImpl } from "@/lib/hierarchy/role-utils";

export type { HierarchyScopeMode };
export {
  canViewerSeeUser,
  filterUsersToHierarchyScope,
  getAllDescendantIds,
  getAssignableUserIds,
  getDirectReportIds,
  getPrimarySupervisorId,
  getVisibleUserIds,
  isHierarchyOrgWide,
  isOrgWideRole,
} from "@/lib/hierarchy/visibility-core";

const BRANCH_ROLES: UserRole[] = ["senior_manager"];

export function getScopeMode(role: UserRole, user?: User): HierarchyScopeMode {
  if (user) return getEffectiveScopeMode(user);
  if (isOrgWideRole(role)) return "org";
  if (BRANCH_ROLES.includes(role)) return "branch";
  if (role === "manager") return "branch";
  if (role === "teamlead") return "team";
  return "self";
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
    if (includeSeniorManager && entry.role === "senior_manager") {
      recipients.set(u.id, u);
    }
  }

  if (!recipients.size && includeAdminFallback) {
    const admin = users.find((u) => u.is_active && hasAdminAccess(u));
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
