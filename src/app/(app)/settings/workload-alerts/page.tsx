import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { WorkloadAlertSettingsAdmin } from "@/components/workload-alerts/workload-alert-settings-admin";
import { requirePageAccess } from "@/lib/auth/guard";
import { listDepartments, listTeamsStore, initFlowStore } from "@/lib/data/flow-store";
import { hydrateWorkloadAlertSettings } from "@/lib/workload-alerts/hydrate";

export default async function WorkloadAlertsSettingsPage() {
  const user = await requirePageAccess("/settings/workload-alerts");
  if (user.role !== "admin" && user.role !== "super_admin") {
    redirect("/unauthorized");
  }

  initFlowStore();
  const settings = await hydrateWorkloadAlertSettings();

  return (
    <>
      <PageHeader
        title="Workload alerts"
        description="Configure thresholds and scope for employee low-workload monitoring."
      />
      <WorkloadAlertSettingsAdmin
        settings={settings}
        departments={listDepartments()}
        teams={listTeamsStore()}
      />
    </>
  );
}
