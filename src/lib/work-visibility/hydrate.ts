import {
  defaultWorkVisibilitySettings,
  mergeWorkVisibilitySettings,
  readGlobalWorkVisibilitySettings,
  readWorkVisibilitySettingsCookie,
  writeGlobalWorkVisibilitySettings,
} from "@/lib/work-visibility/settings-persistence";
import type { WorkVisibilitySettings } from "@/types/flow";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  hydrateWorkVisibilitySettingsFromSupabase,
  persistWorkVisibilitySettingsToSupabase,
} from "@/lib/settings/supabase-settings";

let hydratedFromSupabase = false;
let cookieHydrated = false;

export function getWorkVisibilitySettings(): WorkVisibilitySettings {
  return readGlobalWorkVisibilitySettings() ?? defaultWorkVisibilitySettings();
}

export async function hydrateWorkVisibilitySettings(): Promise<WorkVisibilitySettings> {
  if (isSupabaseConfigured()) {
    if (!hydratedFromSupabase) {
      const loaded = await hydrateWorkVisibilitySettingsFromSupabase();
      if (!loaded) {
        writeGlobalWorkVisibilitySettings(defaultWorkVisibilitySettings());
      }
      hydratedFromSupabase = true;
      return getWorkVisibilitySettings();
    }
    return getWorkVisibilitySettings();
  }

  if (cookieHydrated && readGlobalWorkVisibilitySettings()) {
    return getWorkVisibilitySettings();
  }

  let settings = defaultWorkVisibilitySettings();
  const fromCookie = await readWorkVisibilitySettingsCookie();
  if (fromCookie) {
    settings = mergeWorkVisibilitySettings(settings, fromCookie);
  }
  writeGlobalWorkVisibilitySettings(settings);
  cookieHydrated = true;
  return settings;
}

export function setWorkVisibilitySettings(settings: WorkVisibilitySettings): void {
  writeGlobalWorkVisibilitySettings(settings);
}

export async function persistWorkVisibilitySettings(
  settings: WorkVisibilitySettings,
  userId: string
): Promise<void> {
  if (isSupabaseConfigured()) {
    await persistWorkVisibilitySettingsToSupabase(settings, userId);
    return;
  }
  const { writeWorkVisibilitySettingsCookie } = await import(
    "@/lib/work-visibility/settings-persistence"
  );
  await writeWorkVisibilitySettingsCookie(settings);
}
