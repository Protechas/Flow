import { DEMO_USER_ID, MOCK_USERS } from "@/lib/data/mock-data";
import { getDemoUser } from "@/lib/auth/demo-session";
import { normalizeRole } from "@/lib/auth/permissions";
import type { Permission } from "@/lib/auth/permissions";
import { hasPermission } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
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

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requirePermission(permission: Permission): Promise<User> {
  const user = await requireUser();
  if (!hasPermission(user.role, permission)) throw new Error("FORBIDDEN");
  return user;
}

export async function assertCanEditWorkPackage(
  user: User,
  workPackageId: string
): Promise<void> {
  const role = normalizeRole(user.role);
  if (hasPermission(role, "work:edit")) return;

  if (hasPermission(role, "work:edit_own")) {
    initFlowStore();
    const pkg = getFlowStore().workPackages.find((p) => p.id === workPackageId);
    if (pkg?.assigned_to === user.id) return;
    throw new Error("FORBIDDEN");
  }

  throw new Error("FORBIDDEN");
}

export async function assertCanAssignWorkPackage(
  user: User,
  assignedTo: string | null
): Promise<void> {
  const role = normalizeRole(user.role);
  if (hasPermission(role, "work:assign")) return;
  if (hasPermission(role, "work:edit_own") && assignedTo === user.id) return;
  throw new Error("FORBIDDEN");
}

export { normalizeRole };

export function canManageWork(role: UserRole | string): boolean {
  const r = normalizeRole(role);
  return ["admin", "manager"].includes(r);
}

export function canReviewQa(role: UserRole | string): boolean {
  return hasPermission(role, "qa:review");
}

export function isEmployeeRole(role: UserRole | string): boolean {
  return normalizeRole(role) === "employee";
}
