"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { getForecastSettings, updateForecastSettings } from "@/lib/data/flow-store";
import { hydrateForecastSettings } from "@/lib/forecast/hydrate";
import { writeForecastSettingsCookie } from "@/lib/forecast/settings-persistence";
import { isSupabaseConfigured } from "@/lib/supabase/client";
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
  productive_hours_per_day: number;
  working_days: number[];
}) {
  const user = await requirePermission("settings:manage");
  await hydrateForecastSettings();

  const settings = updateForecastSettings(
    {
      minutes_per_document: input.minutes_per_document,
      productive_hours_per_day: input.productive_hours_per_day,
      working_days: [...input.working_days].sort((a, b) => a - b),
    },
    user.id
  );

  if (!isSupabaseConfigured()) {
    await writeForecastSettingsCookie(settings);
  }

  PATHS.forEach((p) => revalidatePath(p));
  return settings;
}
