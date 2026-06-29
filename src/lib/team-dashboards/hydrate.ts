import {
  hydrateTeamDashboardPacksFromSupabase,
} from "@/lib/data/team-dashboards-db";
import { isTeamDashboardPacksHydrated } from "@/lib/team-dashboards/store";

let hydrating: Promise<void> | null = null;

export async function hydrateTeamDashboardPacks(): Promise<void> {
  if (isTeamDashboardPacksHydrated()) return;
  if (!hydrating) {
    hydrating = hydrateTeamDashboardPacksFromSupabase().then(() => undefined);
  }
  await hydrating;
}
