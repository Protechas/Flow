import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Monday.com era baseline rows — weekly per-person aggregates imported once
 * from the account export. Read-only report data for /roi; no live engine
 * (scorecards, forecasts, coaching) reads this table.
 */
export interface LegacyMetricRow {
  person_name: string;
  week_start: string | null;
  category: string;
  items_done: number;
  clock_seconds: number;
  items_with_clock: number;
}

export async function listLegacyMetrics(source = "monday"): Promise<LegacyMetricRow[]> {
  if (!isSupabaseConfigured() || !isAdminConfigured()) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("legacy_metrics")
    .select("person_name, week_start, category, items_done, clock_seconds, items_with_clock")
    .eq("source", source)
    .limit(5000);
  if (error) return [];
  return (data ?? []) as LegacyMetricRow[];
}
