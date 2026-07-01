import { cache } from "react";
import { assertPersistRow, normalizePersistRowUuids } from "@/lib/server/persist-row";
import { logPersistFailure, shouldThrowPersistError } from "@/lib/server/db-error";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { replaceWorkloadAlertStore } from "@/lib/workload-alerts/store";
import type { WorkloadAlertRecord } from "@/types/flow";

async function dbClient() {
  return isAdminConfigured() ? createAdminClient() : null;
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value);
  return s.length ? s : null;
}

function mapWorkloadAlert(row: Record<string, unknown>): WorkloadAlertRecord {
  return {
    id: String(row.id),
    employee_id: String(row.employee_id),
    department_id: row.department_id ? String(row.department_id) : null,
    team_id: row.team_id ? String(row.team_id) : null,
    alert_type: row.alert_type as WorkloadAlertRecord["alert_type"],
    severity: row.severity as WorkloadAlertRecord["severity"],
    remaining_hours: numOrNull(row.remaining_hours),
    current_task_id: row.current_task_id ? String(row.current_task_id) : null,
    status: row.status as WorkloadAlertRecord["status"],
    recommended_action: String(row.recommended_action ?? ""),
    reviewed_by: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewed_at: str(row.reviewed_at),
    snoozed_until: str(row.snoozed_until),
    dismissed_by: row.dismissed_by ? String(row.dismissed_by) : null,
    dismissed_at: str(row.dismissed_at),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function toPersistRow(record: WorkloadAlertRecord): Record<string, unknown> {
  const row = normalizePersistRowUuids(
    {
      id: record.id,
      employee_id: record.employee_id,
      department_id: record.department_id,
      team_id: record.team_id,
      alert_type: record.alert_type,
      severity: record.severity,
      remaining_hours: record.remaining_hours,
      current_task_id: record.current_task_id,
      status: record.status,
      recommended_action: record.recommended_action,
      reviewed_by: record.reviewed_by,
      reviewed_at: record.reviewed_at,
      snoozed_until: record.snoozed_until,
      dismissed_by: record.dismissed_by,
      dismissed_at: record.dismissed_at,
      created_at: record.created_at,
      updated_at: record.updated_at,
    },
    ["department_id", "team_id", "current_task_id", "reviewed_by", "dismissed_by"]
  );

  assertPersistRow(
    "workload_alerts",
    row,
    ["id", "employee_id"],
    ["department_id", "team_id", "current_task_id", "reviewed_by", "dismissed_by"]
  );

  return row;
}

const hydrateWorkloadAlerts = cache(async (): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  const supabase = await dbClient();
  if (!supabase) return;

  const { data, error } = await supabase
    .from("workload_alerts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (shouldThrowPersistError(error)) throw new Error(error.message);
    logPersistFailure("workload-alerts-db", error);
    return;
  }

  replaceWorkloadAlertStore((data ?? []).map((r) => mapWorkloadAlert(r as Record<string, unknown>)));
});

export async function ensureWorkloadAlertsHydrated(): Promise<void> {
  await hydrateWorkloadAlerts();
}

let persistChain: Promise<void> = Promise.resolve();

function persistLater(fn: () => Promise<void>) {
  if (!isSupabaseConfigured()) return;
  persistChain = persistChain.then(fn).catch((err) => logPersistFailure("workload-alerts-db", err));
}

async function requirePersistClient() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await dbClient();
  if (!supabase) {
    throw new Error(
      "Workload alerts could not save. Set SUPABASE_SERVICE_ROLE_KEY in production environment variables."
    );
  }
  return supabase;
}

export async function persistWorkloadAlertSync(record: WorkloadAlertRecord): Promise<void> {
  await persistWorkloadAlertsSync([record]);
}

export async function persistWorkloadAlertsSync(records: WorkloadAlertRecord[]): Promise<void> {
  if (!records.length) return;

  const supabase = await requirePersistClient();
  if (!supabase) return;

  const rows = records.map(toPersistRow);
  const { error } = await supabase.from("workload_alerts").upsert(rows, { onConflict: "id" });
  if (error && shouldThrowPersistError(error)) throw new Error(error.message);
  if (error) logPersistFailure("workload-alerts-db", error);
}

export function persistWorkloadAlert(record: WorkloadAlertRecord): void {
  persistLater(() => persistWorkloadAlertSync(record));
}

export function persistWorkloadAlerts(records: WorkloadAlertRecord[]): void {
  if (!records.length) return;
  persistLater(() => persistWorkloadAlertsSync(records));
}
