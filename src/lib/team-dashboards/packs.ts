import {
  deleteTeamDashboardPackFromStore,
  getTeamDashboardPackFromStore,
  listTeamDashboardPacksFromStore,
  upsertTeamDashboardPackInStore,
} from "@/lib/team-dashboards/store";
import type { TeamDashboardPack } from "@/lib/team-dashboards/types";

export function listTeamDashboardPacks(): TeamDashboardPack[] {
  return listTeamDashboardPacksFromStore(true);
}

export function getTeamDashboardPack(slug: string): TeamDashboardPack | undefined {
  const pack = getTeamDashboardPackFromStore(slug);
  if (!pack || pack.is_active === false) return undefined;
  return pack;
}

export {
  deleteTeamDashboardPackFromStore,
  getTeamDashboardPackFromStore,
  upsertTeamDashboardPackInStore,
};
