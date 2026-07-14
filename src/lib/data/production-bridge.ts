/**
 * Bridge between production-tracking and flow-store without circular imports.
 */
import type { ActivityEventType, QaReview, WorkPackage } from "@/types/flow";
import {
  activateTaskLiveForecast,
  addQaReviewToStore,
  getFlowStore,
  initFlowStore,
  logActivityBridge,
  recordTimerTimeLog,
  refreshTaskLiveForecast,
  replaceQaReviewsStore,
  updateWorkPackage,
} from "@/lib/data/flow-store";

export { getFlowStore, initFlowStore, logActivityBridge };

export function replaceQaReviewsStoreExternal(list: QaReview[]) {
  return replaceQaReviewsStore(list);
}

export function addQaReviewToStoreExternal(review: QaReview) {
  return addQaReviewToStore(review);
}

export function updateWorkPackageExternal(id: string, updates: Partial<WorkPackage>) {
  return updateWorkPackage(id, updates);
}

export function activateTaskLiveForecastExternal(taskId: string, startedAtIso: string) {
  return activateTaskLiveForecast(taskId, startedAtIso);
}

export function refreshTaskLiveForecastExternal(taskId: string, taskActiveMinutes?: number) {
  return refreshTaskLiveForecast(taskId, taskActiveMinutes);
}

export function recordTimerTimeLogExternal(input: {
  id: string;
  work_package_id: string;
  user_id: string;
  hours: number;
  log_date: string;
}) {
  return recordTimerTimeLog(input);
}
