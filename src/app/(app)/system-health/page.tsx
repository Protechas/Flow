import { SystemHealthView } from "@/components/system-health/system-health-view";
import { FlowPageShell, WorkspaceContainer } from "@/components/platform";
import { requirePageAccess } from "@/lib/auth/guard";
import { initFlowStore } from "@/lib/data/flow-store";
import { hydrateAppStore } from "@/lib/data/users";
import { hydrateOrgPositions } from "@/lib/data/org-positions";
import { hydrateDepartmentStructure } from "@/lib/data/departments-db";
import { hydrateHelpFlagSettings } from "@/lib/help-flags/hydrate";
import { buildSystemHealthReport } from "@/lib/system-health/integrity";
import { hydrateWorkloadAlertSettings } from "@/lib/workload-alerts/hydrate";

export default async function SystemHealthPage() {
  await requirePageAccess("/system-health");
  initFlowStore();
  await hydrateAppStore();
  await hydrateDepartmentStructure();
  await hydrateOrgPositions();
  await hydrateWorkloadAlertSettings();
  await hydrateHelpFlagSettings();
  const report = buildSystemHealthReport();

  return (
    <FlowPageShell
      title="System Health"
      eyebrow="Administration"
      breadcrumbs={[{ label: "System Health" }]}
      description="Broken relationships, missing assignments, forecast gaps, and orphaned alert records."
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="p-0">
          <SystemHealthView report={report} />
        </WorkspaceContainer>
      }
    />
  );
}
