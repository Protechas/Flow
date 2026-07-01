import type { HelpFlagRecord, HelpFlagStatus } from "@/types/flow";
import { newPersistedId } from "@/lib/server/persisted-id";

const GLOBAL_KEY = "__flow_help_flags__";

function globalScope(): Record<string, unknown> {
  return globalThis as typeof globalThis & Record<string, unknown>;
}

export function replaceHelpFlagStore(records: HelpFlagRecord[]): void {
  writeStore(records);
}

function uid() {
  return newPersistedId("hf");
}

const pendingById = new Map<string, HelpFlagRecord>();
let flushScheduled = false;

function flushPendingPersists(): void {
  flushScheduled = false;
  const records = [...pendingById.values()];
  pendingById.clear();
  if (!records.length) return;
  void import("@/lib/data/help-flags-db").then(({ persistHelpFlags }) => persistHelpFlags(records));
}

function schedulePersist(record: HelpFlagRecord): void {
  pendingById.set(record.id, record);
  if (flushScheduled) return;
  flushScheduled = true;
  queueMicrotask(flushPendingPersists);
}

function readStore(): HelpFlagRecord[] {
  const value = globalScope()[GLOBAL_KEY];
  if (!Array.isArray(value)) return [];
  return value as HelpFlagRecord[];
}

function writeStore(records: HelpFlagRecord[]): void {
  globalScope()[GLOBAL_KEY] = records;
}

export function listHelpFlagRecords(): HelpFlagRecord[] {
  return readStore();
}

export function getHelpFlagById(id: string): HelpFlagRecord | null {
  return readStore().find((r) => r.id === id) ?? null;
}

export function createHelpFlagRecord(
  input: Omit<HelpFlagRecord, "id" | "created_at" | "updated_at">
): HelpFlagRecord {
  const now = new Date().toISOString();
  const record: HelpFlagRecord = {
    ...input,
    id: uid(),
    created_at: now,
    updated_at: now,
  };
  writeStore([record, ...readStore()]);
  schedulePersist(record);
  return record;
}

export function updateHelpFlagRecord(
  id: string,
  patch: Partial<HelpFlagRecord>
): HelpFlagRecord | null {
  const records = readStore();
  const idx = records.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const updated: HelpFlagRecord = {
    ...records[idx],
    ...patch,
    updated_at: new Date().toISOString(),
  };
  records[idx] = updated;
  writeStore(records);
  schedulePersist(updated);
  return updated;
}

export function findOpenHelpFlagForTask(
  employeeId: string,
  taskId: string
): HelpFlagRecord | null {
  return (
    readStore().find(
      (r) =>
        r.employee_id === employeeId &&
        r.task_id === taskId &&
        ["open", "acknowledged", "in_progress"].includes(r.status)
    ) ?? null
  );
}

export function findOpenHelpFlagForWrapUp(
  employeeId: string,
  wrapUpId: string
): HelpFlagRecord | null {
  return readStore().find((r) => r.wrap_up_id === wrapUpId) ?? null;
}

export function countHelpFlagsForEmployee(
  employeeId: string,
  sinceDays = 30
): number {
  const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
  return readStore().filter(
    (r) =>
      r.employee_id === employeeId &&
      new Date(r.created_at).getTime() >= cutoff
  ).length;
}

export function avgHelpFlagResponseMinutes(): number {
  const records = readStore().filter((r) => r.acknowledged_at);
  if (!records.length) return 0;
  const total = records.reduce((s, r) => {
    if (!r.acknowledged_at) return s;
    return s + (new Date(r.acknowledged_at).getTime() - new Date(r.created_at).getTime());
  }, 0);
  return Math.round(total / records.length / 60000);
}

export function avgHelpFlagResolutionMinutes(): number {
  const records = readStore().filter((r) => r.resolved_at);
  if (!records.length) return 0;
  const total = records.reduce((s, r) => {
    if (!r.resolved_at) return s;
    return s + (new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime());
  }, 0);
  return Math.round(total / records.length / 60000);
}

export function listOpenHelpFlags(): HelpFlagRecord[] {
  return readStore().filter((r) =>
    ["open", "acknowledged", "in_progress"].includes(r.status)
  );
}

export function updateHelpFlagStatus(
  id: string,
  status: HelpFlagStatus,
  meta: Partial<HelpFlagRecord>
): HelpFlagRecord | null {
  return updateHelpFlagRecord(id, { status, ...meta });
}
