import { DEMO_USER_ID, MOCK_USERS } from "@/lib/data/mock-data";
import { getDemoUser } from "@/lib/auth/demo-session";
import { getTeamMemberIds } from "@/lib/auth/team-scope";
import { getAssignableUserIds } from "@/lib/hierarchy/resolver";
import { getEffectivePermissionRole } from "@/lib/auth/access-level";
import { normalizeRole } from "@/lib/auth/permissions";
import type { Permission } from "@/lib/auth/permissions";
import { hasPermission } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import { getFlowStore, initFlowStore, listDepartmentUsers, listTeamsStore } from "@/lib/data/flow-store";
import { isUserProductionReady } from "@/lib/setup/account";
import { listWorkPackages } from "@/lib/data/work-packages";
import type { User, UserRole } from "@/types/flow";

export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) {
    const demo = await getDemoUser();
    if (demo) return demo;
    const fallback = MOCK_USERS.find((u) => u.id === DEMO_USER_ID) ?? MOCK_USERS[1];
    return fallback ? { ...fallback, role: normalizeRole(fallback.role) } : null;
  }

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { getUserProfileByAuthId } = await import("@/lib/data/users");
  const profile = await getUserProfileByAuthId(authUser.id);
  if (!profile || !profile.is_active) return null;
  return profile;
}

/** Auth only — no full org hydrate (notification bell, lightweight actions). */
export async function requireAuthenticatedUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireUser(): Promise<User> {
  if (isSupabaseConfigured()) {
    const { ensureAppDataLoaded } = await import("@/lib/data/app-hydrate");
    await ensureAppDataLoaded();
  }
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requirePermission(permission: Permission): Promise<User> {
  const user = await requireUser();
  if (!hasPermission(getEffectivePermissionRole(user), permission)) throw new Error("FORBIDDEN");
  return user;
}

async function storeUsersForSession(): Promise<User[]> {
  const { ensureAppDataLoaded } = await import("@/lib/data/app-hydrate");
  await ensureAppDataLoaded();
  const { getFlowStore } = await import("@/lib/data/flow-store");
  return getFlowStore().users;
}

export async function assertCanEditWorkPackage(
  user: User,
  workPackageId: string
): Promise<void> {
  const role = normalizeRole(user.role);

  if (role === "teamlead") {
    initFlowStore();
    const pkg = listWorkPackages().find((p) => p.id === workPackageId);
    const users = await storeUsersForSession();
    const teamIds = getTeamMemberIds(user, users, getFlowStore().teams);
    if (pkg && (!pkg.assigned_to || teamIds.includes(pkg.assigned_to))) return;
    throw new Error("FORBIDDEN");
  }

  if (hasPermission(role, "work:edit")) return;

  if (hasPermission(role, "work:edit_own")) {
    initFlowStore();
    const pkg = listWorkPackages().find((p) => p.id === workPackageId);
    if (pkg?.assigned_to === user.id) return;
    throw new Error("FORBIDDEN");
  }

  throw new Error("FORBIDDEN");
}

export async function assertCanViewTaskFile(
  user: User,
  taskId: string
): Promise<void> {
  const role = normalizeRole(user.role);

  if (hasPermission(role, "work:view_all")) return;
  if (hasPermission(role, "qa:view") || hasPermission(role, "qa:review")) return;

  await assertCanEditWorkPackage(user, taskId);
}

export async function assertCanAssignWorkPackage(
  user: User,
  assignedTo: string | null
): Promise<void> {
  const role = normalizeRole(user.role);

  if (assignedTo) {
    initFlowStore();
    const users = await storeUsersForSession();
    const assignee = users.find((u) => u.id === assignedTo);
    if (
      assignee &&
      !isUserProductionReady(assignee, listDepartmentUsers(), listTeamsStore())
    ) {
      throw new Error("ASSIGNEE_SETUP_INCOMPLETE");
    }
  }

  if (role === "teamlead" || role === "manager" || role === "senior_manager") {
    if (!assignedTo) return;
    initFlowStore();
    const users = await storeUsersForSession();
    const assignable = getAssignableUserIds(user, users, getFlowStore().teams);
    if (assignable.includes(assignedTo)) return;
    throw new Error("FORBIDDEN");
  }

  if (hasPermission(role, "work:assign")) return;
  if (hasPermission(role, "work:edit_own") && assignedTo === user.id) return;
  throw new Error("FORBIDDEN");
}

export { normalizeRole };

export function canManageWork(role: UserRole | string): boolean {
  const r = normalizeRole(role);
  return ["admin", "manager", "teamlead"].includes(r);
}

export function canReviewQa(role: UserRole | string): boolean {
  return hasPermission(role, "qa:review");
}

export function isEmployeeRole(role: UserRole | string): boolean {
  return normalizeRole(role) === "employee";
}

export function isEmployeeUser(user: User): boolean {
  return isEmployeeRole(getEffectivePermissionRole(user));
}
