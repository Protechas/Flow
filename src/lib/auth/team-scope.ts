import { getUserPrimaryDepartmentId } from "@/lib/departments/resolve";
import { initHierarchyFromUsers } from "@/lib/hierarchy/store";
import {
  getAllDescendantIds,
  canViewerSeeUser,
  filterUsersToHierarchyScope,
  getVisibleUserIds,
  getAssignableUserIds,
  getReportingChain,
  resolveLeadersForEmployee,
  getPrimarySupervisorId,
  getScopeMode,
  isOrgWideRole,
  isHierarchyOrgWide,
  buildOrgChart,
  syncHierarchyOnManagerChange,
  pruneOrgChartNodes,
} from "@/lib/hierarchy/resolver";
import type { Team, User, WorkPackage } from "@/types/flow";

export {
  getVisibleUserIds,
  getAssignableUserIds,
  getAllDescendantIds,
  getReportingChain,
  resolveLeadersForEmployee,
  getPrimarySupervisorId,
  getScopeMode,
  isOrgWideRole,
  isHierarchyOrgWide,
  buildOrgChart,
  syncHierarchyOnManagerChange,
  pruneOrgChartNodes,
  canViewerSeeUser,
  filterUsersToHierarchyScope,
};

/** Active users in the viewer's scope (downstream for branch; team-limited for managers). */
export function getTeamMemberIds(lead: User, users: User[], teams: Team[] = []): string[] {
  return getVisibleUserIds(lead, users, teams).filter((id) => id !== lead.id);
}

export function filterUsersToTeamScope(viewer: User, users: User[], teams: Team[] = []): User[] {
  return filterUsersToHierarchyScope(viewer, users, teams);
}

export function filterWorkPackagesToTeam(
  packages: WorkPackage[],
  teamMemberIds: string[]
): WorkPackage[] {
  if (teamMemberIds.length === 0) return [];
  const ids = new Set(teamMemberIds);
  return packages.filter((p) => p.assigned_to && ids.has(p.assigned_to));
}

export function teamLeadCanViewPerson(
  lead: User,
  targetUserId: string,
  users: User[],
  teams: Team[] = []
): boolean {
  return canViewerSeeUser(lead, targetUserId, users, teams);
}

/** Descendant user IDs for hierarchy-scoped views (undefined = org-wide). */
export function getScopeMemberIds(
  viewer: User,
  users: User[],
  teams: Team[] = []
): string[] | undefined {
  if (isHierarchyOrgWide(viewer)) return undefined;
  if (viewer.role === "employee") return [viewer.id];
  return getTeamMemberIds(viewer, users, teams);
}

export function initHierarchyFromStore(users: User[]): void {
  initHierarchyFromUsers(users, getUserPrimaryDepartmentId);
}
