import { cache } from "react";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { replaceTimeLogsStore } from "@/lib/data/flow-store";
import { isHydrationFresh, markHydrated } from "@/lib/data/hydration-cache";
import type { TimeLog } from "@/types/flow";

function isUnavailable(error: { code?: string; message?: string }): boolean {
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const msg = error.message ?? "";
  return msg.includes("does not exist");
}

async function dbClient() {
  return isAdminConfigured() ? createAdminClient() : null;
}

function mapRow(row: Record<string, unknown>): TimeLog {
  return {
    id: String(row.id),
    work_package_id: String(row.work_item_id),
    user_id: String(row.user_id),
    hours: Number(row.hours ?? 0),
    log_date: String(row.log_date),
    notes: row.notes == null ? null : String(row.notes),
    created_at: String(row.created_at),
  };
}

const hydrateTimeLogs = cache(async (): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  const supabase = await dbClient();
  if (!supabase) return;

  const { data, error } = await supabase
    .from("time_logs")
    .select("*")
    .order("log_date", { ascending: false })
    .limit(20000);

  if (error) {
    if (isUnavailable(error)) return;
    throw new Error(error.message);
  }
  replaceTimeLogsStore((data ?? []).map((r) => mapRow(r as Record<string, unknown>)));
  markHydrated("time-logs");
});

export async function ensureTimeLogsHydrated(): Promise<void> {
  if (isHydrationFresh("time-logs")) return;
  await hydrateTimeLogs();
}

export async function persistTimeLogSync(log: TimeLog): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await dbClient();
  if (!supabase) return;
  const { error } = await supabase.from("time_logs").upsert(
    {
      id: log.id,
      work_item_id: log.work_package_id,
      user_id: log.user_id,
      hours: log.hours,
      log_date: log.log_date,
      notes: log.notes ?? null,
    },
    { onConflict: "id" }
  );
  if (error && !isUnavailable(error)) throw new Error(error.message);
}

export async function deleteTimeLogSync(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await dbClient();
  if (!supabase) return;
  const { error } = await supabase.from("time_logs").delete().eq("id", id);
  if (error && !isUnavailable(error)) throw new Error(error.message);
}
