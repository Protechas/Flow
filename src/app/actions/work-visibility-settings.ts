"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import {
  getWorkVisibilitySettings,
  hydrateWorkVisibilitySettings,
  persistWorkVisibilitySettings,
  setWorkVisibilitySettings,
} from "@/lib/work-visibility/hydrate";
import { writeWorkVisibilitySettingsCookie } from "@/lib/work-visibility/settings-persistence";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { WorkVisibilitySettings } from "@/types/flow";

const PATHS = [
  "/settings",
  "/settings/work-visibility",
  "/executive",
  "/reports",
  "/reports/work-visibility",
  "/alert-center",
  "/work",
];

export async function getWorkVisibilitySettingsAction(): Promise<WorkVisibilitySettings> {
  await requirePermission("settings:manage");
  await hydrateWorkVisibilitySettings();
  return getWorkVisibilitySettings();
}

export async function updateWorkVisibilitySettingsAction(input: {
  enabled: boolean;
  alerts_enabled: boolean;
  activity_gap_threshold_minutes: number;
  task_tracking_compliance_target_pct: number;
  daily_report_required: boolean;
  capacity_alert_threshold_pct: number;
}) {
  const user = await requirePermission("settings:manage");
  await hydrateWorkVisibilitySettings();
  const current = getWorkVisibilitySettings();
  const next: WorkVisibilitySettings = {
    ...current,
    ...input,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };
  setWorkVisibilitySettings(next);
  if (isSupabaseConfigured()) {
    await persistWorkVisibilitySettings(next, user.id);
  } else {
    await writeWorkVisibilitySettingsCookie(next);
  }
  PATHS.forEach((p) => revalidatePath(p));
  return next;
}
