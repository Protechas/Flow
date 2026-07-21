import type { TeamOperatingModel } from "@/lib/operating-models/types";
import type { User } from "@/types/flow";

/** Roles allowed to file a team's weekly manager update. */
const MANAGER_ROLES = new Set(["manager", "senior_manager", "admin", "super_admin"]);

/** yyyy-MM-dd of the Friday in the same Mon–Sun week as the given app date. */
export function weekOfFriday(appDate: string): string {
  const [y, m, d] = appDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay(); // 0=Sun … 6=Sat
  // Monday-based week: Sunday belongs to the week that started 6 days earlier.
  const sinceMonday = (dow + 6) % 7;
  date.setUTCDate(date.getUTCDate() - sinceMonday + 4);
  return date.toISOString().slice(0, 10);
}

export function isFridayAppDate(appDate: string): boolean {
  const [y, m, d] = appDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 5;
}

/**
 * Whether this user files the weekly manager update for their team.
 * Requires a team whose operating model enables it and a manager-level role.
 */
export function canSubmitManagerUpdate(
  user: Pick<User, "role" | "team_id">,
  model: TeamOperatingModel
): boolean {
  if (!user.team_id) return false;
  if (!MANAGER_ROLES.has(user.role)) return false;
  if (model.managerUpdate?.enabled !== true) return false;
  return (model.managerUpdate.fields ?? []).length > 0;
}
