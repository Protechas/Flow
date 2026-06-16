/**
 * Bridge between production-tracking and flow-store without circular imports.
 */
import type { ActivityEventType, WorkPackage } from "@/types/flow";
import {
  activateTaskLiveForecast,
  getFlowStore,
  initFlowStore,
  logActivityBridge,
  refreshTaskLiveForecast,
  updateWorkPackage,
} from "@/lib/data/flow-store";

export { getFlowStore, initFlowStore, logActivityBridge };

export function updateWorkPackageExternal(id: string, updates: Partial<WorkPackage>) {
  return updateWorkPackage(id, updates);
}

export function activateTaskLiveForecastExternal(taskId: string, startedAtIso: string) {
  return activateTaskLiveForecast(taskId, startedAtIso);
}

export function refreshTaskLiveForecastExternal(taskId: string, taskActiveMinutes?: number) {
  return refreshTaskLiveForecast(taskId, taskActiveMinutes);
}
