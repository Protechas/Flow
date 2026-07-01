import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { refreshAllLiveForecasts } from "@/lib/data/flow-store";
import { initProductionTracking } from "@/lib/data/production-tracking";
import { persistRecalculatedForecastsDb } from "@/lib/data/work-items-db";

/**
 * Recompute task/project forecast dates from current time, assignee queues, and task timers,
 * then persist so Planning and Operations stay aligned.
 */
export async function refreshPlanningForecasts(): Promise<string> {
  await ensureAppDataLoaded();
  initProductionTracking();
  const refreshedAt = new Date();
  refreshAllLiveForecasts({ now: refreshedAt });
  await persistRecalculatedForecastsDb();
  return refreshedAt.toISOString();
}
