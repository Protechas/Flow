import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { getUserPrimaryDepartmentId } from "@/lib/departments/resolve";
import { getOrganizationalPosition } from "@/lib/auth/access-level";
import { isProductionEmployee } from "@/lib/users/production-roster";
import type { User } from "@/types/flow";

/**
 * Who receives (sees, claims, gets notified about) team requests.
 *
 * Rule: requests route to the departments that carry production work —
 * a department with at least one active project. A requester-only group
 * like the Email Team (no projects) automatically becomes submit-only:
 * its members never see claim buttons for their own team's asks.
 *
 * Fail-open: users whose department can't be resolved, or an org where no
 * department owns a project yet, fall back to everyone — same behavior as
 * before departments split.
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

export function isTicketReceiver(user: User): boolean {
  if (!user.is_active) return false;
  if (!isProductionEmployee(user) && getOrganizationalPosition(user) !== "team_lead") {
    return false;
  }
  const receiving = receivingDepartmentIds();
  if (receiving.size === 0) return true;
  const departmentId = getUserPrimaryDepartmentId(user.id);
  if (!departmentId) return true;
  return receiving.has(departmentId);
}

/** The notify list for a new ticket. */
export function listTicketReceivers(users: User[]): User[] {
  return users.filter(isTicketReceiver);
}
