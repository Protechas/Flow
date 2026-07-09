import { canAccessPathWithFeatureAccess, hasFeaturePermission } from "@/lib/auth/feature-access";
import { loadUserFeatureAccess } from "@/lib/auth/feature-access-loader";
import { getEffectivePermissionRole, hasAdminAccess } from "@/lib/auth/access-level";
import { canAccessRoute, getDefaultRoute, hasPermission, type Permission } from "@/lib/auth/permissions";
import {
  isEmployeePreviewActive,
  isEmployeePreviewRoute,
} from "@/lib/auth/employee-preview";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserPermissionOverrides } from "@/lib/data/permission-profiles-db";
import { canViewerSeeUser } from "@/lib/auth/team-scope";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { getDailyWrapUpById, getFlowStore } from "@/lib/data/flow-store";
import { canViewWrapUp } from "@/lib/wrap-up/review";
import { notFound, redirect } from "next/navigation";
import type { Team, User, WorkPackage } from "@/types/flow";

export async function requirePageAccess(pathname: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.is_active) redirect("/login");

  // Leads/managers in employee-preview mode may open the employee shell —
  // their own identity, the employee surface only.
  const previewBypass =
    isEmployeePreviewRoute(pathname) &&
    getEffectivePermissionRole(user) !== "employee" &&
    (await isEmployeePreviewActive());

  if (!previewBypass) {
    if (!canAccessRoute(getEffectivePermissionRole(user), pathname)) redirect("/unauthorized");

    const snapshot = await loadUserFeatureAccess(user);
    if (!canAccessPathWithFeatureAccess(snapshot, pathname)) redirect("/unauthorized");
  }

  await ensureAppDataLoaded();
  return user;
}

export async function requirePagePermission(permission: Permission): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.is_active) redirect("/login");
  if (!hasPermission(getEffectivePermissionRole(user), permission)) redirect("/unauthorized");
  await ensureAppDataLoaded();
  return user;
}

export async function requireFeaturePermission(
  moduleId: string,
  permissionKey: string
): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.is_active) redirect("/login");

  const overrides = await getUserPermissionOverrides(user.id);
  if (!hasFeaturePermission(user, moduleId, permissionKey, overrides)) {
    redirect("/unauthorized");
  }

  await ensureAppDataLoaded();
  return user;
}

export async function requireOwnProfileOrTeam(profileUserId: string): Promise<User> {
  const user = await requirePageAccess("/people");
  const permissionRole = getEffectivePermissionRole(user);
  if (hasPermission(permissionRole, "people:view_all")) return user;
  if (hasPermission(permissionRole, "people:view_own") && user.id === profileUserId) return user;
  if (hasPermission(permissionRole, "people:view_team")) {
    const store = getFlowStore();
    if (canViewerSeeUser(user, profileUserId, store.users, store.teams)) return user;
  }
  redirect(getDefaultRoute(permissionRole));
}

/** Block deep links to users outside hierarchy scope (admins bypass). */
export async function requireHierarchyUserAccess(targetUserId: string): Promise<User> {
  const user = await requirePageAccess("/people");
  if (user.id === targetUserId) return user;
  if (hasAdminAccess(user)) return user;
  const store = getFlowStore();
  if (canViewerSeeUser(user, targetUserId, store.users, store.teams)) return user;
  redirect("/unauthorized");
}

/** Hierarchy scope check without route-specific page access. */
export async function assertUserInHierarchyScope(viewer: User, targetUserId: string): Promise<void> {
  if (viewer.id === targetUserId) return;
  if (hasAdminAccess(viewer)) return;
  await ensureAppDataLoaded();
  const store = getFlowStore();
  if (canViewerSeeUser(viewer, targetUserId, store.users, store.teams)) return;
  redirect("/unauthorized");
}

/** Validate optional userId deep-link query param against hierarchy scope. */
export async function assertScopedUserIdParam(
  viewer: User,
  targetUserId: string | undefined | null,
  visibleUserIds?: string[]
): Promise<void> {
  const trimmed = targetUserId?.trim();
  if (!trimmed) return;
  if (visibleUserIds && !visibleUserIds.includes(trimmed)) {
    redirect("/unauthorized");
  }
  await assertUserInHierarchyScope(viewer, trimmed);
}

export function canAccessWorkPackage(
  viewer: User,
  pkg: WorkPackage,
  users: User[],
  teams: Team[]
): boolean {
  const permissionRole = getEffectivePermissionRole(viewer);

  if (pkg.assigned_to === viewer.id) {
    return hasPermission(permissionRole, "work:view_own");
  }

  if (hasAdminAccess(viewer)) return true;

  if (!pkg.assigned_to) {
    return hasPermission(permissionRole, "work:view_all");
  }

  if (!canViewerSeeUser(viewer, pkg.assigned_to, users, teams)) return false;

  return (
    hasPermission(permissionRole, "work:view_all") ||
    hasPermission(permissionRole, "work:view_team")
  );
}

/** Block deep links to work packages outside hierarchy scope. */
export async function requireWorkPackageAccess(
  taskId: string,
  routePath: "/work" | "/operations" | "/qa-center" = "/work"
): Promise<{ user: User; pkg: WorkPackage }> {
  const user = await requirePageAccess(routePath);
  const store = getFlowStore();
  const pkg = store.workPackages.find((p) => p.id === taskId);
  if (!pkg) notFound();
  if (!canAccessWorkPackage(user, pkg, store.users, store.teams)) {
    redirect("/unauthorized");
  }
  return { user, pkg };
}

/** Block deep links to wrap-up records outside hierarchy scope. */
export async function requireWrapUpAccess(wrapUpId: string): Promise<User> {
  const user = await requirePageAccess("/wrap-ups");
  const wrapUp = getDailyWrapUpById(wrapUpId);
  if (!wrapUp) notFound();
  if (!canViewWrapUp(user, wrapUp)) redirect("/unauthorized");
  return user;
}
