"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { requireUser } from "@/lib/auth/session";
import { applyStuckStatus, getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import {
  countUnreadNotifications,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/notifications";
import {
  buildWorkflowContext,
  runScheduledWorkflowChecks,
} from "@/lib/workflow/workflow-engine";

const REVALIDATE_PATHS = ["/operations", "/work", "/qa-center", "/executive"];

function revalidateNotificationPaths() {
  REVALIDATE_PATHS.forEach((p) => revalidatePath(p));
}

export async function runWorkflowChecksAction() {
  initFlowStore();
  const store = getFlowStore();
  const ctx = buildWorkflowContext(store);
  const { stuckPackageIds } = runScheduledWorkflowChecks(ctx);
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

export async function getNotificationsAction() {
  const user = await requireUser();
  await runWorkflowChecksAction();
  const [items, unread] = await Promise.all([
    listNotificationsForUser(user.id),
    countUnreadNotifications(user.id),
  ]);
  return { items, unread };
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
