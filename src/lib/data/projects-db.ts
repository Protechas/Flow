import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  getFlowStore,
  initFlowStore,
  listManufacturersStore,
  listProjectsStore,
  replaceProjectsStructureStore,
} from "@/lib/data/flow-store";
import { isHydrationFresh, markHydrated } from "@/lib/data/hydration-cache";
import type { Manufacturer, Project, WorkPriority } from "@/types/flow";

function isUnavailable(error: { code?: string; message?: string }): boolean {
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const msg = error.message ?? "";
  // Missing-table/schema errors only — matching bare table names swallowed
  // real failures (FK violations mention the table name too).
  return msg.includes("does not exist") || msg.includes("schema cache");
}

function isMissingColumn(error: { code?: string; message?: string }): boolean {
  return error.code === "42703";
}

function uuidOrNull(value?: string | null): string | null {
  if (!value) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function mapProject(row: Record<string, unknown>): Project {
  const manualDue = row.manual_project_due_date ? String(row.manual_project_due_date) : null;
  const due = row.due_date ? String(row.due_date) : manualDue;
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    project_type: row.project_type ? String(row.project_type) : "custom",
    structure_mode: row.structure_mode ? String(row.structure_mode) : null,
    department_id: row.department_id ? String(row.department_id) : null,
    team_id: row.team_id ? String(row.team_id) : null,
    is_cross_department: Boolean(row.is_cross_department),
    status: String(row.status ?? "active"),
    priority: (row.priority as WorkPriority) ?? "medium",
    forecast_unit: row.forecast_unit ? String(row.forecast_unit) : null,
    start_date: row.start_date ? String(row.start_date) : null,
    due_date: due,
    end_date: row.end_date ? String(row.end_date) : null,
    project_owner_id: row.project_owner_id ? String(row.project_owner_id) : null,
    created_by: row.created_by ? String(row.created_by) : null,
    estimated_total_documents:
      row.estimated_total_documents != null ? Number(row.estimated_total_documents) : null,
    estimated_total_hours:
      row.estimated_total_hours != null ? Number(row.estimated_total_hours) : null,
    estimated_total_work_days:
      row.estimated_total_work_days != null ? Number(row.estimated_total_work_days) : null,
    suggested_project_due_date: row.suggested_project_due_date
      ? String(row.suggested_project_due_date)
      : null,
    manual_project_due_date: manualDue,
    planning_project_due_date: row.planning_project_due_date
      ? String(row.planning_project_due_date)
      : null,
    active_project_due_date: row.active_project_due_date
      ? String(row.active_project_due_date)
      : null,
    project_due_date_status: row.project_due_date_status
      ? (String(row.project_due_date_status) as Project["project_due_date_status"])
      : null,
    forecast_confidence:
      row.forecast_confidence != null ? Number(row.forecast_confidence) : null,
    planning_complexity_level: row.planning_complexity_level
      ? (String(row.planning_complexity_level) as Project["planning_complexity_level"])
      : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapManufacturer(row: Record<string, unknown>): Manufacturer {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    name: String(row.name),
    code: row.code ? String(row.code) : null,
    assigned_to: null,
    status: "not_started",
    priority: "medium",
    due_date: null,
    notes: row.notes ? String(row.notes) : null,
    is_archived: false,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function projectToRow(project: Project, extended = true): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: project.id,
    name: project.name,
    description: project.description ?? null,
    team_id: uuidOrNull(project.team_id),
    department_id: uuidOrNull(project.department_id),
    is_cross_department: project.is_cross_department ?? false,
    status: project.status,
    start_date: project.start_date ?? null,
    end_date: project.end_date ?? project.due_date ?? null,
    created_by: uuidOrNull(project.created_by ?? project.project_owner_id),
    created_at: project.created_at,
    updated_at: project.updated_at,
  };

  if (!extended) return base;

  return {
    ...base,
    project_type: project.project_type ?? "custom",
    structure_mode: project.structure_mode ?? null,
    priority: project.priority ?? "medium",
    forecast_unit: project.forecast_unit ?? null,
    project_owner_id: uuidOrNull(project.project_owner_id),
    due_date: project.due_date ?? null,
    estimated_total_documents: project.estimated_total_documents ?? null,
    estimated_total_hours: project.estimated_total_hours ?? null,
    estimated_total_work_days: project.estimated_total_work_days ?? null,
    suggested_project_due_date: project.suggested_project_due_date ?? null,
    manual_project_due_date: project.manual_project_due_date ?? project.due_date ?? null,
    planning_project_due_date: project.planning_project_due_date ?? null,
    active_project_due_date: project.active_project_due_date ?? null,
    project_due_date_status: project.project_due_date_status ?? null,
    forecast_confidence: project.forecast_confidence ?? null,
    planning_complexity_level: project.planning_complexity_level ?? null,
  };
}

function manufacturerToRow(mfr: Manufacturer): Record<string, unknown> {
  return {
    id: mfr.id,
    project_id: mfr.project_id,
    name: mfr.name,
    code: mfr.code ?? mfr.name.slice(0, 3).toUpperCase(),
    notes: mfr.notes ?? null,
    created_at: mfr.created_at,
    updated_at: mfr.updated_at,
  };
}

async function dbClient() {
  return isAdminConfigured() ? createAdminClient() : await createClient();
}

function throwDbError(error: { message?: string; hint?: string }): never {
  throw new Error(error.hint ? `${error.message} (${error.hint})` : (error.message ?? "DB_ERROR"));
}

export async function hydrateProjectsStructure(): Promise<{
  projects: Project[];
  manufacturers: Manufacturer[];
}> {
  if (!isSupabaseConfigured()) {
    initFlowStore();
    const store = getFlowStore();
    return { projects: store.projects, manufacturers: store.manufacturers };
  }

  const client = await dbClient();
  const [projRes, mfrRes] = await Promise.all([
    client.from("projects").select("*").order("name"),
    client.from("manufacturers").select("*").order("name"),
  ]);

  if (projRes.error && !isUnavailable(projRes.error)) throw projRes.error;
  if (mfrRes.error && !isUnavailable(mfrRes.error)) throw mfrRes.error;

  const projects = (projRes.data ?? []).map((r) => mapProject(r as Record<string, unknown>));
  const manufacturers = (mfrRes.data ?? []).map((r) =>
    mapManufacturer(r as Record<string, unknown>)
  );

  replaceProjectsStructureStore(projects, manufacturers);
  markHydrated("projects");
  return { projects, manufacturers };
}

export const ensureProjectsHydrated = cache(async (): Promise<void> => {
  initFlowStore();
  if (!isSupabaseConfigured()) return;
  if (isHydrationFresh("projects")) return;
  await hydrateProjectsStructure();
});

export async function insertProjectDb(project: Project): Promise<Project> {
  if (!isSupabaseConfigured()) return project;

  const client = await dbClient();
  let { data, error } = await client
    .from("projects")
    .insert(projectToRow(project))
    .select()
    .single();

  if (error && isMissingColumn(error)) {
    ({ data, error } = await client
      .from("projects")
      .insert(projectToRow(project, false))
      .select()
      .single());
  }

  if (error) {
    if (isUnavailable(error)) return project;
    throwDbError(error);
  }

  const saved = mapProject(data as Record<string, unknown>);
  const existing = listProjectsStore();
  replaceProjectsStructureStore(
    [saved, ...existing.filter((p) => p.id !== saved.id)],
    listManufacturersStore()
  );
  return saved;
}

export async function updateProjectDb(
  id: string,
  updates: Partial<Project>
): Promise<Project | null> {
  if (!isSupabaseConfigured()) return null;

  const current = listProjectsStore().find((p) => p.id === id);
  if (!current) return null;

  const merged = { ...current, ...updates, updated_at: new Date().toISOString() };
  const client = await dbClient();
  let { data, error } = await client
    .from("projects")
    .update(projectToRow(merged))
    .eq("id", id)
    .select()
    .single();

  if (error && isMissingColumn(error)) {
    ({ data, error } = await client
      .from("projects")
      .update(projectToRow(merged, false))
      .eq("id", id)
      .select()
      .single());
  }

  if (error) {
    if (isUnavailable(error)) return merged;
    throwDbError(error);
  }
  if (!data) return null;

  const saved = mapProject(data as Record<string, unknown>);
  replaceProjectsStructureStore(
    listProjectsStore().map((p) => (p.id === id ? saved : p)),
    listManufacturersStore()
  );
  return saved;
}

export async function deleteProjectDb(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const client = await dbClient();
  const { error: mfrError } = await client.from("manufacturers").delete().eq("project_id", id);
  if (mfrError && !isUnavailable(mfrError)) throwDbError(mfrError);

  const { error } = await client.from("projects").delete().eq("id", id);
  if (error && !isUnavailable(error)) throwDbError(error);
}

export async function syncManufacturersForProject(projectId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  initFlowStore();
  const mfrs = getFlowStore().manufacturers.filter((m) => m.project_id === projectId);
  if (mfrs.length === 0) return;

  const client = await dbClient();
  const { error } = await client.from("manufacturers").upsert(
    mfrs.map(manufacturerToRow),
    { onConflict: "id" }
  );

  if (error && !isUnavailable(error)) throwDbError(error);

  const merged = [...listManufacturersStore()];
  for (const mfr of mfrs) {
    const idx = merged.findIndex((m) => m.id === mfr.id);
    if (idx >= 0) merged[idx] = mfr;
    else merged.unshift(mfr);
  }
  replaceProjectsStructureStore(listProjectsStore(), merged);
}

export async function persistNewProject(project: Project): Promise<Project> {
  const saved = await insertProjectDb(project);
  await syncManufacturersForProject(saved.id);
  return saved;
}

export async function persistProjectUpdate(
  id: string,
  updates: Partial<Project>
): Promise<Project | null> {
  return updateProjectDb(id, updates);
}

export async function persistProjectRemoval(id: string): Promise<void> {
  await deleteProjectDb(id);
}
