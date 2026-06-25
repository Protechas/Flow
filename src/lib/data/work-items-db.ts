import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  getFlowStore,
  initFlowStore,
  replaceWorkStructureStore,
} from "@/lib/data/flow-store";
import { syncManufacturersForProject } from "@/lib/data/projects-db";
import type {
  ForecastComplexityLevel,
  ForecastMode,
  LiveForecastStatus,
  Manufacturer,
  Project,
  QaStatus,
  WorkPackage,
  WorkPriority,
  WorkStatus,
  YearWorkItem,
} from "@/types/flow";
import { resolveWorkPackageTrackingFlags } from "@/lib/work-packages/tracking-flags";

function isUnavailable(error: { code?: string; message?: string }): boolean {
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const msg = error.message ?? "";
  return (
    msg.includes("work_items") ||
    msg.includes("year_work_items") ||
    msg.includes("does not exist")
  );
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

function num(value: unknown, fallback = 0): number {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function str(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value);
  return s.length ? s : null;
}

async function dbClient() {
  return isAdminConfigured() ? createAdminClient() : await createClient();
}

function throwDbError(error: { message?: string; hint?: string }): never {
  throw new Error(error.hint ? `${error.message} (${error.hint})` : (error.message ?? "DB_ERROR"));
}

function mapYearWorkItem(row: Record<string, unknown>): YearWorkItem {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    manufacturer_id: String(row.manufacturer_id),
    year: Number(row.year),
    assigned_to: row.assigned_to ? String(row.assigned_to) : null,
    status: String(row.status ?? "not_started") as WorkStatus,
    priority: (row.priority as WorkPriority) ?? "medium",
    due_date: str(row.due_date),
    estimated_hours: num(row.estimated_hours),
    actual_hours: num(row.actual_hours),
    file_count: num(row.file_count),
    notes: str(row.notes),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapWorkPackage(row: Record<string, unknown>): WorkPackage {
  const manualDue = str(row.manual_due_date);
  const due = str(row.due_date) ?? manualDue;
  const notes = str(row.notes);
  const tracking = resolveWorkPackageTrackingFlags({
    qa_required: row.qa_required != null ? Boolean(row.qa_required) : undefined,
    files_required: row.files_required != null ? Boolean(row.files_required) : undefined,
    notes,
  });
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    manufacturer_id: String(row.manufacturer_id),
    year_work_item_id: row.year_work_item_id ? String(row.year_work_item_id) : "",
    year: Number(row.year),
    department_id: row.department_id ? String(row.department_id) : null,
    title: String(row.title),
    notes,
    description: str(row.description),
    assigned_to: row.assigned_to ? String(row.assigned_to) : null,
    status: String(row.status ?? "not_started") as WorkStatus,
    priority: (row.priority as WorkPriority) ?? "medium",
    due_date: due,
    start_date: str(row.start_date),
    completed_date: str(row.completed_date),
    estimated_hours: num(row.estimated_hours),
    actual_hours: num(row.actual_hours),
    estimated_document_count:
      row.estimated_document_count != null ? Number(row.estimated_document_count) : null,
    complexity_level: row.complexity_level
      ? (String(row.complexity_level) as ForecastComplexityLevel)
      : null,
    complexity_multiplier:
      row.complexity_multiplier != null ? Number(row.complexity_multiplier) : null,
    estimated_minutes_per_document:
      row.estimated_minutes_per_document != null
        ? Number(row.estimated_minutes_per_document)
        : null,
    estimated_work_minutes:
      row.estimated_work_minutes != null ? Number(row.estimated_work_minutes) : null,
    estimated_work_hours:
      row.estimated_work_hours != null ? Number(row.estimated_work_hours) : null,
    estimated_work_days:
      row.estimated_work_days != null ? Number(row.estimated_work_days) : null,
    suggested_due_date: str(row.suggested_due_date),
    manual_due_date: manualDue,
    due_date_status: row.due_date_status
      ? (String(row.due_date_status) as WorkPackage["due_date_status"])
      : null,
    forecast_last_calculated: str(row.forecast_last_calculated),
    assigned_at: str(row.assigned_at),
    started_at: str(row.started_at),
    forecast_mode: row.forecast_mode ? (String(row.forecast_mode) as ForecastMode) : null,
    planning_due_date: str(row.planning_due_date),
    active_due_date: str(row.active_due_date),
    forecast_start_date: str(row.forecast_start_date),
    completed_at: str(row.completed_at),
    estimated_remaining_documents:
      row.estimated_remaining_documents != null
        ? Number(row.estimated_remaining_documents)
        : null,
    current_documents_completed:
      row.current_documents_completed != null ? Number(row.current_documents_completed) : null,
    current_production_rate:
      row.current_production_rate != null ? Number(row.current_production_rate) : null,
    forecast_last_updated: str(row.forecast_last_updated),
    live_forecast_status: row.live_forecast_status
      ? (String(row.live_forecast_status) as LiveForecastStatus)
      : null,
    forecast_variance_days:
      row.forecast_variance_days != null ? Number(row.forecast_variance_days) : null,
    file_count: num(row.file_count),
    qa_status: (row.qa_status as QaStatus) ?? "pending",
    correction_count: num(row.correction_count),
    qa_required: tracking.qaRequired,
    files_required: tracking.filesRequired,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function yearToRow(item: YearWorkItem): Record<string, unknown> {
  return {
    id: item.id,
    project_id: item.project_id,
    manufacturer_id: item.manufacturer_id,
    year: item.year,
    assigned_to: uuidOrNull(item.assigned_to),
    status: item.status,
    priority: item.priority,
    due_date: item.due_date ?? null,
    estimated_hours: item.estimated_hours,
    actual_hours: item.actual_hours,
    file_count: item.file_count,
    notes: item.notes ?? null,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

function packageToRow(pkg: WorkPackage, extended = true): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: pkg.id,
    project_id: pkg.project_id,
    manufacturer_id: pkg.manufacturer_id,
    year: pkg.year,
    title: pkg.title,
    description: pkg.description ?? pkg.notes ?? null,
    assigned_to: uuidOrNull(pkg.assigned_to),
    status: pkg.status,
    priority: pkg.priority,
    due_date: pkg.due_date ?? pkg.manual_due_date ?? null,
    start_date: pkg.start_date ?? null,
    completed_date: pkg.completed_date ?? null,
    estimated_hours: pkg.estimated_hours ?? 0,
    actual_hours: pkg.actual_hours ?? 0,
    qa_status: pkg.qa_status ?? "pending",
    correction_count: pkg.correction_count ?? 0,
    file_count: pkg.file_count ?? 0,
    qa_required: pkg.qa_required ?? true,
    files_required: pkg.files_required ?? false,
    notes: pkg.notes ?? null,
    created_at: pkg.created_at,
    updated_at: pkg.updated_at,
  };

  if (!extended) return base;

  return {
    ...base,
    department_id: uuidOrNull(pkg.department_id),
    year_work_item_id: uuidOrNull(pkg.year_work_item_id),
    estimated_document_count: pkg.estimated_document_count ?? null,
    complexity_level: pkg.complexity_level ?? null,
    complexity_multiplier: pkg.complexity_multiplier ?? null,
    estimated_minutes_per_document: pkg.estimated_minutes_per_document ?? null,
    estimated_work_minutes: pkg.estimated_work_minutes ?? null,
    estimated_work_hours: pkg.estimated_work_hours ?? null,
    estimated_work_days: pkg.estimated_work_days ?? null,
    suggested_due_date: pkg.suggested_due_date ?? null,
    manual_due_date: pkg.manual_due_date ?? pkg.due_date ?? null,
    due_date_status: pkg.due_date_status ?? null,
    forecast_last_calculated: pkg.forecast_last_calculated ?? null,
    assigned_at: pkg.assigned_at ?? null,
    started_at: pkg.started_at ?? null,
    forecast_mode: pkg.forecast_mode ?? null,
    planning_due_date: pkg.planning_due_date ?? null,
    active_due_date: pkg.active_due_date ?? null,
    forecast_start_date: pkg.forecast_start_date ?? null,
    completed_at: pkg.completed_at ?? null,
    estimated_remaining_documents: pkg.estimated_remaining_documents ?? null,
    current_documents_completed: pkg.current_documents_completed ?? null,
    current_production_rate: pkg.current_production_rate ?? null,
    forecast_last_updated: pkg.forecast_last_updated ?? null,
    live_forecast_status: pkg.live_forecast_status ?? null,
    forecast_variance_days: pkg.forecast_variance_days ?? null,
  };
}

export async function hydrateWorkStructure(): Promise<{
  yearWorkItems: YearWorkItem[];
  workPackages: WorkPackage[];
}> {
  if (!isSupabaseConfigured()) {
    initFlowStore();
    const store = getFlowStore();
    return { yearWorkItems: store.yearWorkItems, workPackages: store.workPackages };
  }

  const client = await dbClient();
  const [yearRes, pkgRes] = await Promise.all([
    client.from("year_work_items").select("*").order("year", { ascending: false }),
    client.from("work_items").select("*").order("updated_at", { ascending: false }),
  ]);

  if (yearRes.error && !isUnavailable(yearRes.error)) throw yearRes.error;
  if (pkgRes.error && !isUnavailable(pkgRes.error)) throw pkgRes.error;

  const yearWorkItems = (yearRes.data ?? []).map((r) =>
    mapYearWorkItem(r as Record<string, unknown>)
  );
  let workPackages = (pkgRes.data ?? []).map((r) => mapWorkPackage(r as Record<string, unknown>));

  const yearByMfrYear = new Map(
    yearWorkItems.map((y) => [`${y.manufacturer_id}:${y.year}`, y.id])
  );
  workPackages = workPackages.map((p) =>
    p.year_work_item_id
      ? p
      : {
          ...p,
          year_work_item_id:
            yearByMfrYear.get(`${p.manufacturer_id}:${p.year}`) ?? p.year_work_item_id,
        }
  );

  replaceWorkStructureStore(yearWorkItems, workPackages);
  return { yearWorkItems, workPackages };
}

export const ensureWorkStructureHydrated = cache(async (): Promise<void> => {
  initFlowStore();
  if (!isSupabaseConfigured()) return;
  await hydrateWorkStructure();
});

export async function persistYearWorkItemDb(item: YearWorkItem): Promise<YearWorkItem> {
  if (!isSupabaseConfigured()) return item;

  const client = await dbClient();
  const { data, error } = await client
    .from("year_work_items")
    .upsert(yearToRow(item), { onConflict: "id" })
    .select()
    .single();

  if (error && isUnavailable(error)) return item;
  if (error) throwDbError(error);
  if (!data) return item;

  const saved = mapYearWorkItem(data as Record<string, unknown>);
  const store = getFlowStore();
  const merged = [...store.yearWorkItems.filter((y) => y.id !== saved.id), saved];
  replaceWorkStructureStore(merged, store.workPackages);
  return saved;
}

export async function persistWorkPackageDb(pkg: WorkPackage): Promise<WorkPackage> {
  if (!isSupabaseConfigured()) return pkg;

  const client = await dbClient();
  let { data, error } = await client
    .from("work_items")
    .upsert(packageToRow(pkg), { onConflict: "id" })
    .select()
    .single();

  if (error && isMissingColumn(error)) {
    ({ data, error } = await client
      .from("work_items")
      .upsert(packageToRow(pkg, false), { onConflict: "id" })
      .select()
      .single());
  }

  if (error && isUnavailable(error)) return pkg;
  if (error) throwDbError(error);
  if (!data) return pkg;

  const saved = mapWorkPackage(data as Record<string, unknown>);
  const store = getFlowStore();
  const merged = [...store.workPackages.filter((p) => p.id !== saved.id), saved];
  replaceWorkStructureStore(store.yearWorkItems, merged);
  return saved;
}

export async function deleteWorkPackageDb(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const client = await dbClient();
  const { error } = await client.from("work_items").delete().eq("id", id);
  if (error && !isUnavailable(error)) throwDbError(error);
}

export async function deleteYearWorkItemDb(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const client = await dbClient();
  const { error } = await client.from("year_work_items").delete().eq("id", id);
  if (error && !isUnavailable(error)) throwDbError(error);
}

export async function persistQuickTaskChain(
  task: WorkPackage,
  project?: Project | null
): Promise<WorkPackage> {
  if (!isSupabaseConfigured()) return task;

  if (project) {
    const { persistNewProject } = await import("@/lib/data/projects-db");
    await persistNewProject(project);
  }

  const store = getFlowStore();
  const mfr = store.manufacturers.find((m) => m.id === task.manufacturer_id);
  if (mfr) await syncManufacturersForProject(mfr.project_id);

  const year = store.yearWorkItems.find((y) => y.id === task.year_work_item_id);
  if (year) await persistYearWorkItemDb(year);

  return persistWorkPackageDb(task);
}

export async function persistWorkStructureForProject(projectId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  await syncManufacturersForProject(projectId);
  const store = getFlowStore();
  for (const year of store.yearWorkItems.filter((y) => y.project_id === projectId)) {
    await persistYearWorkItemDb(year);
  }
  for (const pkg of store.workPackages.filter((p) => p.project_id === projectId)) {
    await persistWorkPackageDb(pkg);
  }
}

export async function persistManufacturerChange(mfr: Manufacturer): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await syncManufacturersForProject(mfr.project_id);
}
