import { canAccessRoute, getDefaultRoute, normalizeRole } from "@/lib/auth/permissions";
import { MOCK_USERS } from "@/lib/data/mock-data";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { UserRole } from "@/types/flow";

export function getDemoRoleFromUserId(userId: string | undefined): UserRole | null {
  if (!userId) return null;
  const user = MOCK_USERS.find((u) => u.id === userId);
  return user ? normalizeRole(user.role) : null;
}

export function shouldProtectRoute(pathname: string): boolean {
  if (pathname.startsWith("/login") || pathname.startsWith("/auth")) return false;
  if (pathname === "/") return false;
  return true;
}

export function roleCanAccessPath(role: UserRole, pathname: string): boolean {
  if (pathname.startsWith("/people/")) {
    if (canAccessRoute(role, "/people")) return true;
    return canAccessRoute(role, pathname);
  }
  return canAccessRoute(role, pathname);
}

export function redirectPathForRole(role: UserRole): string {
  return getDefaultRoute(role);
}

export { isSupabaseConfigured };
