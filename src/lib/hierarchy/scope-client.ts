import type { DepartmentUser, Team, User } from "@/types/flow";
import { getOrganizationalPosition } from "@/lib/auth/access-level";
import {
  getAssignableUserIds,
  getVisibleUserIds,
  isHierarchyOrgWide,
} from "@/lib/hierarchy/visibility-core";

/** Client-safe assignment scope — mirrors server resolver. */
export function getAssignableUserIdsClient(
  viewer: User,
  users: User[],
  teams: Team[] = [],
  departmentUsers: DepartmentUser[] = []
): string[] {
  return getAssignableUserIds(viewer, users, teams, departmentUsers);
}

export function getVisibleUserIdsClient(
  viewer: User,
  users: User[],
  teams: Team[] = []
): string[] {
  return getVisibleUserIds(viewer, users, teams);
}

export { isHierarchyOrgWide, getOrganizationalPosition };
