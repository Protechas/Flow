import { getEffectivePermissionRole } from "@/lib/auth/access-level";
import { canAccessTeamDashboardPack } from "@/lib/team-dashboards/access";
import { listTeamDashboardPacks } from "@/lib/team-dashboards/packs";
import type { Team, User } from "@/types/flow";

export interface TeamDashboardNavItem {
  slug: string;
  href: string;
  label: string;
  icon: string;
  group: "dashboard" | "attention" | "operations" | "workforce" | "reporting" | "administration";
}

export function getTeamDashboardNavItemsForUser(
  user: User,
  teams: Team[],
  users: User[]
): TeamDashboardNavItem[] {
  return listTeamDashboardPacks()
    .filter((pack) => pack.nav && canAccessTeamDashboardPack(user, pack, teams, users))
    .map((pack) => ({
      slug: pack.slug,
      href: `/teams/${pack.slug}`,
      label: pack.nav!.label,
      icon: pack.nav!.icon,
      group: pack.nav!.group,
    }));
}

export function canAccessTeamDashboardRoute(
  user: User,
  slug: string,
  teams: Team[],
  users: User[]
): boolean {
  const pack = listTeamDashboardPacks().find((p) => p.slug === slug);
  if (!pack) return false;
  return canAccessTeamDashboardPack(user, pack, teams, users);
}

export function isTeamDashboardAdmin(user: User): boolean {
  const role = getEffectivePermissionRole(user);
  return role === "admin" || role === "super_admin";
}
