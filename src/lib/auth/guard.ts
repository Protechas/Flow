import { getCurrentUser } from "@/lib/auth/session";
import { canAccessRoute, getDefaultRoute, type Permission } from "@/lib/auth/permissions";
import { hasPermission } from "@/lib/auth/permissions";
import { teamLeadCanViewPerson } from "@/lib/auth/team-scope";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { redirect } from "next/navigation";
import type { User } from "@/types/flow";

export async function requirePageAccess(pathname: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.is_active) redirect("/login");
  if (!canAccessRoute(user.role, pathname)) redirect("/unauthorized");
  return user;
}

export async function requirePagePermission(permission: Permission): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.is_active) redirect("/login");
  if (!hasPermission(user.role, permission)) redirect("/unauthorized");
  return user;
}

export async function requireOwnProfileOrTeam(profileUserId: string): Promise<User> {
  const user = await requirePageAccess("/people");
  if (hasPermission(user.role, "people:view_all")) return user;
  if (hasPermission(user.role, "people:view_own") && user.id === profileUserId) return user;
  if (hasPermission(user.role, "people:view_team")) {
    initFlowStore();
    const store = getFlowStore();
    if (teamLeadCanViewPerson(user, profileUserId, store.users, store.teams)) return user;
  }
  redirect(getDefaultRoute(user.role));
}
