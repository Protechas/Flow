import {
  defaultHelpFlagSettings,
  mergeHelpFlagSettings,
  readGlobalHelpFlagSettings,
  readHelpFlagSettingsCookie,
  writeGlobalHelpFlagSettings,
} from "@/lib/help-flags/settings-persistence";
import type { HelpFlagSettings } from "@/types/flow";

let helpFlagSettings: HelpFlagSettings =
  readGlobalHelpFlagSettings() ?? defaultHelpFlagSettings();

export function getHelpFlagSettings(): HelpFlagSettings {
  return helpFlagSettings;
}

export function updateHelpFlagSettings(
  patch: Partial<
    Pick<HelpFlagSettings, "enabled" | "escalation_minutes" | "critical_idle_minutes">
  >,
  updatedBy: string
): HelpFlagSettings {
  helpFlagSettings = {
    ...helpFlagSettings,
    ...patch,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  };
  writeGlobalHelpFlagSettings(helpFlagSettings);
  return helpFlagSettings;
}

export async function hydrateHelpFlagSettings(): Promise<HelpFlagSettings> {
  const persisted = readGlobalHelpFlagSettings();
  if (!persisted) {
    helpFlagSettings = defaultHelpFlagSettings();
    writeGlobalHelpFlagSettings(helpFlagSettings);
  } else {
    helpFlagSettings = persisted;
  }

  const cookie = await readHelpFlagSettingsCookie();
  if (cookie) {
    helpFlagSettings = mergeHelpFlagSettings(helpFlagSettings, cookie);
    writeGlobalHelpFlagSettings(helpFlagSettings);
  }

  return helpFlagSettings;
}
