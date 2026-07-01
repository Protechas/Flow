import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { assertPersistRow } from "@/lib/server/persist-row";
import {
  listProjectMetricDefinitions as listStoreDefinitions,
  replaceProjectMetricStore,
} from "@/lib/metrics/project-metrics-store";
import type { ProjectMetricDefinition, ProjectMetricValue } from "@/types/flow";

function mapDefinition(row: Record<string, unknown>): ProjectMetricDefinition {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    metric_name: String(row.metric_name),
    metric_description: row.metric_description ? String(row.metric_description) : null,
    metric_type: row.metric_type as ProjectMetricDefinition["metric_type"],
    target_value: row.target_value != null ? Number(row.target_value) : null,
    current_value: row.current_value != null ? String(row.current_value) : null,
    display_style: row.display_style as ProjectMetricDefinition["display_style"],
    sort_order: Number(row.sort_order ?? 0),
    is_required: row.is_required === true,
    is_formula: row.is_formula === true,
    formula_definition: (row.formula_definition as ProjectMetricDefinition["formula_definition"]) ?? null,
    is_archived: row.is_archived === true,
    created_at: String(row.created_at),
  };
}

function mapValue(row: Record<string, unknown>): ProjectMetricValue {
  return {
    id: String(row.id),
    metric_definition_id: String(row.metric_definition_id),
    current_value: String(row.current_value),
    previous_value: row.previous_value != null ? String(row.previous_value) : null,
    updated_by: row.updated_by ? String(row.updated_by) : null,
    updated_at: String(row.updated_at),
  };
}

function isMetricsUnavailable(error: { code?: string; message?: string }): boolean {
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return (
    error.message?.includes("project_metric_definitions") ||
    error.message?.includes("project_metric_values") ||
    false
  );
}

export async function hydrateProjectMetrics(): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  const [defRes, valRes] = await Promise.all([
    supabase.from("project_metric_definitions").select("*"),
    supabase.from("project_metric_values").select("*").order("updated_at", { ascending: false }).limit(5000),
  ]);

  if (defRes.error && !isMetricsUnavailable(defRes.error)) throw defRes.error;
  if (valRes.error && !isMetricsUnavailable(valRes.error)) throw valRes.error;

  const definitions = (defRes.data ?? []).map((r) => mapDefinition(r as Record<string, unknown>));
  const values = (valRes.data ?? []).map((r) => mapValue(r as Record<string, unknown>));
  if (definitions.length) replaceProjectMetricStore(definitions, values);
}

export async function ensureProjectMetricsHydrated(): Promise<void> {
  if (listStoreDefinitions().length > 0) return;
  await hydrateProjectMetrics();
}

export async function persistMetricDefinition(
  definition: ProjectMetricDefinition
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const client = isAdminConfigured() ? createAdminClient() : await createClient();
  const payload = {
    id: definition.id,
    project_id: definition.project_id,
    metric_name: definition.metric_name,
    metric_description: definition.metric_description,
    metric_type: definition.metric_type,
    target_value: definition.target_value,
    current_value: definition.current_value,
    display_style: definition.display_style,
    sort_order: definition.sort_order,
    is_required: definition.is_required,
    is_formula: definition.is_formula,
    formula_definition: definition.formula_definition,
    is_archived: definition.is_archived,
    created_at: definition.created_at,
  };
  assertPersistRow("project_metric_definitions", payload, ["id", "project_id"]);
  const { error } = await client.from("project_metric_definitions").upsert(payload);
  if (error && !isMetricsUnavailable(error)) throw error;
}

export async function persistMetricValue(value: ProjectMetricValue): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const client = isAdminConfigured() ? createAdminClient() : await createClient();
  const row = {
    id: value.id,
    metric_definition_id: value.metric_definition_id,
    current_value: value.current_value,
    previous_value: value.previous_value,
    updated_by: value.updated_by,
    updated_at: value.updated_at,
  };
  assertPersistRow("project_metric_values", row, ["id", "metric_definition_id"], ["updated_by"]);
  const { error } = await client.from("project_metric_values").insert(row);
  if (error && !isMetricsUnavailable(error)) throw error;
}
