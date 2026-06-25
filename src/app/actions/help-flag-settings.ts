"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import {
  getHelpFlagSettings,
  hydrateHelpFlagSettings,
  updateHelpFlagSettings,
} from "@/lib/help-flags/hydrate";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { persistHelpFlagSettingsToSupabase } from "@/lib/settings/supabase-settings";

const PATHS = ["/settings", "/settings/help-flags", "/operations", "/people", "/alert-center"];

export async function getHelpFlagSettingsAction() {
  await hydrateHelpFlagSettings();
  return getHelpFlagSettings();
}

export async function updateHelpFlagSettingsAction(input: {
  enabled: boolean;
  escalation_minutes: number;
  critical_idle_minutes: number;
}) {
  const user = await requirePermission("settings:manage");
  await hydrateHelpFlagSettings();
  const settings = updateHelpFlagSettings(input, user.id);
  if (isSupabaseConfigured()) {
    await persistHelpFlagSettingsToSupabase(settings, user.id);
  }
  PATHS.forEach((p) => revalidatePath(p));
  return settings;
}
