"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import {
  deleteTeamDashboardPackFromSupabase,
  persistTeamDashboardPackToSupabase,
} from "@/lib/data/team-dashboards-db";
import { hydrateTeamDashboardPacks } from "@/lib/team-dashboards/hydrate";
import { kpiConfigFromCatalog } from "@/lib/team-dashboards/kpi-catalog";
import {
  deleteTeamDashboardPackFromStore,
  getTeamDashboardPackFromStore,
  listTeamDashboardPacksFromStore,
  upsertTeamDashboardPackInStore,
} from "@/lib/team-dashboards/store";
import { isValidTeamDashboardSlug, slugifyTeamDashboard } from "@/lib/team-dashboards/slug";
import type { TeamDashboardPackInput } from "@/lib/team-dashboards/form";
import type { TeamDashboardPack } from "@/lib/team-dashboards/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";

const REVALIDATE_PATHS = ["/settings/team-dashboards", "/teams", "/executive", "/operations"];

function revalidateTeamDashboardPaths(slug?: string) {
  for (const path of REVALIDATE_PATHS) revalidatePath(path);
  if (slug) revalidatePath(`/teams/${slug}`);
  revalidatePath("/settings/team-dashboards", "layout");
}

export type { TeamDashboardPackInput } from "@/lib/team-dashboards/form";

function inputToPack(input: TeamDashboardPackInput): TeamDashboardPack {
  const slug = input.slug.trim();
  if (!isValidTeamDashboardSlug(slug)) {
    throw new Error("Slug must use lowercase letters, numbers, and hyphens.");
  }
  if (!input.label.trim()) throw new Error("Label is required.");
  if (!input.kpiIds.length) throw new Error("Select at least one KPI.");

  return {
    slug,
    label: input.label.trim(),
    description: input.description.trim(),
    eyebrow: input.eyebrow?.trim() || "Team operating view",
    projectScope: {
      teamId: input.teamId || undefined,
      teamName: input.teamName?.trim() || undefined,
      includeTeamProjects: input.includeTeamProjects,
      projectTypes: input.projectTypes,
      projectIds: input.projectIds,
    },
    kpis: input.kpiIds.map((id) => kpiConfigFromCatalog(id)),
    showProjectPortfolio: input.showProjectPortfolio,
    nav: {
      label: input.navLabel.trim() || input.label.trim(),
      icon: "FolderKanban",
      group: input.navGroup,
    },
    access: {
      roles: input.accessRoles,
      teamMembers: input.teamMembers,
      teamLeads: input.teamLeads,
    },
  };
}

export async function listTeamDashboardPacksAction() {
  await requirePermission("settings:manage");
  await hydrateTeamDashboardPacks();
  return listTeamDashboardPacksFromStore(false);
}

export async function getTeamDashboardPackAction(slug: string) {
  await requirePermission("settings:manage");
  await hydrateTeamDashboardPacks();
  return getTeamDashboardPackFromStore(slug) ?? null;
}

export async function saveTeamDashboardPackAction(input: TeamDashboardPackInput) {
  const user = await requirePermission("settings:manage");
  await hydrateTeamDashboardPacks();

  const pack = inputToPack(input);
  const existing = getTeamDashboardPackFromStore(pack.slug);
  const saved = upsertTeamDashboardPackInStore({
    ...pack,
    id: existing?.id,
    is_active: input.is_active ?? true,
    sort_order: existing?.sort_order ?? listTeamDashboardPacksFromStore(false).length,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });

  if (isSupabaseConfigured()) {
    await persistTeamDashboardPackToSupabase(saved, user.id);
  }

  revalidateTeamDashboardPaths(pack.slug);
  return saved;
}

export async function deleteTeamDashboardPackAction(slug: string) {
  await requirePermission("settings:manage");
  await hydrateTeamDashboardPacks();
  deleteTeamDashboardPackFromStore(slug);
  if (isSupabaseConfigured()) {
    await deleteTeamDashboardPackFromSupabase(slug);
  }
  revalidateTeamDashboardPaths(slug);
}

export async function suggestTeamDashboardSlugAction(label: string) {
  await requirePermission("settings:manage");
  return slugifyTeamDashboard(label);
}
