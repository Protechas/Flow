import type { WorkloadAlertRecord, WorkloadAlertStatus } from "@/types/flow";
import { newPersistedId } from "@/lib/server/persisted-id";

const GLOBAL_KEY = "__flow_workload_alerts__";

function globalScope(): Record<string, unknown> {
  return globalThis as typeof globalThis & Record<string, unknown>;
}

function uid() {
  return newPersistedId("wla");
}

const pendingById = new Map<string, WorkloadAlertRecord>();
let flushScheduled = false;

function flushPendingPersists(): void {
  flushScheduled = false;
  const records = [...pendingById.values()];
  pendingById.clear();
  if (!records.length) return;
  void import("@/lib/data/workload-alerts-db").then(({ persistWorkloadAlerts }) =>
    persistWorkloadAlerts(records)
  );
}

function schedulePersist(record: WorkloadAlertRecord): void {
  pendingById.set(record.id, record);
  if (flushScheduled) return;
  flushScheduled = true;
  queueMicrotask(flushPendingPersists);
}

export function replaceWorkloadAlertStore(records: WorkloadAlertRecord[]): void {
  writeStore(records);
}

function readStore(): WorkloadAlertRecord[] {
  const value = globalScope()[GLOBAL_KEY];
  if (!Array.isArray(value)) return [];
  return value as WorkloadAlertRecord[];
}

function writeStore(records: WorkloadAlertRecord[]): void {
  globalScope()[GLOBAL_KEY] = records;
}

export function listWorkloadAlertRecords(): WorkloadAlertRecord[] {
  return readStore();
}

export function upsertWorkloadAlertRecord(
  input: Omit<WorkloadAlertRecord, "id" | "created_at" | "updated_at"> & {
    id?: string;
    created_at?: string;
  }
): WorkloadAlertRecord {
  const records = readStore();
  const key = `${input.employee_id}:${input.alert_type}`;
  const idx = records.findIndex(
    (r) => `${r.employee_id}:${r.alert_type}` === key
  );
  const now = new Date().toISOString();

  if (idx >= 0) {
    const existing = records[idx];
    const updated: WorkloadAlertRecord = {
      ...existing,
      ...input,
      id: existing.id,
      created_at: existing.created_at,
      updated_at: now,
      status:
        existing.status === "snoozed" &&
        existing.snoozed_until &&
        new Date(existing.snoozed_until) > new Date()
          ? "snoozed"
          : input.status,
      snoozed_until:
        existing.status === "snoozed" &&
        existing.snoozed_until &&
        new Date(existing.snoozed_until) > new Date()
          ? existing.snoozed_until
          : input.snoozed_until ?? null,
      reviewed_by: existing.reviewed_by,
      reviewed_at: existing.reviewed_at,
      dismissed_by: existing.dismissed_by,
      dismissed_at: existing.dismissed_at,
    };
    records[idx] = updated;
    writeStore(records);
    schedulePersist(updated);
    return updated;
  }

  const created: WorkloadAlertRecord = {
    ...input,
    id: input.id ?? uid(),
    created_at: input.created_at ?? now,
    updated_at: now,
  };
  writeStore([created, ...records]);
  schedulePersist(created);
  return created;
}

export function updateWorkloadAlertStatus(
  id: string,
  status: WorkloadAlertStatus,
  meta: {
    reviewed_by?: string | null;
    reviewed_at?: string | null;
    snoozed_until?: string | null;
    dismissed_by?: string | null;
    dismissed_at?: string | null;
  }
): WorkloadAlertRecord | null {
  const records = readStore();
  const idx = records.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const updated: WorkloadAlertRecord = {
    ...records[idx],
    status,
    updated_at: new Date().toISOString(),
    ...meta,
  };
  records[idx] = updated;
  writeStore(records);
  schedulePersist(updated);
  return updated;
}

export function countAlertsForEmployee(employeeId: string, sinceDays = 30): number {
  const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
  return readStore().filter(
    (r) =>
      r.employee_id === employeeId &&
      new Date(r.created_at).getTime() >= cutoff
  ).length;
}

export function avgAlertResponseTimeHours(): number {
  const records = readStore().filter(
    (r) => r.reviewed_at || r.dismissed_at
  );
  if (!records.length) return 0;
  const total = records.reduce((s, r) => {
    const end = r.reviewed_at ?? r.dismissed_at;
    if (!end) return s;
    return s + (new Date(end).getTime() - new Date(r.created_at).getTime());
  }, 0);
  return Math.round((total / records.length / (1000 * 60 * 60)) * 10) / 10;
}
