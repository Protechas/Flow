import { SystemHealthView } from "@/components/system-health/system-health-view";
import { FlowPageShell, WorkspaceContainer } from "@/components/platform";
import { requirePageAccess } from "@/lib/auth/guard";
import { hydrateOrgPositions } from "@/lib/data/org-positions";
import { hydrateHelpFlagSettings } from "@/lib/help-flags/hydrate";
import { buildSystemHealthReport } from "@/lib/system-health/integrity";
import { buildProductionConfigReport } from "@/lib/system-health/production-config";
import { buildPermissionDiagnosticsReport } from "@/lib/system-health/permission-diagnostics";
import { buildRuntimeHealthReport } from "@/lib/system-health/runtime-checks";
import { hydrateWorkloadAlertSettings } from "@/lib/workload-alerts/hydrate";

export default async function SystemHealthPage() {
  await requirePageAccess("/system-health");
  await hydrateOrgPositions();
  await hydrateWorkloadAlertSettings();
  await hydrateHelpFlagSettings();
  const report = buildSystemHealthReport();
  const configReport = buildProductionConfigReport();
  const runtimeReport = await buildRuntimeHealthReport();
  const permissionReport = await buildPermissionDiagnosticsReport();

  return (
    <FlowPageShell
      title="System Health"
      eyebrow="Administration"
      breadcrumbs={[{ label: "System Health" }]}
      description="Environment config, live Supabase checks, broken relationships, missing assignments, forecast gaps, and orphaned alert records."
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="p-0">
          <SystemHealthView
            report={report}
            configReport={configReport}
            runtimeReport={runtimeReport}
            permissionReport={permissionReport}
          />
        </WorkspaceContainer>
      }
    />
  );
}
