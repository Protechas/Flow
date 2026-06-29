import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { DEFAULT_OPERATING_MODEL_PRESETS } from "@/lib/operating-models/presets";
import {
  defaultOperatingModels,
  replaceOperatingModelsInStore,
} from "@/lib/operating-models/store";
import type { TeamOperatingModel, TeamOperatingModelRecord } from "@/lib/operating-models/types";

function isUnavailable(error: { code?: string; message?: string }): boolean {
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return (error.message ?? "").includes("does not exist");
}

function rowToModel(row: {
  id: string;
  slug: string;
  label: string;
  description: string;
  department_id: string | null;
  team_id: string | null;
  definition: unknown;
  is_general: boolean;
  is_active: boolean;
  sort_order: number;
  updated_at: string;
  updated_by: string | null;
}): TeamOperatingModelRecord {
  const definition = (row.definition ?? {}) as TeamOperatingModel;
  return {
    ...definition,
    slug: row.slug,
    label: row.label,
    description: row.description || definition.description || "",
    departmentId: row.department_id ?? definition.departmentId,
    teamId: row.team_id ?? definition.teamId,
    isGeneral: row.is_general || definition.isGeneral,
    id: row.id,
    is_active: row.is_active,
    sort_order: row.sort_order,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  };
}

export async function hydrateOperatingModelsFromSupabase(): Promise<TeamOperatingModelRecord[]> {
  if (!isSupabaseConfigured()) {
    const defaults = defaultOperatingModels();
    replaceOperatingModelsInStore(defaults);
    return defaults;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("team_operating_models")
    .select(
      "id, slug, label, description, department_id, team_id, definition, is_general, is_active, sort_order, updated_at, updated_by"
    )
    .order("sort_order", { ascending: true });

  if (error) {
    if (isUnavailable(error)) {
      const defaults = defaultOperatingModels();
      replaceOperatingModelsInStore(defaults);
      return defaults;
    }
    throw new Error(error.message);
  }

  if (!data?.length) {
    await seedDefaultOperatingModels();
    return hydrateOperatingModelsFromSupabase();
  }

  const models = data.map((row) => rowToModel(row as Parameters<typeof rowToModel>[0]));
  replaceOperatingModelsInStore(models);
  return models;
}

async function seedDefaultOperatingModels(): Promise<void> {
  const supabase = await createClient();
  const rows = DEFAULT_OPERATING_MODEL_PRESETS.map((model, i) => ({
    slug: model.slug,
    label: model.label,
    description: model.description,
    department_id: model.departmentId ?? null,
    team_id: model.teamId ?? null,
    definition: model,
    is_general: model.isGeneral ?? false,
    is_active: true,
    sort_order: i,
  }));

  const { error } = await supabase.from("team_operating_models").insert(rows);
  if (error && !isUnavailable(error) && !error.message.includes("duplicate")) {
    throw new Error(error.message);
  }
}

export async function persistOperatingModelToSupabase(
  model: TeamOperatingModelRecord,
  userId: string
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  const row = {
    slug: model.slug,
    label: model.label,
    description: model.description,
    department_id: model.departmentId ?? null,
    team_id: model.teamId ?? null,
    definition: {
      hierarchyLabels: model.hierarchyLabels,
      structureMode: model.structureMode,
      projectTypes: model.projectTypes,
      defaultProjectType: model.defaultProjectType,
      taskTypes: model.taskTypes,
      trackingFields: model.trackingFields,
      kpis: model.kpis,
      forecastRules: model.forecastRules,
      taskDefaults: model.taskDefaults,
      isGeneral: model.isGeneral,
    },
    is_general: model.isGeneral ?? false,
    is_active: model.is_active ?? true,
    sort_order: model.sort_order ?? 0,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  const { data: existing } = await supabase
    .from("team_operating_models")
    .select("id")
    .eq("slug", model.slug)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase.from("team_operating_models").update(row).eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("team_operating_models").insert(row);
    if (error) throw new Error(error.message);
  }
}

export async function deleteOperatingModelFromSupabase(slug: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("team_operating_models")
    .delete()
    .eq("slug", slug)
    .eq("is_general", false);
  if (error && !isUnavailable(error)) throw new Error(error.message);
}
