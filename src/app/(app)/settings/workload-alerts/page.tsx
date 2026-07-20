import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { WorkloadAlertSettingsAdmin } from "@/components/workload-alerts/workload-alert-settings-admin";
import { requirePageAccess } from "@/lib/auth/guard";
import {
  getFlowStore,
  listDepartments,
  listTeamsStore,
  initFlowStore,
} from "@/lib/data/flow-store";
import { hydrateWorkloadAlertSettings } from "@/lib/workload-alerts/hydrate";

export default async function WorkloadAlertsSettingsPage() {
  const user = await requirePageAccess("/settings/workload-alerts");
  if (user.role !== "admin" && user.role !== "super_admin") {
    redirect("/unauthorized");
  }

  initFlowStore();
  const settings = await hydrateWorkloadAlertSettings();
  const teams = listTeamsStore();
  const people = getFlowStore()
    .users.filter(
      (u) => u.is_active && (u.role === "employee" || u.role === "teamlead")
    )
    .map((u) => ({
      id: u.id,
      name: u.full_name,
      teamName: teams.find((t) => t.id === u.team_id)?.name ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader
        title="Workload alerts"
        description="Configure thresholds and scope for employee low-workload monitoring."
      />
      <WorkloadAlertSettingsAdmin
        settings={settings}
        departments={listDepartments()}
        teams={teams}
        people={people}
      />
    </>
  );
}
