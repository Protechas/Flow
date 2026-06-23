/**
 * Unified hierarchy visibility API — reuse across org chart, people, alerts, reports, assignments.
 * Reporting chain drives scope; system_access_level grants org-wide admin visibility.
 */

import { getOrganizationalPosition, hasAdminAccess } from "@/lib/auth/access-level";
import {
  buildOrgChart,
  canViewerSeeUser,
  getAllDescendantIds,
  getAssignableUserIds,
  getDirectReportIds,
  getVisibleUserIds,
  isHierarchyOrgWide,
  pruneOrgChartNodes,
} from "@/lib/hierarchy/resolver";
import {
  buildHybridOrgChart,
  getVisiblePositionIds,
  prunePositionOrgChartNodes,
} from "@/lib/positions/resolver";
import { hasOrgPositions, listActiveOrgPositions } from "@/lib/positions/store";
import type { OrgChartNode, Team, User } from "@/types/flow";

export {
  buildOrgChart,
  canViewerSeeUser,
  getAllDescendantIds,
  getAssignableUserIds,
  getDirectReportIds,
  getVisibleUserIds,
  isHierarchyOrgWide,
  pruneOrgChartNodes,
  hasAdminAccess,
};

export function canViewUser(
  viewer: User,
  targetUserId: string,
  users: User[],
  teams: Team[] = []
): boolean {
  return canViewerSeeUser(viewer, targetUserId, users, teams);
}

export function canAssignToUser(
  viewer: User,
  targetUserId: string,
  users: User[],
  teams: Team[] = []
): boolean {
  if (!canViewerSeeUser(viewer, targetUserId, users, teams)) return false;
  const target = users.find((u) => u.id === targetUserId);
  if (!target?.is_active) return false;
  const position = getOrganizationalPosition(target);
  return position === "employee" || position === "team_lead";
}

export function canViewBranch(
  viewer: User,
  branchRootUserId: string,
  users: User[],
  teams: Team[] = []
): boolean {
  if (isHierarchyOrgWide(viewer)) return true;
  const visible = new Set(getVisibleUserIds(viewer, users, teams));
  if (!visible.has(branchRootUserId)) return false;
  const descendants = getAllDescendantIds(branchRootUserId, users);
  return descendants.every((id) => visible.has(id));
}

export function getHierarchyTree(
  viewer: User,
  users: User[],
  departments: { id: string; name: string }[],
  teams: Team[]
): OrgChartNode[] {
  const usePositions = hasOrgPositions();

  const roots = isHierarchyOrgWide(viewer)
    ? buildHybridOrgChart(users, departments, teams, buildOrgChart)
    : buildHybridOrgChart(users, departments, teams, buildOrgChart, viewer.id);

  if (isHierarchyOrgWide(viewer)) return roots;

  if (usePositions) {
    const visiblePositions = getVisiblePositionIds(
      viewer,
      listActiveOrgPositions(),
      users
    );
    return prunePositionOrgChartNodes(roots, visiblePositions);
  }

  const visibleIds = new Set(getVisibleUserIds(viewer, users, teams));
  return pruneOrgChartNodes(roots, visibleIds);
}
