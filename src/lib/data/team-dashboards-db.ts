import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { ADVANCED_PROJECTS_PACK } from "@/lib/team-dashboards/advanced-projects";
import {
  defaultTeamDashboardPacks,
  replaceTeamDashboardPacksInStore,
  type TeamDashboardPackRecord,
} from "@/lib/team-dashboards/store";
import type { TeamDashboardPack } from "@/lib/team-dashboards/types";

function isUnavailable(error: { code?: string; message?: string }): boolean {
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return (error.message ?? "").includes("does not exist");
}

function rowToPack(row: {
  id: string;
  slug: string;
  label: string;
  description: string;
  definition: unknown;
  is_active: boolean;
  sort_order: number;
  updated_at: string;
  updated_by: string | null;
}): TeamDashboardPackRecord {
  const definition = (row.definition ?? {}) as TeamDashboardPack;
  return {
    ...definition,
    slug: row.slug,
    label: row.label,
    description: row.description || definition.description || "",
    id: row.id,
    is_active: row.is_active,
    sort_order: row.sort_order,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  };
}

export async function hydrateTeamDashboardPacksFromSupabase(): Promise<TeamDashboardPackRecord[]> {
  if (!isSupabaseConfigured()) {
    const defaults = defaultTeamDashboardPacks();
    replaceTeamDashboardPacksInStore(defaults);
    return defaults;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("team_dashboard_packs")
    .select("id, slug, label, description, definition, is_active, sort_order, updated_at, updated_by")
    .order("sort_order", { ascending: true });

  if (error) {
    if (isUnavailable(error)) {
      const defaults = defaultTeamDashboardPacks();
      replaceTeamDashboardPacksInStore(defaults);
      return defaults;
    }
    throw new Error(error.message);
  }

  if (!data?.length) {
    await seedDefaultTeamDashboardPack();
    return hydrateTeamDashboardPacksFromSupabase();
  }

  const packs = data.map((row) => rowToPack(row as Parameters<typeof rowToPack>[0]));
  replaceTeamDashboardPacksInStore(packs);
  return packs;
}

async function seedDefaultTeamDashboardPack(): Promise<void> {
  const supabase = await createClient();
  const pack = ADVANCED_PROJECTS_PACK;
  const { error } = await supabase.from("team_dashboard_packs").insert({
    slug: pack.slug,
    label: pack.label,
    description: pack.description,
    definition: pack,
    is_active: true,
    sort_order: 0,
  });
  if (error && !isUnavailable(error) && !error.message.includes("duplicate")) {
    throw new Error(error.message);
  }
}

export async function persistTeamDashboardPackToSupabase(
  pack: TeamDashboardPackRecord,
  userId: string
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  const row = {
    slug: pack.slug,
    label: pack.label,
    description: pack.description,
    definition: {
      eyebrow: pack.eyebrow,
      projectScope: pack.projectScope,
      kpis: pack.kpis,
      showProjectPortfolio: pack.showProjectPortfolio,
      nav: pack.nav,
      access: pack.access,
    },
    is_active: pack.is_active ?? true,
    sort_order: pack.sort_order ?? 0,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  const { data: existing } = await supabase
    .from("team_dashboard_packs")
    .select("id")
    .eq("slug", pack.slug)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase.from("team_dashboard_packs").update(row).eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("team_dashboard_packs").insert(row);
    if (error) throw new Error(error.message);
  }
}

export async function deleteTeamDashboardPackFromSupabase(slug: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  const { error } = await supabase.from("team_dashboard_packs").delete().eq("slug", slug);
  if (error && !isUnavailable(error)) throw new Error(error.message);
}
