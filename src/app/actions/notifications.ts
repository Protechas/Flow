"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { requireAuthenticatedUser, requireUser } from "@/lib/auth/session";
import { withTimeout } from "@/lib/server/with-timeout";
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
  await requireUser();
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

/** Lightweight read for header bell — no full store hydrate or workflow sync. */
export async function getNotificationsAction(filters?: NotificationCenterFilters) {
  try {
    const user = await withTimeout(
      requireAuthenticatedUser(),
      8_000,
      "Notification auth timed out"
    );
    return await getNotificationCenter(user.id, filters ?? { limit: 50 });
  } catch {
    return { items: [], unread: 0, total: 0 };
  }
}

export async function markNotificationReadAction(id: string) {
  const user = await requireAuthenticatedUser();
  await markNotificationRead(id, user.id);
  revalidateNotificationPaths();
}

export async function markAllNotificationsReadAction() {
  const user = await requireAuthenticatedUser();
  await markAllNotificationsRead(user.id);
  revalidateNotificationPaths();
}
