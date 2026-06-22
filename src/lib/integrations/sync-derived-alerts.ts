import { initFlowStore, getFlowStore } from "@/lib/data/flow-store";
import { initProductionTracking } from "@/lib/data/production-tracking";
import { hydrateWorkVisibilitySettings } from "@/lib/work-visibility/hydrate";
import { syncActivityGaps } from "@/lib/work-visibility/engine";
import { hydrateWorkloadAlertSettings } from "@/lib/workload-alerts/hydrate";
import { syncWorkloadAlerts } from "@/lib/workload-alerts/engine";

/** Recompute workload + activity-gap alerts from current store state. */
export function syncDerivedOperationalAlerts() {
  initFlowStore();
  initProductionTracking();
  hydrateWorkloadAlertSettings();
  hydrateWorkVisibilitySettings();
  const store = getFlowStore();
  syncWorkloadAlerts(store.workPackages, store.users);
  syncActivityGaps(store.users);
}
