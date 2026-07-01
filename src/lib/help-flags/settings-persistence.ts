import { cookies } from "next/headers";
import { shouldUseSecureCookies } from "@/lib/auth/cookie-options";
import type { HelpFlagSettings } from "@/types/flow";

export const HELP_FLAG_SETTINGS_COOKIE = "flow_help_flag_settings";

const GLOBAL_KEY = "__flow_help_flag_settings__";

type HelpFlagSettingsSnapshot = Pick<
  HelpFlagSettings,
  "enabled" | "escalation_minutes" | "critical_idle_minutes" | "updated_at" | "updated_by"
>;

function globalScope(): Record<string, unknown> {
  return globalThis as typeof globalThis & Record<string, unknown>;
}

export function readGlobalHelpFlagSettings(): HelpFlagSettings | null {
  const value = globalScope()[GLOBAL_KEY];
  if (!value || typeof value !== "object") return null;
  return value as HelpFlagSettings;
}

export function writeGlobalHelpFlagSettings(settings: HelpFlagSettings): void {
  globalScope()[GLOBAL_KEY] = settings;
}

export function defaultHelpFlagSettings(): HelpFlagSettings {
  return {
    id: "help-flag-settings",
    enabled: true,
    escalation_minutes: 30,
    critical_idle_minutes: 60,
    updated_at: new Date().toISOString(),
    updated_by: null,
  };
}

export async function readHelpFlagSettingsCookie(): Promise<HelpFlagSettingsSnapshot | null> {
  const store = await cookies();
  const raw = store.get(HELP_FLAG_SETTINGS_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as HelpFlagSettingsSnapshot;
  } catch {
    return null;
  }
}

export async function writeHelpFlagSettingsCookie(
  settings: HelpFlagSettings
): Promise<void> {
  const store = await cookies();
  const snapshot: HelpFlagSettingsSnapshot = {
    enabled: settings.enabled,
    escalation_minutes: settings.escalation_minutes,
    critical_idle_minutes: settings.critical_idle_minutes,
    updated_at: settings.updated_at,
    updated_by: settings.updated_by ?? null,
  };
  store.set(HELP_FLAG_SETTINGS_COOKIE, JSON.stringify(snapshot), {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function mergeHelpFlagSettings(
  base: HelpFlagSettings,
  snapshot: HelpFlagSettingsSnapshot
): HelpFlagSettings {
  return { ...base, ...snapshot, updated_by: snapshot.updated_by ?? null };
}
