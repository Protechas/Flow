import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { initFlowStore, getFlowStore, refreshAllLiveForecasts } from "@/lib/data/flow-store";
import { ensureProjectsHydrated } from "@/lib/data/projects-db";
import { ensureWorkStructureHydrated } from "@/lib/data/work-items-db";
import { hydrateAppStore } from "@/lib/data/users";
import { ensureProductionTrackingHydrated } from "@/lib/data/production-tracking-db";
import { ensureTimeLogsHydrated } from "@/lib/data/time-logs-db";
import { ensureWrapUpsHydrated } from "@/lib/data/wrap-ups-db";
import { ensureHelpFlagsHydrated } from "@/lib/data/help-flags-db";
import { ensureWorkloadAlertsHydrated } from "@/lib/data/workload-alerts-db";

const hydrateApp = cache(async (): Promise<void> => {
  if (!isSupabaseConfigured()) {
    initFlowStore();
    const { hydrateTeamDashboardPacks } = await import("@/lib/team-dashboards/hydrate");
    await hydrateTeamDashboardPacks();
    const { hydrateOperatingModels } = await import("@/lib/operating-models/hydrate");
    await hydrateOperatingModels();
    return;
  }
  // Every hydrator below fetches independently — ordering constraints live
  // inside the hydrators themselves (hydrateAppStore sequences users before
  // hierarchy init; production tracking awaits the work structure before
  // mapping). Fire everything in one wave so a request pays one DB round-trip
  // of latency instead of four.
  const [{ hydrateTeamDashboardPacks }, { hydrateOperatingModels }, { hydrateForecastSettings }] =
    await Promise.all([
      import("@/lib/team-dashboards/hydrate"),
      import("@/lib/operating-models/hydrate"),
      import("@/lib/forecast/hydrate"),
    ]);
  await Promise.all([
    hydrateAppStore(),
    ensureProjectsHydrated(),
    ensureWorkStructureHydrated(),
    ensureProductionTrackingHydrated(),
    ensureTimeLogsHydrated(),
    ensureWrapUpsHydrated(),
    ensureHelpFlagsHydrated(),
    ensureWorkloadAlertsHydrated(),
    hydrateTeamDashboardPacks(),
    hydrateOperatingModels(),
    // Settings must resolve before the forecast recalc below or dates compute
    // from defaults instead of the org's configured rates.
    hydrateForecastSettings(),
  ]);
  // DB rows carry forecast fields only as of their last write. Recompute all
  // live forecasts (smart due dates, variance, landing status) per request so
  // views never show stale planning/active dates.
  refreshAllLiveForecasts();
});

/**
 * Load Supabase-backed org data into the in-memory store once per request.
 * Call from guards, layouts, and server modules that read flow-store users/projects.
 */
export async function ensureAppDataLoaded(): Promise<void> {
  await hydrateApp();
}

/** Hydrate then return the flow store — preferred over bare initFlowStore() on server. */
export async function getReadyFlowStore() {
  await ensureAppDataLoaded();
  return getFlowStore();
}

/** @deprecated Use ensureAppDataLoaded — kept for existing imports */
export async function hydrateProductionAppStore(): Promise<void> {
  await ensureAppDataLoaded();
}
