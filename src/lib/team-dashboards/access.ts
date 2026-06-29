import { getEffectivePermissionRole, hasAdminAccess } from "@/lib/auth/access-level";
import { hasPermission } from "@/lib/auth/permissions";
import { canViewerSeeUser } from "@/lib/auth/team-scope";
import { resolveTeamForPack } from "@/lib/team-dashboards/resolve";
import type { TeamDashboardPack } from "@/lib/team-dashboards/types";
import type { Team, User } from "@/types/flow";

export function canAccessTeamDashboardPack(
  user: User,
  pack: TeamDashboardPack,
  teams: Team[],
  users: User[]
): boolean {
  if (!user.is_active) return false;
  if (hasAdminAccess(user)) return true;

  const role = getEffectivePermissionRole(user);
  const team = resolveTeamForPack(pack, teams);

  if (team) {
    if (pack.access.teamMembers && user.team_id === team.id) return true;
    if (pack.access.teamLeads && team.manager_id === user.id) return true;
    if (pack.access.teamLeads && team.team_lead_user_id === user.id) return true;
  }

  if (!pack.access.roles.includes(role)) return false;

  if (!team) {
    return hasPermission(role, "dashboard:view");
  }

  if (hasPermission(role, "people:view_all") || hasPermission(role, "reports:view_all")) {
    return true;
  }

  if (hasPermission(role, "people:view_team") || hasPermission(role, "reports:view_team")) {
    const memberIds = users.filter((u) => u.team_id === team.id).map((u) => u.id);
    return memberIds.some((id) => canViewerSeeUser(user, id, users, teams));
  }

  return hasPermission(role, "dashboard:view");
}
