import { assertPersistRow } from "@/lib/server/persist-row";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { EmployeeWeeklyUpdate, WeeklyUpdateComment } from "@/types/flow";

// Demo-mode fallback (module-local, per server instance).
let demoUpdates: EmployeeWeeklyUpdate[] = [];
let demoComments: WeeklyUpdateComment[] = [];

function isUnavailable(error: { code?: string; message?: string }): boolean {
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return (error.message ?? "").includes("does not exist");
}

function mapUpdate(row: Record<string, unknown>): EmployeeWeeklyUpdate {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    team_id: String(row.team_id),
    week_of: String(row.week_of),
    sections:
      row.sections && typeof row.sections === "object"
        ? (row.sections as Record<string, string>)
        : {},
    status: row.status === "reassigned" ? "reassigned" : "submitted",
    revisions: Array.isArray(row.revisions)
      ? (row.revisions as EmployeeWeeklyUpdate["revisions"])
      : [],
    submitted_at: String(row.submitted_at),
    updated_at: String(row.updated_at),
    reassigned_by: row.reassigned_by ? String(row.reassigned_by) : null,
    reassigned_note: row.reassigned_note ? String(row.reassigned_note) : null,
  };
}

function mapComment(row: Record<string, unknown>): WeeklyUpdateComment {
  return {
    id: String(row.id),
    update_id: String(row.update_id),
    user_id: String(row.user_id),
    kind: row.kind === "reaction" ? "reaction" : "comment",
    body: row.body ? String(row.body) : null,
    emoji: row.emoji ? String(row.emoji) : null,
    created_at: String(row.created_at),
  };
}

async function dbClient() {
  if (!isSupabaseConfigured() || !isAdminConfigured()) return null;
  return createAdminClient();
}

export async function getWeeklyUpdate(
  userId: string,
  weekOf: string
): Promise<EmployeeWeeklyUpdate | null> {
  const supabase = await dbClient();
  if (!supabase) {
    return demoUpdates.find((u) => u.user_id === userId && u.week_of === weekOf) ?? null;
  }
  const { data, error } = await supabase
    .from("employee_weekly_updates")
    .select("*")
    .eq("user_id", userId)
    .eq("week_of", weekOf)
    .maybeSingle();
  if (error) {
    if (isUnavailable(error)) return null;
    throw new Error(error.message);
  }
  return data ? mapUpdate(data as Record<string, unknown>) : null;
}

export async function getWeeklyUpdateById(id: string): Promise<EmployeeWeeklyUpdate | null> {
  const supabase = await dbClient();
  if (!supabase) return demoUpdates.find((u) => u.id === id) ?? null;
  const { data, error } = await supabase
    .from("employee_weekly_updates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (isUnavailable(error)) return null;
    throw new Error(error.message);
  }
  return data ? mapUpdate(data as Record<string, unknown>) : null;
}

export async function upsertWeeklyUpdate(input: {
  user_id: string;
  team_id: string;
  week_of: string;
  sections: Record<string, string>;
}): Promise<void> {
  const existing = await getWeeklyUpdate(input.user_id, input.week_of);
  const now = new Date().toISOString();
  const revisions = existing
    ? [...existing.revisions, { sections: existing.sections, submitted_at: existing.submitted_at }]
    : [];

  const supabase = await dbClient();
  if (!supabase) {
    const entry: EmployeeWeeklyUpdate = {
      id: existing?.id ?? `weekly-update-${Date.now()}`,
      ...input,
      status: "submitted",
      revisions,
      submitted_at: now,
      updated_at: now,
      reassigned_by: null,
      reassigned_note: null,
    };
    demoUpdates = [entry, ...demoUpdates.filter((u) => u.id !== entry.id)];
    return;
  }

  const row = {
    user_id: input.user_id,
    team_id: input.team_id,
    week_of: input.week_of,
    sections: input.sections,
    status: "submitted",
    revisions,
    submitted_at: now,
    updated_at: now,
    reassigned_by: null,
    reassigned_note: null,
  };
  assertPersistRow("employee_weekly_updates", row, ["user_id", "team_id"]);
  const { error } = await supabase
    .from("employee_weekly_updates")
    .upsert(row, { onConflict: "user_id,week_of" });
  if (error && !isUnavailable(error)) throw new Error(error.message);
}

export async function markWeeklyUpdateReassigned(
  updateId: string,
  reassignedBy: string,
  note: string | null
): Promise<void> {
  const supabase = await dbClient();
  if (!supabase) {
    demoUpdates = demoUpdates.map((u) =>
      u.id === updateId
        ? { ...u, status: "reassigned", reassigned_by: reassignedBy, reassigned_note: note }
        : u
    );
    return;
  }
  const { error } = await supabase
    .from("employee_weekly_updates")
    .update({
      status: "reassigned",
      reassigned_by: reassignedBy,
      reassigned_note: note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", updateId);
  if (error && !isUnavailable(error)) throw new Error(error.message);
}

export async function listWeeklyUpdates(sinceWeek: string): Promise<EmployeeWeeklyUpdate[]> {
  const supabase = await dbClient();
  if (!supabase) return demoUpdates.filter((u) => u.week_of >= sinceWeek);
  const { data, error } = await supabase
    .from("employee_weekly_updates")
    .select("*")
    .gte("week_of", sinceWeek)
    .order("week_of", { ascending: false })
    .order("submitted_at", { ascending: false });
  if (error) {
    if (isUnavailable(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => mapUpdate(r as Record<string, unknown>));
}

export async function addWeeklyUpdateComment(input: {
  update_id: string;
  user_id: string;
  kind: "comment" | "reaction";
  body?: string;
  emoji?: string;
}): Promise<void> {
  const supabase = await dbClient();
  if (!supabase) {
    demoComments = [
      ...demoComments,
      {
        id: `wu-comment-${Date.now()}`,
        update_id: input.update_id,
        user_id: input.user_id,
        kind: input.kind,
        body: input.body ?? null,
        emoji: input.emoji ?? null,
        created_at: new Date().toISOString(),
      },
    ];
    return;
  }
  const row = {
    update_id: input.update_id,
    user_id: input.user_id,
    kind: input.kind,
    body: input.body ?? null,
    emoji: input.emoji ?? null,
  };
  assertPersistRow("weekly_update_comments", row, ["update_id", "user_id"]);
  const { error } = await supabase.from("weekly_update_comments").insert(row);
  if (error && !isUnavailable(error)) throw new Error(error.message);
}

export async function listWeeklyUpdateComments(
  updateIds: string[]
): Promise<WeeklyUpdateComment[]> {
  if (!updateIds.length) return [];
  const supabase = await dbClient();
  if (!supabase) return demoComments.filter((c) => updateIds.includes(c.update_id));
  const { data, error } = await supabase
    .from("weekly_update_comments")
    .select("*")
    .in("update_id", updateIds)
    .order("created_at", { ascending: true });
  if (error) {
    if (isUnavailable(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => mapComment(r as Record<string, unknown>));
}
