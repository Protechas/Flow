import { assertPersistRow } from "@/lib/server/persist-row";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { ManagerWeeklyUpdate } from "@/types/flow";

// Demo-mode fallback so the form works without Supabase (module-local, per
// server instance — same contract as other demo stores).
let demoUpdates: ManagerWeeklyUpdate[] = [];

function isUnavailable(error: { code?: string; message?: string }): boolean {
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return (error.message ?? "").includes("does not exist");
}

function mapRow(row: Record<string, unknown>): ManagerWeeklyUpdate {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    team_id: String(row.team_id),
    week_of: String(row.week_of),
    sections:
      row.sections && typeof row.sections === "object"
        ? (row.sections as Record<string, string>)
        : {},
    submitted_at: String(row.submitted_at),
    updated_at: String(row.updated_at),
  };
}

async function dbClient() {
  if (!isSupabaseConfigured() || !isAdminConfigured()) return null;
  return createAdminClient();
}

export async function upsertManagerWeeklyUpdate(input: {
  user_id: string;
  team_id: string;
  week_of: string;
  sections: Record<string, string>;
}): Promise<void> {
  const supabase = await dbClient();
  if (!supabase) {
    const now = new Date().toISOString();
    const idx = demoUpdates.findIndex(
      (u) => u.user_id === input.user_id && u.week_of === input.week_of
    );
    const entry: ManagerWeeklyUpdate = {
      id: idx >= 0 ? demoUpdates[idx].id : `mgr-update-${Date.now()}`,
      ...input,
      submitted_at: idx >= 0 ? demoUpdates[idx].submitted_at : now,
      updated_at: now,
    };
    if (idx >= 0) demoUpdates[idx] = entry;
    else demoUpdates = [entry, ...demoUpdates];
    return;
  }

  const row = {
    user_id: input.user_id,
    team_id: input.team_id,
    week_of: input.week_of,
    sections: input.sections,
    updated_at: new Date().toISOString(),
  };
  assertPersistRow("manager_weekly_updates", row, ["user_id", "team_id"]);
  const { error } = await supabase
    .from("manager_weekly_updates")
    .upsert(row, { onConflict: "user_id,week_of" });
  if (error && !isUnavailable(error)) throw new Error(error.message);
}

/** Recent updates, newest week first (leadership view + own current week). */
export async function listManagerWeeklyUpdates(sinceWeek: string): Promise<ManagerWeeklyUpdate[]> {
  const supabase = await dbClient();
  if (!supabase) {
    return demoUpdates.filter((u) => u.week_of >= sinceWeek);
  }
  const { data, error } = await supabase
    .from("manager_weekly_updates")
    .select("*")
    .gte("week_of", sinceWeek)
    .order("week_of", { ascending: false })
    .order("submitted_at", { ascending: false });
  if (error) {
    if (isUnavailable(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}
