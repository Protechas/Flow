import { randomUUID } from "node:crypto";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import {
  getClockEntriesForUser,
  initProductionTracking,
  getProductionStore,
} from "@/lib/data/production-tracking";
import { listWorkPackages } from "@/lib/data/work-packages";

import type {
  AutoIncident,
  EmployeeIncident,
  EvaluationSignals,
  IncidentCategory,
  IncidentSeverity,
} from "@/lib/people/employee-evaluation-types";

export type {
  AutoIncident,
  EmployeeIncident,
  EvaluationSignals,
  IncidentCategory,
  IncidentSeverity,
} from "@/lib/people/employee-evaluation-types";

const memoryIncidents: EmployeeIncident[] = [];

async function dbClient() {
  return isAdminConfigured() ? createAdminClient() : null;
}

function mapIncident(row: Record<string, unknown>): EmployeeIncident {
  return {
    id: String(row.id),
    employee_id: String(row.employee_id),
    category: String(row.category) as IncidentCategory,
    severity: String(row.severity) as IncidentSeverity,
    summary: String(row.summary),
    notes: row.notes != null ? String(row.notes) : null,
    occurred_on: String(row.occurred_on),
    task_id: row.task_id != null ? String(row.task_id) : null,
    created_by: String(row.created_by),
    created_at: String(row.created_at),
  };
}

