import { cookies } from "next/headers";
import { useSecureCookies } from "@/lib/auth/cookie-options";
import type { WorkloadAlertSettings } from "@/types/flow";

export const WORKLOAD_ALERT_SETTINGS_COOKIE = "flow_workload_alert_settings";

const GLOBAL_KEY = "__flow_workload_alert_settings__";

type WorkloadAlertSettingsSnapshot = Pick<
  WorkloadAlertSettings,
  | "enabled"
  | "work_remaining_threshold_hours"
  | "snooze_duration_hours"
  | "department_ids"
  | "team_ids"
  | "updated_at"
  | "updated_by"
>;

function globalScope(): Record<string, unknown> {
  return globalThis as typeof globalThis & Record<string, unknown>;
}

export function readGlobalWorkloadAlertSettings(): WorkloadAlertSettings | null {
  const value = globalScope()[GLOBAL_KEY];
  if (!value || typeof value !== "object") return null;
  return value as WorkloadAlertSettings;
}

export function writeGlobalWorkloadAlertSettings(settings: WorkloadAlertSettings): void {
  globalScope()[GLOBAL_KEY] = settings;
}

export function defaultWorkloadAlertSettings(): WorkloadAlertSettings {
  return {
    id: "workload-alert-settings",
    enabled: true,
    work_remaining_threshold_hours: 2,
    snooze_duration_hours: 24,
    department_ids: [],
    team_ids: [],
    updated_at: new Date().toISOString(),
    updated_by: null,
  };
}

export async function readWorkloadAlertSettingsCookie(): Promise<WorkloadAlertSettingsSnapshot | null> {
  const store = await cookies();
  const raw = store.get(WORKLOAD_ALERT_SETTINGS_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WorkloadAlertSettingsSnapshot;
    if (typeof parsed.work_remaining_threshold_hours !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeWorkloadAlertSettingsCookie(
  settings: WorkloadAlertSettings
): Promise<void> {
  const store = await cookies();
  const snapshot: WorkloadAlertSettingsSnapshot = {
    enabled: settings.enabled,
    work_remaining_threshold_hours: settings.work_remaining_threshold_hours,
    snooze_duration_hours: settings.snooze_duration_hours,
    department_ids: [...settings.department_ids],
    team_ids: [...settings.team_ids],
    updated_at: settings.updated_at,
    updated_by: settings.updated_by ?? null,
  };
  store.set(WORKLOAD_ALERT_SETTINGS_COOKIE, JSON.stringify(snapshot), {
    httpOnly: true,
    secure: useSecureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function mergeWorkloadAlertSettings(
  base: WorkloadAlertSettings,
  snapshot: WorkloadAlertSettingsSnapshot
): WorkloadAlertSettings {
  return {
    ...base,
    enabled: snapshot.enabled,
    work_remaining_threshold_hours: snapshot.work_remaining_threshold_hours,
    snooze_duration_hours: snapshot.snooze_duration_hours,
    department_ids: [...snapshot.department_ids],
    team_ids: [...snapshot.team_ids],
    updated_at: snapshot.updated_at,
    updated_by: snapshot.updated_by ?? null,
  };
}
