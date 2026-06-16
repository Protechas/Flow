import { cookies } from "next/headers";
import { useSecureCookies } from "@/lib/auth/cookie-options";
import { MOCK_FORECAST_SETTINGS } from "@/lib/data/mock-data";
import type { ForecastSettings } from "@/types/flow";

export const FORECAST_SETTINGS_COOKIE = "flow_forecast_settings";

const GLOBAL_KEY = "__flow_forecast_settings__";

type ForecastSettingsSnapshot = Pick<
  ForecastSettings,
  "minutes_per_document" | "productive_hours_per_day" | "working_days" | "updated_at" | "updated_by"
>;

function globalScope(): Record<string, unknown> {
  return globalThis as typeof globalThis & Record<string, unknown>;
}

export function readGlobalForecastSettings(): ForecastSettings | null {
  const value = globalScope()[GLOBAL_KEY];
  if (!value || typeof value !== "object") return null;
  return value as ForecastSettings;
}

export function writeGlobalForecastSettings(settings: ForecastSettings): void {
  globalScope()[GLOBAL_KEY] = settings;
}

export function defaultForecastSettings(): ForecastSettings {
  return { ...MOCK_FORECAST_SETTINGS };
}

export async function readForecastSettingsCookie(): Promise<ForecastSettingsSnapshot | null> {
  const store = await cookies();
  const raw = store.get(FORECAST_SETTINGS_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ForecastSettingsSnapshot;
    if (
      typeof parsed.minutes_per_document !== "number" ||
      typeof parsed.productive_hours_per_day !== "number" ||
      !Array.isArray(parsed.working_days)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function writeForecastSettingsCookie(settings: ForecastSettings): Promise<void> {
  const store = await cookies();
  const snapshot: ForecastSettingsSnapshot = {
    minutes_per_document: settings.minutes_per_document,
    productive_hours_per_day: settings.productive_hours_per_day,
    working_days: settings.working_days,
    updated_at: settings.updated_at,
    updated_by: settings.updated_by ?? null,
  };
  store.set(FORECAST_SETTINGS_COOKIE, JSON.stringify(snapshot), {
    httpOnly: true,
    secure: useSecureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearForecastSettingsCookie(): Promise<void> {
  const store = await cookies();
  store.delete(FORECAST_SETTINGS_COOKIE);
}

export function mergeForecastSettings(
  base: ForecastSettings,
  snapshot: ForecastSettingsSnapshot
): ForecastSettings {
  return {
    ...base,
    minutes_per_document: snapshot.minutes_per_document,
    productive_hours_per_day: snapshot.productive_hours_per_day,
    working_days: [...snapshot.working_days].sort((a, b) => a - b),
    updated_at: snapshot.updated_at,
    updated_by: snapshot.updated_by ?? null,
  };
}

export function isForecastSettingsStale(
  current: ForecastSettings,
  snapshot: ForecastSettingsSnapshot
): boolean {
  return (
    current.minutes_per_document !== snapshot.minutes_per_document ||
    current.productive_hours_per_day !== snapshot.productive_hours_per_day ||
    current.updated_at !== snapshot.updated_at ||
    JSON.stringify([...current.working_days].sort()) !==
      JSON.stringify([...snapshot.working_days].sort())
  );
}
