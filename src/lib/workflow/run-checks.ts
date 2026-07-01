import { writeAuditLog } from "@/lib/audit/audit-log";
import { applyStuckStatus, getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { syncAllNotificationSources } from "@/lib/notifications/hub";
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

/** Server-only workflow side effects — not a client-callable action. */
export async function runWorkflowChecks(): Promise<void> {
  await ensureAppDataLoaded();
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
