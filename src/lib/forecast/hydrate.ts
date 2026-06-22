import type { ForecastSettings } from "@/types/flow";
import {
  applyForecastSettingsSnapshot,
  getForecastSettings,
} from "@/lib/data/flow-store";
import {
  isForecastSettingsStale,
  mergeForecastSettings,
  readForecastSettingsCookie,
  readGlobalForecastSettings,
} from "@/lib/forecast/settings-persistence";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { hydrateForecastSettingsFromSupabase } from "@/lib/settings/supabase-settings";

let hydratedFromCookie = false;
let hydratedFromSupabase = false;

/** Load persisted demo forecast settings into the in-memory store. */
export async function hydrateForecastSettings(): Promise<ForecastSettings> {
  getForecastSettings();

  if (isSupabaseConfigured()) {
    if (!hydratedFromSupabase) {
      await hydrateForecastSettingsFromSupabase();
      hydratedFromSupabase = true;
    }
    return getForecastSettings();
  }

  const cookie = await readForecastSettingsCookie();
  if (!cookie) {
    return getForecastSettings();
  }

  const current = getForecastSettings();
  const global = readGlobalForecastSettings();
  if (!hydratedFromCookie || isForecastSettingsStale(current, cookie)) {
    const merged = mergeForecastSettings(global ?? current, cookie);
    applyForecastSettingsSnapshot(merged);
    hydratedFromCookie = true;
  }

  return getForecastSettings();
}
