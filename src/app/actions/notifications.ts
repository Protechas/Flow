"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { requireUser } from "@/lib/auth/session";
import { applyStuckStatus, getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import {
  getNotificationCenter,
  syncAllNotificationSources,
  type NotificationCenterFilters,
} from "@/lib/notifications/hub";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/notifications";
import {
  buildWorkflowContext,
  runScheduledWorkflowChecks,
} from "@/lib/workflow/workflow-engine";
import { hydrateWorkloadAlertSettings } from "@/lib/workload-alerts/hydrate";
import { syncWorkloadAlerts } from "@/lib/workload-alerts/engine";
import { hydrateHelpFlagSettings } from "@/lib/help-flags/hydrate";
import { runHelpFlagEscalations } from "@/lib/help-flags/engine";
import { hydrateWorkVisibilitySettings } from "@/lib/work-visibility/hydrate";
import { syncActivityGaps } from "@/lib/work-visibility/engine";

const REVALIDATE_PATHS = [
  "/operations",
  "/work",
  "/qa-center",
  "/executive",
  "/notifications",
  "/alert-center",
];

function revalidateNotificationPaths() {
  REVALIDATE_PATHS.forEach((p) => revalidatePath(p));
}

export async function runWorkflowChecksAction() {
  initFlowStore();
  const store = getFlowStore();
  const ctx = buildWorkflowContext(store);
  const { stuckPackageIds } = runScheduledWorkflowChecks(ctx);
  await hydrateWorkloadAlertSettings();
  syncWorkloadAlerts(store.workPackages, store.users);
  await hydrateHelpFlagSettings();
  runHelpFlagEscalations(store.users);
  await hydrateWorkVisibilitySettings();
  syncActivityGaps(store.users);
  syncAllNotificationSources();
  if (stuckPackageIds.length) {
    applyStuckStatus(stuckPackageIds);
    await writeAuditLog({
      action: "workflow_alert",
      entityType: "work_package",
      summary: `Flagged ${stuckPackageIds.length} packages as stuck`,
      metadata: { package_ids: stuckPackageIds },
    });
  }
}

export async function getNotificationsAction(filters?: NotificationCenterFilters) {
  const user = await requireUser();
  await runWorkflowChecksAction();
  return getNotificationCenter(user.id, filters ?? { limit: 50 });
}

export async function markNotificationReadAction(id: string) {
  const user = await requireUser();
  await markNotificationRead(id, user.id);
  revalidateNotificationPaths();
}

export async function markAllNotificationsReadAction() {
  const user = await requireUser();
  await markAllNotificationsRead(user.id);
  revalidateNotificationPaths();
}
