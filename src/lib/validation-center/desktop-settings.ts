import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { SiLibraryAuditSettings } from "@/lib/validation-center/types";

/** Load settings from the legacy desktop SI Audit Tool (%LOCALAPPDATA%). */
export function loadDesktopSiLibrarySettings(): Partial<SiLibraryAuditSettings> | null {
  const settingsPath = join(
    homedir(),
    "AppData",
    "Local",
    "ProTech_SI_Audit_Tool",
    "settings.json"
  );
  if (!existsSync(settingsPath)) return null;

  try {
    const raw = JSON.parse(readFileSync(settingsPath, "utf8")) as Record<string, unknown>;
    const { version: _version, ...settings } = raw;
    return settings as Partial<SiLibraryAuditSettings>;
  } catch {
    return null;
  }
}
