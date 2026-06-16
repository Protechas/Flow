import type { UserHierarchyRecord } from "@/types/flow";

const GLOBAL_KEY = "__flow_user_hierarchy__";

function globalScope(): Record<string, unknown> {
  return globalThis as typeof globalThis & Record<string, unknown>;
}

function uid() {
  return `uh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readStore(): UserHierarchyRecord[] {
  const value = globalScope()[GLOBAL_KEY];
  if (!Array.isArray(value)) return [];
  return value as UserHierarchyRecord[];
}

function writeStore(records: UserHierarchyRecord[]): void {
  globalScope()[GLOBAL_KEY] = records;
}

export function listHierarchyRecords(): UserHierarchyRecord[] {
  return readStore();
}

export function getPrimaryHierarchyForUser(
  userId: string
): UserHierarchyRecord | null {
  return (
    readStore().find(
      (r) => r.user_id === userId && r.is_primary && r.is_active
    ) ?? null
  );
}

export function upsertPrimaryHierarchy(input: {
  user_id: string;
  parent_user_id: string;
  hierarchy_level?: number;
  department_id?: string | null;
  team_id?: string | null;
}): UserHierarchyRecord {
  const records = readStore();
  const now = new Date().toISOString();
  const idx = records.findIndex(
    (r) => r.user_id === input.user_id && r.is_primary
  );

  const record: UserHierarchyRecord = {
    id: idx >= 0 ? records[idx].id : uid(),
    user_id: input.user_id,
    parent_user_id: input.parent_user_id,
    hierarchy_level: (input.hierarchy_level ?? 1) as UserHierarchyRecord["hierarchy_level"],
    department_id: input.department_id ?? null,
    team_id: input.team_id ?? null,
    is_active: true,
    is_primary: true,
    created_at: idx >= 0 ? records[idx].created_at : now,
    updated_at: now,
  };

  if (idx >= 0) {
    records[idx] = record;
  } else {
    records.push(record);
  }
  writeStore(records);
  return record;
}

export function deactivateHierarchyForUser(userId: string): void {
  const records = readStore().map((r) =>
    r.user_id === userId
      ? { ...r, is_active: false, updated_at: new Date().toISOString() }
      : r
  );
  writeStore(records);
}

export function initHierarchyFromUsers(
  users: {
    id: string;
    manager_id?: string | null;
    team_id?: string | null;
    is_active: boolean;
  }[],
  departmentIdForUser: (userId: string) => string | null
): void {
  if (readStore().length > 0) return;

  const records: UserHierarchyRecord[] = [];
  const now = new Date().toISOString();

  for (const u of users) {
    if (!u.manager_id) continue;
    records.push({
      id: uid(),
      user_id: u.id,
      parent_user_id: u.manager_id,
      hierarchy_level: 1,
      department_id: departmentIdForUser(u.id),
      team_id: u.team_id ?? null,
      is_active: u.is_active,
      is_primary: true,
      created_at: now,
      updated_at: now,
    });
  }
  writeStore(records);
}

export function replaceHierarchyStore(records: UserHierarchyRecord[]): void {
  writeStore(records);
}
