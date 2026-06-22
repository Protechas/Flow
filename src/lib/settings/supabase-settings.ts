import { applyForecastSettingsSnapshot, getForecastSettings } from "@/lib/data/flow-store";
import {
  defaultHelpFlagSettings,
  writeGlobalHelpFlagSettings,
} from "@/lib/help-flags/settings-persistence";
import {
  defaultWorkloadAlertSettings,
  writeGlobalWorkloadAlertSettings,
} from "@/lib/workload-alerts/settings-persistence";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type {
  ForecastSettings,
  HelpFlagSettings,
  WorkloadAlertSettings,
} from "@/types/flow";

/** Load org forecast settings from Supabase into the in-memory store. */
export async function hydrateForecastSettingsFromSupabase(): Promise<ForecastSettings | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("forecast_settings")
    .select("id, minutes_per_document, productive_hours_per_day, working_days, updated_at, updated_by")
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return applyForecastSettingsSnapshot({
    ...getForecastSettings(),
    id: data.id ?? getForecastSettings().id,
    minutes_per_document: Number(data.minutes_per_document),
    productive_hours_per_day: Number(data.productive_hours_per_day),
    working_days: (data.working_days as number[]) ?? [1, 2, 3, 4, 5],
    updated_at: data.updated_at ?? new Date().toISOString(),
    updated_by: data.updated_by ?? null,
  });
}

export async function persistForecastSettingsToSupabase(
  settings: ForecastSettings,
  userId: string
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("forecast_settings")
    .select("id")
    .limit(1)
    .maybeSingle();

  const row = {
    minutes_per_document: settings.minutes_per_document,
    productive_hours_per_day: settings.productive_hours_per_day,
    working_days: settings.working_days,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  if (existing?.id) {
    await supabase.from("forecast_settings").update(row).eq("id", existing.id);
  } else {
    await supabase.from("forecast_settings").insert(row);
  }
}

export async function hydrateWorkloadAlertSettingsFromSupabase(): Promise<WorkloadAlertSettings | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workload_alert_settings")
    .select(
      "id, enabled, work_remaining_threshold_hours, snooze_duration_hours, department_ids, team_ids, updated_at, updated_by"
    )
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const settings: WorkloadAlertSettings = {
    id: String(data.id ?? defaultWorkloadAlertSettings().id),
    enabled: Boolean(data.enabled),
    work_remaining_threshold_hours: Number(data.work_remaining_threshold_hours),
    snooze_duration_hours: Number(data.snooze_duration_hours),
    department_ids: (data.department_ids as string[]) ?? [],
    team_ids: (data.team_ids as string[]) ?? [],
    updated_at: data.updated_at ?? new Date().toISOString(),
    updated_by: data.updated_by ?? null,
  };

  writeGlobalWorkloadAlertSettings(settings);
  return settings;
}

export async function persistWorkloadAlertSettingsToSupabase(
  settings: WorkloadAlertSettings,
  userId: string
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("workload_alert_settings")
    .select("id")
    .limit(1)
    .maybeSingle();

  const row = {
    enabled: settings.enabled,
    work_remaining_threshold_hours: settings.work_remaining_threshold_hours,
    snooze_duration_hours: settings.snooze_duration_hours,
    department_ids: settings.department_ids,
    team_ids: settings.team_ids,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  if (existing?.id) {
    await supabase.from("workload_alert_settings").update(row).eq("id", existing.id);
  } else {
    await supabase.from("workload_alert_settings").insert(row);
  }
}

export async function hydrateHelpFlagSettingsFromSupabase(): Promise<HelpFlagSettings | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("help_flag_settings")
    .select("id, enabled, escalation_minutes, critical_idle_minutes, updated_at, updated_by")
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const settings: HelpFlagSettings = {
    id: String(data.id ?? defaultHelpFlagSettings().id),
    enabled: Boolean(data.enabled),
    escalation_minutes: Number(data.escalation_minutes),
    critical_idle_minutes: Number(data.critical_idle_minutes),
    updated_at: data.updated_at ?? new Date().toISOString(),
    updated_by: data.updated_by ?? null,
  };

  writeGlobalHelpFlagSettings(settings);
  return settings;
}

export async function persistHelpFlagSettingsToSupabase(
  settings: HelpFlagSettings,
  userId: string
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("help_flag_settings")
    .select("id")
    .limit(1)
    .maybeSingle();

  const row = {
    enabled: settings.enabled,
    escalation_minutes: settings.escalation_minutes,
    critical_idle_minutes: settings.critical_idle_minutes,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  if (existing?.id) {
    await supabase.from("help_flag_settings").update(row).eq("id", existing.id);
  } else {
    await supabase.from("help_flag_settings").insert(row);
  }
}

export function defaultWorkloadSettingsIfMissing(): WorkloadAlertSettings {
  const settings = defaultWorkloadAlertSettings();
  writeGlobalWorkloadAlertSettings(settings);
  return settings;
}

export function defaultHelpFlagSettingsIfMissing(): HelpFlagSettings {
  const settings = defaultHelpFlagSettings();
  writeGlobalHelpFlagSettings(settings);
  return settings;
}
