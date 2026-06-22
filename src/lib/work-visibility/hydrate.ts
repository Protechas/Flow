import {
  defaultWorkVisibilitySettings,
  mergeWorkVisibilitySettings,
  readGlobalWorkVisibilitySettings,
  readWorkVisibilitySettingsCookie,
  writeGlobalWorkVisibilitySettings,
} from "@/lib/work-visibility/settings-persistence";
import type { WorkVisibilitySettings } from "@/types/flow";

let hydrated = false;

export function getWorkVisibilitySettings(): WorkVisibilitySettings {
  return readGlobalWorkVisibilitySettings() ?? defaultWorkVisibilitySettings();
}

export async function hydrateWorkVisibilitySettings(): Promise<WorkVisibilitySettings> {
  if (hydrated && readGlobalWorkVisibilitySettings()) {
    return getWorkVisibilitySettings();
  }

  let settings = defaultWorkVisibilitySettings();
  const fromCookie = await readWorkVisibilitySettingsCookie();
  if (fromCookie) {
    settings = mergeWorkVisibilitySettings(settings, fromCookie);
  }

  writeGlobalWorkVisibilitySettings(settings);
  hydrated = true;
  return settings;
}

export function setWorkVisibilitySettings(settings: WorkVisibilitySettings): void {
  writeGlobalWorkVisibilitySettings(settings);
  hydrated = true;
}
