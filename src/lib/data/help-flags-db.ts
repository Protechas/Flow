import { cache } from "react";
import { assertPersistRow, normalizePersistRowUuids } from "@/lib/server/persist-row";
import { logPersistFailure, shouldThrowPersistError } from "@/lib/server/db-error";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { replaceHelpFlagStore } from "@/lib/help-flags/store";
import type { HelpFlagRecord } from "@/types/flow";

async function dbClient() {
  return isAdminConfigured() ? createAdminClient() : null;
}

function str(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value);
  return s.length ? s : null;
}

function mapHelpFlag(row: Record<string, unknown>): HelpFlagRecord {
  return {
    id: String(row.id),
    employee_id: String(row.employee_id),
    department_id: row.department_id ? String(row.department_id) : null,
    team_id: row.team_id ? String(row.team_id) : null,
    board_id: row.board_id ? String(row.board_id) : null,
    project_id: row.project_id ? String(row.project_id) : null,
    task_id: row.task_id ? String(row.task_id) : null,
    reason: row.reason as HelpFlagRecord["reason"],
    notes: str(row.notes),
    status: row.status as HelpFlagRecord["status"],
    severity: row.severity as HelpFlagRecord["severity"],
    source: row.source as HelpFlagRecord["source"],
    wrap_up_id: row.wrap_up_id ? String(row.wrap_up_id) : null,
    acknowledged_by: row.acknowledged_by ? String(row.acknowledged_by) : null,
    acknowledged_at: str(row.acknowledged_at),
    leader_note: str(row.leader_note),
    resolved_by: row.resolved_by ? String(row.resolved_by) : null,
    resolved_at: str(row.resolved_at),
    resolution_notes: str(row.resolution_notes),
    dismissed_by: row.dismissed_by ? String(row.dismissed_by) : null,
    dismissed_at: str(row.dismissed_at),
    dismissal_reason: str(row.dismissal_reason),
    escalated_at: str(row.escalated_at),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

const hydrateHelpFlags = cache(async (): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  const supabase = await dbClient();
  if (!supabase) return;

  const { data, error } = await supabase
    .from("help_flags")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (shouldThrowPersistError(error)) throw new Error(error.message);
    logPersistFailure("help-flags-db", error);
    return;
  }

  replaceHelpFlagStore((data ?? []).map((r) => mapHelpFlag(r as Record<string, unknown>)));
});

export async function ensureHelpFlagsHydrated(): Promise<void> {
  await hydrateHelpFlags();
}

let persistChain: Promise<void> = Promise.resolve();

function persistLater(fn: () => Promise<void>) {
  if (!isSupabaseConfigured()) return;
  persistChain = persistChain.then(fn).catch((err) => logPersistFailure("help-flags-db", err));
}

async function requirePersistClient() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await dbClient();
  if (!supabase) {
    throw new Error(
      "Help flags could not save. Set SUPABASE_SERVICE_ROLE_KEY in production environment variables."
    );
  }
  return supabase;
}

export async function persistHelpFlagSync(record: HelpFlagRecord): Promise<void> {
  await persistHelpFlagsSync([record]);
}

export async function persistHelpFlagsSync(records: HelpFlagRecord[]): Promise<void> {
  if (!records.length) return;

  const supabase = await requirePersistClient();
  if (!supabase) return;

  const rows = records.map((record) => {
    const row = normalizePersistRowUuids(
    {
      id: record.id,
      employee_id: record.employee_id,
      department_id: record.department_id,
      team_id: record.team_id,
      board_id: record.board_id,
      project_id: record.project_id,
      task_id: record.task_id,
      reason: record.reason,
      notes: record.notes,
      status: record.status,
      severity: record.severity,
      source: record.source,
      wrap_up_id: record.wrap_up_id,
      acknowledged_by: record.acknowledged_by,
      acknowledged_at: record.acknowledged_at,
      leader_note: record.leader_note,
      resolved_by: record.resolved_by,
      resolved_at: record.resolved_at,
      resolution_notes: record.resolution_notes,
      dismissed_by: record.dismissed_by,
      dismissed_at: record.dismissed_at,
      dismissal_reason: record.dismissal_reason,
      escalated_at: record.escalated_at,
      created_at: record.created_at,
      updated_at: record.updated_at,
    },
    [
      "department_id",
      "team_id",
      "board_id",
      "project_id",
      "task_id",
      "wrap_up_id",
      "acknowledged_by",
      "resolved_by",
      "dismissed_by",
    ]
  );

    assertPersistRow(
      "help_flags",
      row,
      ["id", "employee_id"],
      [
        "department_id",
        "team_id",
        "board_id",
        "project_id",
        "task_id",
        "wrap_up_id",
        "acknowledged_by",
        "resolved_by",
        "dismissed_by",
      ]
    );

    return row;
  });

  const { error } = await supabase.from("help_flags").upsert(rows, { onConflict: "id" });
  if (error && shouldThrowPersistError(error)) throw new Error(error.message);
  if (error) logPersistFailure("help-flags-db", error);
}

export function persistHelpFlag(record: HelpFlagRecord): void {
  persistLater(() => persistHelpFlagSync(record));
}

export function persistHelpFlags(records: HelpFlagRecord[]): void {
  if (!records.length) return;
  persistLater(() => persistHelpFlagsSync(records));
}
