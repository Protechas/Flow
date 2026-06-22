import { listDepartmentUsers } from "@/lib/data/flow-store";
import type { DepartmentUser, Team, User } from "@/types/flow";

export * from "@/lib/hierarchy/resolver-core";

import { getAssignableUserIds as getAssignableUserIdsCore } from "@/lib/hierarchy/resolver-core";

/** Server resolver — defaults department membership from flow store. */
export function getAssignableUserIds(
  viewer: User,
  users: User[],
  teams: Team[] = [],
  departmentUsers: DepartmentUser[] = listDepartmentUsers()
): string[] {
  return getAssignableUserIdsCore(viewer, users, teams, departmentUsers);
}
