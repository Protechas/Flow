import { getOrganizationalPosition } from "@/lib/auth/access-level";
import { isEmployeeRole } from "@/lib/auth/permissions";
import type { User } from "@/types/flow";

/** Active production workforce (hourly/salary employees on the ops roster). */
export function isProductionEmployee(user: User): boolean {
  if (!user.is_active) return false;
  if (isEmployeeRole(user.role)) return true;
  return getOrganizationalPosition(user) === "employee";
}
