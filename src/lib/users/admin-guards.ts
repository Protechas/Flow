import { hasAdminAccess } from "@/lib/auth/access-level";
import type { User } from "@/types/flow";

export function countActiveAdmins(users: User[]): number {
  return users.filter((u) => u.is_active && hasAdminAccess(u)).length;
}

/**
 * Block self-removal and removing the last active administrator.
 * Used for delete, deactivate, and profile saves that set is_active=false.
 */
export function assertCanRemoveOrDeactivateUser(
  actorId: string,
  target: User,
  users: User[],
  action: "delete" | "deactivate"
): void {
  if (actorId === target.id) {
    throw new Error(
      action === "delete"
        ? "You cannot delete your own account"
        : "You cannot deactivate your own account"
    );
  }

  if (!target.is_active || !hasAdminAccess(target)) return;

  if (countActiveAdmins(users) <= 1) {
    throw new Error("Cannot remove or deactivate the last administrator");
  }
}

/**
 * Block self-demotion and removing admin access from the last active administrator.
 * Used when role or system access level changes away from admin.
 */
export function assertCanChangeUserAdminAccess(
  actorId: string,
  target: User,
  users: User[],
  willHaveAdminAccess: boolean
): void {
  if (willHaveAdminAccess || !target.is_active || !hasAdminAccess(target)) return;

  if (actorId === target.id) {
    throw new Error("You cannot remove your own administrator access");
  }

  if (countActiveAdmins(users) <= 1) {
    throw new Error("Cannot remove the last administrator access");
  }
}
