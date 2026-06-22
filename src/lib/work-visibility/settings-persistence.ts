import { cookies } from "next/headers";
import { useSecureCookies } from "@/lib/auth/cookie-options";
import type { WorkVisibilitySettings } from "@/types/flow";

export const WORK_VISIBILITY_SETTINGS_COOKIE = "flow_work_visibility_settings";

const GLOBAL_KEY = "__flow_work_visibility_settings__";

type WorkVisibilitySettingsSnapshot = Pick<
  WorkVisibilitySettings,
  | "enabled"
  | "alerts_enabled"
  | "activity_gap_threshold_minutes"
  | "task_tracking_compliance_target_pct"
  | "daily_report_required"
  | "capacity_alert_threshold_pct"
  | "updated_at"
  | "updated_by"
>;

function globalScope(): Record<string, unknown> {
  return globalThis as typeof globalThis & Record<string, unknown>;
}

export function readGlobalWorkVisibilitySettings(): WorkVisibilitySettings | null {
  const value = globalScope()[GLOBAL_KEY];
  if (!value || typeof value !== "object") return null;
  return value as WorkVisibilitySettings;
}

export function writeGlobalWorkVisibilitySettings(settings: WorkVisibilitySettings): void {
  globalScope()[GLOBAL_KEY] = settings;
}

export function defaultWorkVisibilitySettings(): WorkVisibilitySettings {
  return {
    id: "work-visibility-settings",
    enabled: true,
    alerts_enabled: true,
    activity_gap_threshold_minutes: 15,
    task_tracking_compliance_target_pct: 85,
    daily_report_required: true,
    capacity_alert_threshold_pct: 85,
    updated_at: new Date().toISOString(),
    updated_by: null,
  };
}

export async function readWorkVisibilitySettingsCookie(): Promise<WorkVisibilitySettingsSnapshot | null> {
  const store = await cookies();
  const raw = store.get(WORK_VISIBILITY_SETTINGS_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WorkVisibilitySettingsSnapshot;
    if (typeof parsed.activity_gap_threshold_minutes !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeWorkVisibilitySettingsCookie(
  settings: WorkVisibilitySettings
): Promise<void> {
  const store = await cookies();
  const snapshot: WorkVisibilitySettingsSnapshot = {
    enabled: settings.enabled,
    alerts_enabled: settings.alerts_enabled,
    activity_gap_threshold_minutes: settings.activity_gap_threshold_minutes,
    task_tracking_compliance_target_pct: settings.task_tracking_compliance_target_pct,
    daily_report_required: settings.daily_report_required,
    capacity_alert_threshold_pct: settings.capacity_alert_threshold_pct,
    updated_at: settings.updated_at,
    updated_by: settings.updated_by ?? null,
  };
  store.set(WORK_VISIBILITY_SETTINGS_COOKIE, JSON.stringify(snapshot), {
    httpOnly: true,
    secure: useSecureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function mergeWorkVisibilitySettings(
  base: WorkVisibilitySettings,
  patch: Partial<WorkVisibilitySettingsSnapshot>
): WorkVisibilitySettings {
  return {
    ...base,
    ...patch,
    updated_at: patch.updated_at ?? base.updated_at,
    updated_by: patch.updated_by ?? base.updated_by,
  };
}
