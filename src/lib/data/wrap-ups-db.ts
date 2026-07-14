import { assertPersistRow, normalizePersistRowUuids } from "@/lib/server/persist-row";
import { cache } from "react";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { replaceWrapUpStore } from "@/lib/data/flow-store";
import { isHydrationFresh, markHydrated } from "@/lib/data/hydration-cache";
import type { DailyWrapUp, DailyWrapUpOverride } from "@/types/flow";
import { subDays, format } from "date-fns";

function isUnavailable(error: { code?: string; message?: string }): boolean {
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const msg = error.message ?? "";
  return msg.includes("does not exist");
}

async function dbClient() {
  return isAdminConfigured() ? createAdminClient() : null;
}

function str(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value);
  return s.length ? s : null;
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapWrapUp(row: Record<string, unknown>): DailyWrapUp {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    department_id: row.department_id ? String(row.department_id) : null,
    wrap_date: String(row.wrap_date),
    completed_summary: str(row.completed_summary),
    blockers: str(row.blockers),
    needs_support: Boolean(row.needs_support),
    needs_support_note: str(row.needs_support_note),
    clocked_minutes: numOrNull(row.clocked_minutes),
    recorded_task_minutes: numOrNull(row.recorded_task_minutes),
    unassigned_minutes: numOrNull(row.unassigned_minutes),
    task_tracking_compliance_pct: numOrNull(row.task_tracking_compliance_pct),
    activity_documentation_category:
      row.activity_documentation_category as DailyWrapUp["activity_documentation_category"],
    activity_documentation_note: str(row.activity_documentation_note),
    created_at: String(row.created_at),
    reviewed_at: str(row.reviewed_at),
    reviewed_by: row.reviewed_by ? String(row.reviewed_by) : null,
    internal_notes: str(row.internal_notes),
    follow_up_needed: Boolean(row.follow_up_needed),
    follow_up_notes: str(row.follow_up_notes),
  };
}

function mapOverride(row: Record<string, unknown>): DailyWrapUpOverride {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    wrap_date: String(row.wrap_date),
    reason: String(row.reason),
    overridden_by: String(row.overridden_by),
    overridden_at: String(row.overridden_at),
  };
}

const hydrateWrapUps = cache(async (): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  const supabase = await dbClient();
  if (!supabase) return;

  const since = format(subDays(new Date(), 120), "yyyy-MM-dd");

  const [wrapUps, overrides] = await Promise.all([
    supabase
      .from("daily_wrap_ups")
      .select("*")
      .gte("wrap_date", since)
      .order("wrap_date", { ascending: false }),
    supabase
      .from("daily_wrap_up_overrides")
      .select("*")
      .gte("wrap_date", since)
      .order("wrap_date", { ascending: false }),
  ]);

  if (wrapUps.error && !isUnavailable(wrapUps.error)) throw new Error(wrapUps.error.message);
  if (overrides.error && !isUnavailable(overrides.error)) throw new Error(overrides.error.message);

  replaceWrapUpStore({
    dailyWrapUps: (wrapUps.data ?? []).map((r) => mapWrapUp(r as Record<string, unknown>)),
    dailyWrapUpOverrides: (overrides.data ?? []).map((r) =>
      mapOverride(r as Record<string, unknown>)
    ),
  });
  markHydrated("wrap-ups");
});

export async function ensureWrapUpsHydrated(): Promise<void> {
  if (isHydrationFresh("wrap-ups")) return;
  await hydrateWrapUps();
}

function persistLater(fn: () => Promise<void>) {
  if (!isSupabaseConfigured()) return;
  void fn().catch((err) => console.error("[wrap-ups-db]", err));
}

async function requirePersistClient() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await dbClient();
  if (!supabase) {
    throw new Error(
      "Daily reports could not save. Set SUPABASE_SERVICE_ROLE_KEY in production environment variables."
    );
  }
  return supabase;
}

/** Await from server actions so wrap-ups survive the next page load. */
export async function persistDailyWrapUpSync(entry: DailyWrapUp): Promise<void> {
  const supabase = await requirePersistClient();
  if (!supabase) return;
  const row = normalizePersistRowUuids(
    {
      id: entry.id,
      user_id: entry.user_id,
      department_id: entry.department_id,
      wrap_date: entry.wrap_date,
      completed_summary: entry.completed_summary,
      blockers: entry.blockers,
      needs_support: entry.needs_support,
      needs_support_note: entry.needs_support_note,
      clocked_minutes: entry.clocked_minutes,
      recorded_task_minutes: entry.recorded_task_minutes,
      unassigned_minutes: entry.unassigned_minutes,
      task_tracking_compliance_pct: entry.task_tracking_compliance_pct,
      activity_documentation_category: entry.activity_documentation_category,
      activity_documentation_note: entry.activity_documentation_note,
      reviewed_at: entry.reviewed_at,
      reviewed_by: entry.reviewed_by,
      internal_notes: entry.internal_notes,
      follow_up_needed: entry.follow_up_needed,
      follow_up_notes: entry.follow_up_notes,
    },
    ["department_id", "reviewed_by"]
  );
  assertPersistRow("daily_wrap_ups", row, ["id", "user_id"], ["department_id", "reviewed_by"]);
  const { error } = await supabase
    .from("daily_wrap_ups")
    .upsert(row, { onConflict: "user_id,wrap_date" });
  if (error && !isUnavailable(error)) throw new Error(error.message);
}

export async function persistWrapUpOverrideSync(entry: DailyWrapUpOverride): Promise<void> {
  const supabase = await requirePersistClient();
  if (!supabase) return;
  const row = {
    id: entry.id,
    user_id: entry.user_id,
    wrap_date: entry.wrap_date,
    reason: entry.reason,
    overridden_by: entry.overridden_by,
    overridden_at: entry.overridden_at,
  };
  assertPersistRow("daily_wrap_up_overrides", row, ["id", "user_id", "overridden_by"]);
  const { error } = await supabase
    .from("daily_wrap_up_overrides")
    .upsert(row, { onConflict: "user_id,wrap_date" });
  if (error && !isUnavailable(error)) throw new Error(error.message);
}

export function persistDailyWrapUp(entry: DailyWrapUp): void {
  persistLater(() => persistDailyWrapUpSync(entry));
}

export function persistWrapUpOverride(entry: DailyWrapUpOverride): void {
  persistLater(() => persistWrapUpOverrideSync(entry));
}
