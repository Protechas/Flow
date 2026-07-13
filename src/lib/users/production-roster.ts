import { getOrganizationalPosition } from "@/lib/auth/access-level";
import { isEmployeeRole } from "@/lib/auth/permissions";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import type { User } from "@/types/flow";

/** Active production workforce (hourly/salary employees on the ops roster). */
export function isProductionEmployee(user: User): boolean {
  if (!user.is_active) return false;
  if (isEmployeeRole(user.role)) return true;
  return getOrganizationalPosition(user) === "employee";
}

/**
 * Production roster, team-aware: a support team (teams.is_production = false,
 * e.g. the Email Team) is excluded from production metrics — performance
 * scorecards, leaderboards, time-clock rosters, and ticket audiences — even
 * though its members are real employees. No team counts as production.
 */
export function isProductionRosterMember(user: User): boolean {
  if (!isProductionEmployee(user)) return false;
  if (!user.team_id) return true;
  initFlowStore();
  const team = getFlowStore().teams.find((t) => t.id === user.team_id);
  return team?.is_production !== false;
}
