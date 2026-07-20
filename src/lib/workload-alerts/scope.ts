import type { WorkloadAlertSettings } from "@/types/flow";

export type AlertScopeTarget = {
  userId: string;
  departmentId: string | null;
  teamId: string | null;
};

/**
 * Whether a person is in scope to GENERATE alerts (workload + activity gaps).
 * Empty dept/team lists mean "everyone"; excluded_user_ids always wins.
 */
export function passesAlertScope(
  settings: Pick<
    WorkloadAlertSettings,
    "department_ids" | "team_ids" | "excluded_user_ids"
  >,
  target: AlertScopeTarget
): boolean {
  if ((settings.excluded_user_ids ?? []).includes(target.userId)) return false;
  if (settings.department_ids.length > 0) {
    if (!target.departmentId || !settings.department_ids.includes(target.departmentId)) {
      return false;
    }
  }
  if (settings.team_ids.length > 0) {
    if (!target.teamId || !settings.team_ids.includes(target.teamId)) {
      return false;
    }
  }
  return true;
}
