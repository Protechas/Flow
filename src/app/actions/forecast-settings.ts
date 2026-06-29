"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { getEffectivePermissionRole } from "@/lib/auth/access-level";
import { hasPermission } from "@/lib/auth/permissions";
import { getForecastSettings, updateForecastSettings } from "@/lib/data/flow-store";
import { hydrateForecastSettings } from "@/lib/forecast/hydrate";
import { writeForecastSettingsCookie } from "@/lib/forecast/settings-persistence";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { persistForecastSettingsToSupabase } from "@/lib/settings/supabase-settings";
import { persistRecalculatedForecastsDb } from "@/lib/data/work-items-db";
import type { ForecastSettings } from "@/types/flow";

const PATHS = [
  "/settings",
  "/settings/forecasting",
  "/operations",
  "/projects",
  "/executive",
  "/reports",
  "/work",
  "/project-health",
];

export async function getForecastSettingsAction(): Promise<ForecastSettings> {
  await hydrateForecastSettings();
  return getForecastSettings();
}

export async function updateForecastSettingsAction(input: {
  minutes_per_document: number;
  productive_day_percent: number;
  working_days: number[];
}) {
  const user = await requireUser();
  const role = getEffectivePermissionRole(user);
  if (!hasPermission(role, "settings:manage") && !hasPermission(role, "settings:metrics")) {
    throw new Error("FORBIDDEN");
  }
  await hydrateForecastSettings();

  const settings = updateForecastSettings(
    {
      minutes_per_document: input.minutes_per_document,
      productive_day_percent: input.productive_day_percent,
      working_days: [...input.working_days].sort((a, b) => a - b),
    },
    user.id
  );

  if (!isSupabaseConfigured()) {
    await writeForecastSettingsCookie(settings);
  } else {
    await persistForecastSettingsToSupabase(settings, user.id);
    await persistRecalculatedForecastsDb();
  }

  PATHS.forEach((p) => revalidatePath(p));
  return settings;
}
