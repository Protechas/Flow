import type { ActivityGapRecord } from "@/types/flow";

const GAPS_KEY = "__flow_activity_gaps__";
const TRACKING_KEY = "__flow_activity_gap_tracking__";

type GapTracking = { startedAt: string; alerted: boolean };

function globalScope(): Record<string, unknown> {
  return globalThis as typeof globalThis & Record<string, unknown>;
}

function uid() {
  return `ag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ts() {
  return new Date().toISOString();
}

function readGaps(): ActivityGapRecord[] {
  const value = globalScope()[GAPS_KEY];
  if (!Array.isArray(value)) return [];
  return value as ActivityGapRecord[];
}

function writeGaps(records: ActivityGapRecord[]): void {
  globalScope()[GAPS_KEY] = records;
}

function readTracking(): Record<string, GapTracking> {
  const value = globalScope()[TRACKING_KEY];
  if (!value || typeof value !== "object") return {};
  return value as Record<string, GapTracking>;
}

function writeTracking(map: Record<string, GapTracking>): void {
  globalScope()[TRACKING_KEY] = map;
}

export function listActivityGapRecords(): ActivityGapRecord[] {
  return readGaps();
}

export function getOpenActivityGapsForEmployee(employeeId: string): ActivityGapRecord[] {
  return readGaps().filter((g) => g.employee_id === employeeId && g.status === "open");
}

export function upsertActivityGap(record: Omit<ActivityGapRecord, "id" | "created_at"> & { id?: string }): ActivityGapRecord {
  const gaps = readGaps();
  const existingIdx = gaps.findIndex(
    (g) => g.employee_id === record.employee_id && g.status === "open"
  );
  const entry: ActivityGapRecord = {
    id: record.id ?? (existingIdx >= 0 ? gaps[existingIdx].id : uid()),
    employee_id: record.employee_id,
    department_id: record.department_id,
    started_at: record.started_at,
    detected_at: record.detected_at,
    status: record.status,
    message: record.message,
    created_at: existingIdx >= 0 ? gaps[existingIdx].created_at : ts(),
    resolved_at: record.resolved_at,
  };
  if (existingIdx >= 0) {
    gaps[existingIdx] = entry;
  } else {
    gaps.unshift(entry);
  }
  writeGaps(gaps);
  return entry;
}

export function resolveActivityGapsForEmployee(employeeId: string): void {
  const gaps = readGaps();
  const now = ts();
  let changed = false;
  for (const g of gaps) {
    if (g.employee_id === employeeId && g.status === "open") {
      g.status = "resolved";
      g.resolved_at = now;
      changed = true;
    }
  }
  if (changed) writeGaps(gaps);
  const tracking = readTracking();
  delete tracking[employeeId];
  writeTracking(tracking);
}

export function getGapTracking(employeeId: string): GapTracking | null {
  return readTracking()[employeeId] ?? null;
}

export function setGapTracking(employeeId: string, tracking: GapTracking | null): void {
  const map = readTracking();
  if (tracking) {
    map[employeeId] = tracking;
  } else {
    delete map[employeeId];
  }
  writeTracking(map);
}
