import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  initOrgPositionsFromSeed,
  listOrgPositions,
  replaceOrgPositionStore,
} from "@/lib/positions/store";
import type { OrgPosition, OrgPositionInput, OrgPositionStatus } from "@/types/flow";

function mapRow(row: Record<string, unknown>): OrgPosition {
  return {
    id: String(row.id),
    title: String(row.title),
    department_id: row.department_id ? String(row.department_id) : null,
    team_id: row.team_id ? String(row.team_id) : null,
    reports_to_position_id: row.reports_to_position_id
      ? String(row.reports_to_position_id)
      : null,
    position_level: row.position_level as OrgPosition["position_level"],
    position_type: row.position_type ? String(row.position_type) : "standard",
    status: row.status as OrgPositionStatus,
    assigned_user_id: row.assigned_user_id ? String(row.assigned_user_id) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function isOrgPositionsUnavailable(error: { code?: string; message?: string }): boolean {
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return error.message?.includes("org_positions") ?? false;
}

export async function hydrateOrgPositions(): Promise<OrgPosition[]> {
  if (!isSupabaseConfigured()) {
    return listOrgPositions();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("org_positions")
    .select("*")
    .order("title");

  if (error) {
    if (isOrgPositionsUnavailable(error)) return [];
    throw error;
  }

  const positions = (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  replaceOrgPositionStore(positions);
  return positions;
}

export async function ensureOrgPositionsLoaded(): Promise<OrgPosition[]> {
  if (listOrgPositions().length > 0) return listOrgPositions();
  return hydrateOrgPositions();
}

export async function insertOrgPositionDb(
  input: OrgPositionInput & { id?: string }
): Promise<OrgPosition> {
  const { createOrgPosition } = await import("@/lib/positions/store");

  if (!isSupabaseConfigured()) {
    return createOrgPosition(input);
  }

  const client = isAdminConfigured() ? createAdminClient() : await createClient();
  const now = new Date().toISOString();
  const payload = {
    title: input.title.trim(),
    department_id: input.department_id ?? null,
    team_id: input.team_id ?? null,
    reports_to_position_id: input.reports_to_position_id ?? null,
    position_level: input.position_level,
    position_type: input.position_type ?? "standard",
    status: input.status ?? (input.assigned_user_id ? "filled" : "vacant"),
    assigned_user_id: input.assigned_user_id ?? null,
    updated_at: now,
  };

  const { data, error } = await client
    .from("org_positions")
    .insert(payload)
    .select()
    .single();

  if (error) {
    if (isOrgPositionsUnavailable(error)) {
      return createOrgPosition(input);
    }
    throw new Error(error.hint ? `${error.message} (${error.hint})` : error.message);
  }

  const position = mapRow(data as Record<string, unknown>);
  replaceOrgPositionStore([...listOrgPositions(), position]);
  return position;
}

export async function updateOrgPositionDb(
  id: string,
  updates: Partial<OrgPositionInput> & { status?: OrgPositionStatus }
): Promise<OrgPosition | null> {
  const { updateOrgPosition } = await import("@/lib/positions/store");

  if (!isSupabaseConfigured()) {
    return updateOrgPosition(id, updates);
  }

  const client = isAdminConfigured() ? createAdminClient() : await createClient();
  const payload = {
    ...updates,
    ...(updates.title !== undefined ? { title: updates.title.trim() } : {}),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from("org_positions")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (isOrgPositionsUnavailable(error)) {
      return updateOrgPosition(id, updates);
    }
    throw new Error(error.hint ? `${error.message} (${error.hint})` : error.message);
  }
  if (!data) return null;

  const position = mapRow(data as Record<string, unknown>);
  replaceOrgPositionStore(
    listOrgPositions().map((p) => (p.id === id ? position : p))
  );
  return position;
}

export async function syncUserAssignedPositionDb(
  userId: string,
  positionId: string | null
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const client = isAdminConfigured() ? createAdminClient() : await createClient();
  const { error } = await client
    .from("users")
    .update({
      assigned_position_id: positionId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error && !isOrgPositionsUnavailable(error) && error.code !== "42703") {
    throw new Error(error.hint ? `${error.message} (${error.hint})` : error.message);
  }
}

/** Called during demo init only */
export function seedDemoOrgPositions(positions: OrgPosition[]): void {
  initOrgPositionsFromSeed(positions);
}