export async function listEmployeeIncidents(employeeId: string): Promise<EmployeeIncident[]> {
  if (!isSupabaseConfigured()) {
    return memoryIncidents
      .filter((i) => i.employee_id === employeeId)
      .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
  }
  const supabase = await dbClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("employee_incidents")
    .select("*")
    .eq("employee_id", employeeId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  initFlowStore();
  const users = getFlowStore().users;
  return (data ?? []).map((row) => {
    const incident = mapIncident(row as Record<string, unknown>);
    incident.created_by_name =
      users.find((u) => u.id === incident.created_by)?.full_name ?? "Unknown";
    return incident;
  });
}

export async function logEmployeeIncident(input: {
  employee_id: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  summary: string;
  notes?: string | null;
  occurred_on: string;
  task_id?: string | null;
  created_by: string;
}): Promise<EmployeeIncident> {
  const incident: EmployeeIncident = {
    id: randomUUID(),
    employee_id: input.employee_id,
    category: input.category,
    severity: input.severity,
    summary: input.summary.trim(),
    notes: input.notes?.trim() || null,
    occurred_on: input.occurred_on,
    task_id: input.task_id ?? null,
    created_by: input.created_by,
    created_at: new Date().toISOString(),
  };
  if (!isSupabaseConfigured()) {
    memoryIncidents.unshift(incident);
    return incident;
  }
  const supabase = await dbClient();
  if (!supabase) throw new Error("Service role client unavailable");
  const { error } = await supabase.from("employee_incidents").insert({
    id: incident.id,
    employee_id: incident.employee_id,
    category: incident.category,
    severity: incident.severity,
    summary: incident.summary,
    notes: incident.notes,
    occurred_on: incident.occurred_on,
    task_id: incident.task_id,
    created_by: incident.created_by,
  });
  if (error) throw new Error(error.message);
  return incident;
}

export async function deleteEmployeeIncident(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const idx = memoryIncidents.findIndex((i) => i.id === id);
    if (idx >= 0) memoryIncidents.splice(idx, 1);
    return;
  }
  const supabase = await dbClient();
  if (!supabase) throw new Error("Service role client unavailable");
  const { error } = await supabase.from("employee_incidents").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Auto-captured incidents: every "something wasn't right" event the system
 * can see, itemized from operational data. Nothing is written to a table —
 * this always reflects the live records, so it needs no upkeep and covers
 * history retroactively. Store must be hydrated. */
export function computeAutoIncidents(employeeId: string): AutoIncident[] {
  initFlowStore();
  initProductionTracking();
  const store = getFlowStore();
  const incidents: AutoIncident[] = [];

  // Clock punches a manager had to fix or add (last 90 days).
  const entries = getClockEntriesForUser(employeeId, 90);
  for (const entry of entries) {
    if (!entry.edited_by || entry.edited_by === employeeId) continue;
    const editor = store.users.find((u) => u.id === entry.edited_by)?.full_name ?? "a manager";
    incidents.push({
      category: "time_clock",
      severity: "minor",
      summary: `Clock punch corrected by ${editor}`,
      detail: entry.edit_reason ? `“${entry.edit_reason}”` : null,
      occurred_on: entry.clock_in_at.slice(0, 10),
    });
  }

  // Clocked days without a daily report (last 30 days, today excluded).
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const wrapDays = new Set(
    store.dailyWrapUps
      .filter((w) => w.user_id === employeeId && w.wrap_date >= cutoff)
      .map((w) => w.wrap_date)
  );
  const clockDays = new Set(
    entries
      .filter((e) => e.clock_in_at.slice(0, 10) >= cutoff)
      .map((e) => e.clock_in_at.slice(0, 10))
  );
  for (const day of clockDays) {
    if (day === today || wrapDays.has(day)) continue;
    incidents.push({
      category: "daily_report",
      severity: "minor",
      summary: "Clocked in with no daily report",
      detail: null,
      occurred_on: day,
    });
  }

  // QA returns on their tasks.
  const tasks = listWorkPackages({ assignedTo: employeeId });
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  for (const review of getProductionStore().qaReviewRecords) {
    const task = taskById.get(review.task_id);
    if (!task || review.status === "pass") continue;
    incidents.push({
      category: "qa_quality",
      severity: review.status === "rejected" ? "serious" : "moderate",
      summary: `QA returned "${task.title}" (${review.status.replace(/_/g, " ")})`,
      detail: review.correction_reason ?? review.notes,
      occurred_on: review.reviewed_at.slice(0, 10),
    });
  }

  return incidents.sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
}

/** Compute automatic signals from clock entries, wrap-ups, and QA data (store must be hydrated). */
export function computeEvaluationSignals(employeeId: string): EvaluationSignals {
  initFlowStore();
  initProductionTracking();
  const store = getFlowStore();

  // Clock corrections: punches edited or created by someone else.
  const entries = getClockEntriesForUser(employeeId, 90);
  const corrections = entries.filter((e) => e.edited_by && e.edited_by !== employeeId);
  const clockCorrectionDetails = corrections.slice(0, 5).map((e) => ({
    date: e.clock_in_at.slice(0, 10),
    editor: store.users.find((u) => u.id === e.edited_by)?.full_name ?? "Manager",
    reason: e.edit_reason ?? "corrected punch",
  }));

  // Missed wrap-ups: clocked days in the last 30 without a daily report.
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const clockDays = new Set(
    entries
      .filter((e) => e.clock_in_at.slice(0, 10) >= cutoff)
      .map((e) => e.clock_in_at.slice(0, 10))
  );
  const wrapDays = new Set(
    store.dailyWrapUps
      .filter((w) => w.user_id === employeeId && w.wrap_date >= cutoff)
      .map((w) => w.wrap_date)
  );
  const today = new Date().toISOString().slice(0, 10);
  let missedWrapUps = 0;
  for (const day of clockDays) {
    if (day !== today && !wrapDays.has(day)) missedWrapUps += 1;
  }

  // QA signals across their assigned tasks.
  const tasks = listWorkPackages({ assignedTo: employeeId });
  const taskIds = new Set(tasks.map((t) => t.id));
  const qaCorrections = tasks.reduce((s, t) => s + (t.correction_count ?? 0), 0);
  const qaReviewReturns = getProductionStore().qaReviewRecords.filter(
    (r) => taskIds.has(r.task_id) && r.status !== "pass"
  ).length;

  return {
    clockCorrections: corrections.length,
    clockCorrectionDetails,
    missedWrapUps,
    qaCorrections,
    qaReviewReturns,
  };
}
