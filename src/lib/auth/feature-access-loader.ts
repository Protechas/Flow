import type { User } from "@/types/flow";
import {
  getHiddenEmployeeNavHrefs,
  getHiddenNavItemIds,
  resolveUserFeatureAccess,
  type UserFeatureAccessSnapshot,
} from "@/lib/auth/feature-access";
import { getUserPermissionOverrides } from "@/lib/data/permission-profiles-db";
import type { NavItemId } from "@/lib/auth/permissions";

export async function loadUserFeatureAccess(user: User): Promise<UserFeatureAccessSnapshot> {
  const overrides = await getUserPermissionOverrides(user.id);
  return resolveUserFeatureAccess(user, overrides);
}

export async function loadHiddenNavItemIds(user: User): Promise<NavItemId[]> {
  const snapshot = await loadUserFeatureAccess(user);
  return getHiddenNavItemIds(snapshot);
}

export async function loadHiddenEmployeeNavHrefs(user: User): Promise<string[]> {
  const snapshot = await loadUserFeatureAccess(user);
  return getHiddenEmployeeNavHrefs(snapshot);
}
