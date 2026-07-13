import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { getUserPrimaryDepartmentId } from "@/lib/departments/resolve";
import { getOrganizationalPosition } from "@/lib/auth/access-level";
import { isProductionRosterMember } from "@/lib/users/production-roster";
import { getReceivingTeamIds } from "@/lib/requests/settings";
import type { User } from "@/types/flow";

/**
 * Who receives (sees, claims, gets notified about) team requests.
 *
 * Owner-picked routing first: when receiving teams are configured
 * (Requests page → routing panel), only members of those teams receive —
 * e.g. "just the people under me on the SI team".
 *
 * Otherwise the rule derives from the org structure: requests route to
 * departments that carry production work (≥1 active project), so a
 * requester-only group like the Email Team is automatically submit-only.
 *
 * Fail-open: unresolvable users or an org with no project-owning
 * department fall back to everyone — pre-split behavior.
 */
export function receivingDepartmentIds(): Set<string> {
  initFlowStore();
  const store = getFlowStore();
  return new Set(
    store.projects
      .filter((p) => p.status === "active" && p.department_id)
      .map((p) => p.department_id as string)
  );
}

function eligibleRole(user: User): boolean {
  if (!user.is_active) return false;
  return isProductionRosterMember(user) || getOrganizationalPosition(user) === "team_lead";
}

export async function isTicketReceiver(user: User): Promise<boolean> {
  if (!eligibleRole(user)) return false;

  const receivingTeams = await getReceivingTeamIds();
  if (receivingTeams.length > 0) {
    return user.team_id != null && receivingTeams.includes(user.team_id);
  }

  const receiving = receivingDepartmentIds();
  if (receiving.size === 0) return true;
  const departmentId = getUserPrimaryDepartmentId(user.id);
  if (!departmentId) return true;
  return receiving.has(departmentId);
}

/** The notify list for a new ticket. */
export async function listTicketReceivers(users: User[]): Promise<User[]> {
  const receivingTeams = await getReceivingTeamIds();
  if (receivingTeams.length > 0) {
    return users.filter(
      (u) => eligibleRole(u) && u.team_id != null && receivingTeams.includes(u.team_id)
    );
  }

  const receiving = receivingDepartmentIds();
  return users.filter((u) => {
    if (!eligibleRole(u)) return false;
    if (receiving.size === 0) return true;
    const departmentId = getUserPrimaryDepartmentId(u.id);
    if (!departmentId) return true;
    return receiving.has(departmentId);
  });
}
