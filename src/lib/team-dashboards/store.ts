import { ADVANCED_PROJECTS_PACK } from "@/lib/team-dashboards/advanced-projects";
import type { TeamDashboardPack } from "@/lib/team-dashboards/types";

export interface TeamDashboardPackRecord extends TeamDashboardPack {
  id?: string;
  is_active?: boolean;
  sort_order?: number;
  updated_at?: string;
  updated_by?: string | null;
}

let packs: TeamDashboardPackRecord[] = [];
let hydrated = false;

export function defaultTeamDashboardPacks(): TeamDashboardPackRecord[] {
  return [{ ...ADVANCED_PROJECTS_PACK, sort_order: 0, is_active: true }];
}

export function isTeamDashboardPacksHydrated(): boolean {
  return hydrated;
}

export function setTeamDashboardPacksHydrated(value: boolean): void {
  hydrated = value;
}

export function listTeamDashboardPacksFromStore(activeOnly = true): TeamDashboardPackRecord[] {
  const list = packs.length ? packs : defaultTeamDashboardPacks();
  if (!activeOnly) return [...list];
  return list.filter((p) => p.is_active !== false);
}

export function getTeamDashboardPackFromStore(slug: string): TeamDashboardPackRecord | undefined {
  return listTeamDashboardPacksFromStore(false).find((p) => p.slug === slug);
}

export function replaceTeamDashboardPacksInStore(next: TeamDashboardPackRecord[]): void {
  packs = [...next].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  hydrated = true;
}

export function upsertTeamDashboardPackInStore(pack: TeamDashboardPackRecord): TeamDashboardPackRecord {
  const existingIdx = packs.findIndex((p) => p.slug === pack.slug);
  const row: TeamDashboardPackRecord = {
    ...pack,
    is_active: pack.is_active ?? true,
    sort_order: pack.sort_order ?? packs.length,
    updated_at: pack.updated_at ?? new Date().toISOString(),
  };
  if (existingIdx >= 0) {
    packs[existingIdx] = { ...packs[existingIdx], ...row };
  } else {
    packs.push(row);
  }
  packs.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  hydrated = true;
  return row;
}

export function deleteTeamDashboardPackFromStore(slug: string): boolean {
  const before = packs.length;
  packs = packs.filter((p) => p.slug !== slug);
  hydrated = true;
  return packs.length < before;
}

export function resetTeamDashboardPackStore(): void {
  packs = [];
  hydrated = false;
}
