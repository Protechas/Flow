import type { OrgPosition, OrgPositionInput, OrgPositionStatus } from "@/types/flow";

const GLOBAL_KEY = "__flow_org_positions__";

function globalScope(): Record<string, unknown> {
  return globalThis as typeof globalThis & Record<string, unknown>;
}

function uid() {
  return `pos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ts() {
  return new Date().toISOString();
}

function readStore(): OrgPosition[] {
  const value = globalScope()[GLOBAL_KEY];
  if (!Array.isArray(value)) return [];
  return value as OrgPosition[];
}

function writeStore(positions: OrgPosition[]): void {
  globalScope()[GLOBAL_KEY] = positions;
}

export function listOrgPositions(): OrgPosition[] {
  return readStore();
}

export function getOrgPositionById(id: string): OrgPosition | null {
  return readStore().find((p) => p.id === id) ?? null;
}

export function getPositionForUser(userId: string): OrgPosition | null {
  return readStore().find((p) => p.assigned_user_id === userId) ?? null;
}

export function listActiveOrgPositions(): OrgPosition[] {
  return readStore().filter((p) => p.status !== "inactive");
}

export function createOrgPosition(input: OrgPositionInput): OrgPosition {
  const positions = readStore();
  const now = ts();
  const status: OrgPositionStatus =
    input.status ??
    (input.assigned_user_id ? "filled" : "vacant");

  const position: OrgPosition = {
    id: uid(),
    title: input.title.trim(),
    department_id: input.department_id ?? null,
    team_id: input.team_id ?? null,
    reports_to_position_id: input.reports_to_position_id ?? null,
    position_level: input.position_level,
    position_type: input.position_type ?? "standard",
    status,
    assigned_user_id: input.assigned_user_id ?? null,
    created_at: now,
    updated_at: now,
  };

  positions.push(position);
  writeStore(positions);
  return position;
}

export function updateOrgPosition(
  id: string,
  updates: Partial<OrgPositionInput> & { status?: OrgPositionStatus }
): OrgPosition | null {
  const positions = readStore();
  const idx = positions.findIndex((p) => p.id === id);
  if (idx < 0) return null;

  const current = positions[idx];
  const next: OrgPosition = {
    ...current,
    ...updates,
    title: updates.title !== undefined ? updates.title.trim() : current.title,
    updated_at: ts(),
  };

  if (updates.assigned_user_id !== undefined) {
    next.assigned_user_id = updates.assigned_user_id;
    if (updates.status === undefined) {
      next.status = updates.assigned_user_id ? "filled" : current.status === "filled" ? "vacant" : current.status;
    }
  }

  positions[idx] = next;
  writeStore(positions);
  return next;
}

export function archiveOrgPosition(id: string): OrgPosition | null {
  return updateOrgPosition(id, {
    status: "inactive",
    assigned_user_id: null,
  });
}

export function clearUserFromPositions(userId: string): void {
  const positions = readStore().map((p) =>
    p.assigned_user_id === userId
      ? {
          ...p,
          assigned_user_id: null,
          status: p.status === "filled" ? ("vacant" as const) : p.status,
          updated_at: ts(),
        }
      : p
  );
  writeStore(positions);
}

export function assignUserToPositionRecord(
  positionId: string,
  userId: string | null
): OrgPosition | null {
  const positions = readStore();

  if (userId) {
    for (let i = 0; i < positions.length; i++) {
      if (positions[i].assigned_user_id === userId && positions[i].id !== positionId) {
        positions[i] = {
          ...positions[i],
          assigned_user_id: null,
          status: positions[i].status === "filled" ? "vacant" : positions[i].status,
          updated_at: ts(),
        };
      }
    }
  }

  const idx = positions.findIndex((p) => p.id === positionId);
  if (idx < 0) return null;

  const next: OrgPosition = {
    ...positions[idx],
    assigned_user_id: userId,
    status: userId ? "filled" : positions[idx].status === "planned" ? "planned" : "vacant",
    updated_at: ts(),
  };
  positions[idx] = next;
  writeStore(positions);
  return next;
}

export function moveOrgPosition(
  positionId: string,
  reportsToPositionId: string | null
): OrgPosition | null {
  if (reportsToPositionId === positionId) return null;
  return updateOrgPosition(positionId, {
    reports_to_position_id: reportsToPositionId,
  });
}

export function replaceOrgPositionStore(positions: OrgPosition[]): void {
  writeStore(positions);
}

export function initOrgPositionsFromSeed(positions: OrgPosition[]): void {
  if (readStore().length > 0) return;
  writeStore(positions);
}

export function hasOrgPositions(): boolean {
  return listActiveOrgPositions().length > 0;
}
